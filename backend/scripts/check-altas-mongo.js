'use strict';
const crypto=require('node:crypto');
process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');process.env.TOTP_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');
process.env.APP_URL='https://localhost';process.env.CORS_ORIGIN='https://localhost';
for(const k of ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_FROM'])delete process.env[k];
const assert=require('node:assert/strict'),mongoose=require('mongoose'),request=require('supertest'),jwt=require('jsonwebtoken'),speakeasy=require('speakeasy');
const {createApp}=require('../app'),U=require('../models/Usuario'),S=require('../models/SolicitudOrganizacion'),R=require('../models/RevisionSolicitudOrganizacion');
const P=require('../models/PermisoAltasPlataforma'),O=require('../models/Organizacion'),M=require('../models/Membresia'),Op=require('../models/OperacionAlta'),Sesion=require('../models/SesionUsuario');
const {encryptTotpSecret}=require('../utils/totpEncryption');const {designar}=require('../services/designacionGestorAltas');
const clave='Fixture-Altas-2026!',root='/me/solicitudes-organizacion',adm='/plataforma/solicitudes-organizacion';
const datos=n=>({razonSocial:'Empresa FICTICIA '+n,pais:'ES',nif:'B'+String(n).padStart(8,'0'),funcionProfesional:'Gerencia de prueba',justificacion:'Solicitud sintética para comprobar la autorización del alta.'});
async function comprobar({uri,nombreBD,standalone}){
 const url=new URL(uri);if(url.hostname!=='127.0.0.1'||!url.port||url.port==='27017'||url.username||url.password||!/^nc_org03_[a-f0-9]{24}$/.test(nombreBD))throw Error('SOLO_BD_TEMPORAL');
 let n=0;const resultados=[],caso=async(nombre,fn)=>{await fn();resultados.push(nombre);console.log('OK '+nombre);};
 const app=createApp({rateLimits:false}),call=(method,path,c)=>{const q=request(app)[method](path).set('Origin','https://localhost').set('X-Requested-With','XMLHttpRequest');return c?q.set('Cookie',c):q;};
 const cookie=(r,key='cyberaudit_token')=>(r.headers['set-cookie']||[]).find(s=>s.startsWith(key+'=')&&!s.startsWith(key+'=;'))?.split(';')[0];
 const cuenta=async(extra={})=>U.create({nombre:'Persona FICTICIA',email:'alta'+(++n)+'@example.invalid',password:clave,emailVerifiedAt:new Date(),...extra});
 const login=async(u,secret)=>{let r=await call('post','/auth/login').send({email:u.email,password:clave});
   if(secret){assert.equal(r.body.data.requires2fa,true);r=await call('post','/auth/2fa/verify',cookie(r,'cyberaudit_2fa_pending')).send({token:speakeasy.totp({secret,encoding:'base32'})});}
   assert.equal(r.status,200,JSON.stringify(r.body));assert.ok(cookie(r));return cookie(r);};
 const crear=(c,d,key=crypto.randomUUID())=>call('post',root,c).set('Idempotency-Key',key).send(d);
 const editar=(c,s,d,key=crypto.randomUUID())=>call('put',root+'/'+s.id,c).set('Idempotency-Key',key).send({version:s.version,datos:d});
 const decidir=(c,s,decision='aprobar',key=crypto.randomUUID(),extra={})=>call('post',adm+'/'+s.id+'/decision',c).set('Idempotency-Key',key)
   .send({version:s.version,decision,motivoPublico:'Decisión manual de prueba, sin acreditación jurídica.',notaInterna:'Nota interna solo para el gestor.',...extra});
 const obtener=async(c,id,admin=false)=>{const r=await call('get',(admin?adm:root)+'/'+id,c);assert.equal(r.status,200,JSON.stringify(r.body));return r.body.data.solicitud;};
 const nueva=async(nif)=>{const u=await cuenta(),c=await login(u),r=await crear(c,datos(nif??++n));assert.equal(r.status,200,JSON.stringify(r.body));return{u,c,s:r.body.data.solicitud};};
 try{
  await mongoose.connect(uri,{dbName:nombreBD,serverSelectionTimeoutMS:3000});for(const m of Object.values(mongoose.models))await m.init();
  if(standalone){const u=await cuenta(),c=await login(u);await caso('standalone rechaza alta sin efectos parciales',async()=>{assert.equal((await crear(c,datos(900))).status,503);assert.equal(await S.countDocuments(),0);assert.equal(await R.countDocuments(),0);assert.equal(await O.countDocuments(),0);assert.equal(await M.countDocuments(),0);});return resultados;}
  await caso('rutas públicas no interceptadas; altas anónimas401 y CSRF403',async()=>{
   assert.equal((await request(app).get('/health')).status,200);assert.equal((await request(app).get('/')).status,200);
   assert.equal((await call('get',root)).status,401);assert.equal((await call('get','/me/altas-capacidades')).status,401);
   assert.equal((await request(app).post(root).send(datos(1))).status,403);
  });
  const sin=await cuenta({emailVerifiedAt:null});
  await caso('sin verificar no puede autenticar ni presentar/activar alta',async()=>{assert.equal((await call('post','/auth/login').send({email:sin.email,password:clave})).status,403);assert.equal(await S.countDocuments(),0);});
  await caso('verificación HTTP real de token: un uso, ninguna organización ni membresía',async()=>{
   const token=crypto.randomBytes(32).toString('hex');await U.updateOne({_id:sin._id},{$set:{emailVerificationTokenHash:crypto.createHash('sha256').update(token).digest('hex'),emailVerificationExpiresAt:new Date(Date.now()+60000)}});
   assert.equal((await call('post','/auth/verify-email').send({token})).status,200);assert.equal((await call('post','/auth/verify-email').send({token})).status,400);
   const c=await login(sin);assert.equal((await call('get','/me/organizaciones',c)).body.data.organizaciones.length,0);assert.equal(await S.countDocuments(),0);assert.equal(await O.countDocuments(),0);assert.equal(await M.countDocuments(),0);
  });
  const gestor=await cuenta(),secret=speakeasy.generateSecret({length:20}).base32;
  await caso('designación inicial exige correo verificado y MFA, sin autoasignación por email o Usuario.rol',async()=>{
   await assert.rejects(()=>designar({usuarioId:String(gestor._id),emailConfirmado:gestor.email,referenciaAutorizacion:'Autorización ficticia para test aislado'}),/SIN_MFA/);
   await U.updateOne({_id:gestor._id},{$set:{twoFactorEnabled:true,twoFactorSecret:encryptTotpSecret(secret,gestor._id)}});
   await assert.rejects(()=>designar({usuarioId:String(gestor._id),emailConfirmado:'otro@example.invalid',referenciaAutorizacion:'Autorización ficticia para test aislado'}),/SIN_MFA/);
   await designar({usuarioId:String(gestor._id),emailConfirmado:gestor.email,referenciaAutorizacion:'Autorización ficticia para test aislado'});
   await assert.rejects(()=>designar({usuarioId:String(gestor._id),emailConfirmado:gestor.email,referenciaAutorizacion:'Autorización ficticia repetida en test'}),/YA_EXISTE/);
   assert.equal((await U.findById(gestor._id)).rol,'usuario');assert.equal(await O.countDocuments(),0);assert.equal(await M.countDocuments(),0);
  });
  let gc=await login(gestor,secret);const a=await nueva(100),b=await nueva(101);
  await caso('verificada pendiente: lista/estado propios y ningún acceso empresarial',async()=>{
   assert.equal(a.s.estado,'pendiente_revision');assert.equal(a.s.organizacion,null);
   assert.equal((await call('get','/me/organizaciones',a.c)).body.data.organizaciones.length,0);
   assert.equal((await call('get','/organizaciones/'+new mongoose.Types.ObjectId()+'/contexto',a.c)).status,403);
   assert.equal((await call('get',root,a.c)).body.data.solicitudes.length,1);assert.equal((await call('get',root+'/'+b.s.id,a.c)).status,404);
   assert.equal(await M.countDocuments(),0);assert.equal(await O.countDocuments(),0);
  });
  await caso('campos de identidad/rol/estado y filtros inyectados rechazados',async()=>{
   for(const extra of [{rol:'administrador'},{solicitante:String(gestor._id)},{estado:'aprobada'},{organizacion:new mongoose.Types.ObjectId()}])assert.equal((await crear(a.c,{...datos(199),...extra})).status,400);
   for(const suffix of ['?usuario='+a.u._id,'?estado=aprobada','?limite=51','?despues[$ne]=x'])assert.equal((await call('get',root+suffix,a.c)).status,400);
   assert.equal((await call('post',root,a.c).send(datos(2))).status,400);
   assert.equal((await crear(a.c,datos(199)).set('Origin','https://ajeno.invalid')).status,403);
  });
  await caso('admin empresarial o antiguo rol global admin no gestionan altas',async()=>{
   const u=await cuenta({rol:'admin'}),c=await login(u);const o=await O.create({razon_social:'Empresa previa ficticia',pais:'ES',identificador_tipo:'NIF',identificador_valor:'B99999999',estado:'activa'});
   await M.create({usuario:u._id,organizacion:o._id,rol:'administrador',estado:'activa'});
   for(const co of [a.c,c]){assert.equal((await call('get',adm,co)).status,403);assert.equal((await decidir(co,a.s)).status,403);assert.equal((await call('get','/me/altas-capacidades',co)).body.data.gestionarAltas,false);}
  });
  await caso('capacidad gestora explícita no concede lectura de empresa ajena',async()=>{
   assert.equal((await call('get','/me/altas-capacidades',gc)).body.data.gestionarAltas,true);
   assert.equal((await call('get',adm,gc)).body.data.solicitudes.length,2);
   const o=await O.findOne();assert.equal((await call('get','/organizaciones/'+o._id+'/contexto',gc)).status,403);
  });
  await caso('creación idempotente, una abierta y claves reutilizadas detectadas',async()=>{
   const u=await cuenta(),c=await login(u),key=crypto.randomUUID();const rs=await Promise.all([crear(c,datos(102),key),crear(c,datos(102),key)]);
   assert.deepEqual(rs.map(r=>r.status),[200,200]);assert.equal(rs[0].body.data.solicitud.id,rs[1].body.data.solicitud.id);
   assert.equal(rs.filter(r=>r.body.data.repetida).length,1);
   assert.equal((await crear(c,datos(103),key)).body.codigo,'CLAVE_REUTILIZADA');assert.equal((await crear(c,datos(103))).body.codigo,'SOLICITUD_ABIERTA');
   assert.equal(await S.countDocuments({solicitante:u._id}),1);
  });
  await caso('aclaración, corrección y conflictos guardan historia y ocultan nota interna',async()=>{
   const r=await decidir(gc,a.s,'pedir_aclaracion');assert.equal(r.status,200,JSON.stringify(r.body));const s=r.body.data.solicitud;
   assert.equal(s.estado,'aclaracion_requerida');assert.equal(s.version,2);assert.ok(s.historial[1].notaInterna);
   const visible=await obtener(a.c,a.s.id);assert.equal(JSON.stringify(visible).includes('notaInterna'),false);assert.equal(JSON.stringify(visible).includes('Nota interna'),false);
   assert.equal((await decidir(gc,s)).body.codigo,'TRANSICION_INVALIDA');
   assert.equal((await editar(a.c,a.s,datos(100))).body.codigo,'VERSION_DESACTUALIZADA');
   const e=await editar(a.c,s,{...datos(100),justificacion:'Datos aclarados\nSolicitud corregida para revisión.'});assert.equal(e.status,200,JSON.stringify(e.body));
   a.s=e.body.data.solicitud;assert.equal(a.s.estado,'pendiente_revision');assert.equal(a.s.version,3);assert.equal(a.s.historial.length,3);
   assert.equal((await editar(b.c,a.s,datos(100))).status,404);
  });
  await caso('retirar verificación al solicitante bloquea aprobación sin crear empresa',async()=>{
   await U.updateOne({_id:b.u._id},{$set:{emailVerifiedAt:null}});const antes=await O.countDocuments();assert.equal((await decidir(gc,b.s)).body.codigo,'CORREO_NO_VERIFICADO');
   assert.equal(await O.countDocuments(),antes);assert.equal((await S.findById(b.s.id)).estado,'pendiente_revision');await U.updateOne({_id:b.u._id},{$set:{emailVerifiedAt:new Date()}});
  });
  await caso('doble aprobación misma clave crea exactamente empresa, membresía, decisión y recibo',async()=>{
   const key=crypto.randomUUID(),antes=await O.countDocuments(),rs=await Promise.all([decidir(gc,a.s,'aprobar',key),decidir(gc,a.s,'aprobar',key)]);
   assert.deepEqual(rs.map(r=>r.status),[200,200]);assert.equal(rs.filter(r=>r.body.data.repetida).length,1);
   assert.equal(await O.countDocuments(),antes+1);const s=rs[0].body.data.solicitud;assert.equal(s.estado,'aprobada');assert.ok(s.organizacion.id);a.s=s;
   assert.equal(await M.countDocuments({organizacion:s.organizacion.id,usuario:a.u._id,rol:'administrador',estado:'activa'}),1);
   assert.equal(await M.countDocuments({organizacion:s.organizacion.id,usuario:gestor._id}),0);
   assert.equal(await R.countDocuments({solicitud:s.id,accion:'aprobada'}),1);assert.equal(await Op.countDocuments({actor:gestor._id,clave:key}),1);
  });
  await caso('nueva sesión relee decisión y acceso real; aprobada no editable',async()=>{
   const c=await login(a.u);assert.equal((await obtener(c,a.s.id)).estado,'aprobada');
   const orgs=(await call('get','/me/organizaciones',c)).body.data.organizaciones;assert.equal(orgs.length,1);assert.equal(orgs[0].id,a.s.organizacion.id);
   const contexto=await call('get','/organizaciones/'+orgs[0].id+'/contexto',c);assert.equal(contexto.status,404);assert.equal(contexto.body.codigo,'CONTEXTO_NO_INICIADO');
   assert.equal((await editar(c,a.s,datos(100))).body.codigo,'TRANSICION_INVALIDA');
   assert.equal((await call('get','/organizaciones/'+orgs[0].id+'/contexto',gc)).status,403);
   await M.updateOne({usuario:a.u._id,organizacion:orgs[0].id},{$set:{estado:'revocada'}});assert.equal((await call('get','/me/organizaciones',c)).body.data.organizaciones.length,0);
  });
  await caso('rechazo terminal visible con motivo público, sin empresa y con historia',async()=>{
   const antes=await O.countDocuments(),r=await decidir(gc,b.s,'rechazar');assert.equal(r.status,200);const s=await obtener(b.c,b.s.id);
   assert.equal(s.estado,'rechazada');assert.equal(s.historial.at(-1).accion,'rechazada');assert.equal(await O.countDocuments(),antes);
   assert.equal((await editar(b.c,s,datos(101))).body.codigo,'TRANSICION_INVALIDA');assert.equal((await call('get','/me/organizaciones',b.c)).body.data.organizaciones.length,0);
  });
  await caso('NIF existente nunca entrega empresa ni revela sus datos al solicitante',async()=>{
   const x=await nueva(99999999),r=await decidir(gc,x.s);assert.equal(r.body.codigo,'ALTA_NO_DISPONIBLE');assert.equal(await M.countDocuments({usuario:x.u._id}),0);
   assert.equal(JSON.stringify(await obtener(x.c,x.s.id)).includes('Empresa previa'),false);
  });
  await caso('mismo NIF en dos solicitantes: declaraciones no reservan y solo una entidad se activa',async()=>{
   const x=await nueva(300),y=await nueva(300),rs=await Promise.all([decidir(gc,x.s),decidir(gc,y.s)]);
   assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);assert.equal(await O.countDocuments({identificador_valor:datos(300).nif}),1);
   assert.equal(await S.countDocuments({_id:{$in:[x.s.id,y.s.id]},estado:'aprobada'}),1);
  });
  await caso('decisiones distintas concurrentes no mezclan rechazo/aprobación',async()=>{
   const x=await nueva(301),rs=await Promise.all([decidir(gc,x.s),decidir(gc,x.s,'rechazar')]);assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);
   const s=await S.findById(x.s.id);assert.equal(await R.countDocuments({solicitud:s._id}),2);
   assert.equal(await M.countDocuments({usuario:x.u._id}),s.estado==='aprobada'?1:0);
  });
  await caso('fallo al escribir historia revierte organización/membresía/estado/recibo',async()=>{
   const x=await nueva(302),antes=await O.countDocuments(),original=R.create,tx=mongoose.connection.transaction;let diagnostico;
   R.create=async()=>{throw Error('Fallo sintético de almacenamiento');};
   mongoose.connection.transaction=async function(...args){try{return await tx.apply(this,args);}catch(e){diagnostico={name:e.name,message:e.message};throw e;}};
   try{const r=await decidir(gc,x.s);assert.equal(r.status,503,JSON.stringify({respuesta:r.body,diagnostico}));assert.equal(diagnostico?.message,'Fallo sintético de almacenamiento');}finally{R.create=original;mongoose.connection.transaction=tx;}
   assert.equal(await O.countDocuments(),antes);assert.equal(await M.countDocuments({usuario:x.u._id}),0);assert.equal((await S.findById(x.s.id)).version,1);
  });
  await caso('correo verificado después no desencadena aprobaciones ni membresías',async()=>{
   const x=await nueva(303);await U.updateOne({_id:x.u._id},{$set:{emailVerifiedAt:null}});
   assert.equal((await decidir(gc,x.s)).status,409);await U.updateOne({_id:x.u._id},{$set:{emailVerifiedAt:new Date()}});
   assert.equal((await S.findById(x.s.id)).estado,'pendiente_revision');assert.equal(await M.countDocuments({usuario:x.u._id}),0);
  });
  await caso('gestor no decide su propia solicitud',async()=>{const r=await crear(gc,datos(400));assert.equal(r.status,200);assert.equal((await decidir(gc,r.body.data.solicitud)).body.codigo,'AUTOAPROBACION_DENEGADA');});
  await caso('recencia controla decisiones, no lectura, y nueva autenticación recupera permiso',async()=>{
   const payload=jwt.verify(gc.split('=')[1],process.env.JWT_SECRET),f={identificadorHash:crypto.createHash('sha256').update(payload.jti).digest('hex')};
   const inicio=new Date(Date.now()-11*60000);await Sesion.collection.updateOne(f,{$set:{autenticadaEn:inicio,ultimaActividadEn:new Date(),expiraEn:new Date(inicio.getTime()+8*3600000)}});
   assert.equal((await call('get','/me/altas-capacidades',gc)).body.data.requiereAutenticacionReciente,true);
   const x=await nueva(401);assert.equal((await call('get',adm,gc)).status,200);assert.equal((await decidir(gc,x.s)).body.codigo,'REAUTENTICACION_REQUERIDA');
   gc=await login(gestor,secret);assert.equal((await decidir(gc,x.s,'rechazar')).status,200);
  });
  await caso('corrección y aprobación concurrentes nunca aprueban silenciosamente los datos nuevos',async()=>{
   const x=await nueva(410),rs=await Promise.all([editar(x.c,x.s,{...datos(410),razonSocial:'Nombre corregido FICTICIO'}),decidir(gc,x.s)]);
   assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);const s=await S.findById(x.s.id);
   if(s.estado==='aprobada')assert.equal(s.datos.razonSocial,datos(410).razonSocial);else{assert.equal(s.estado,'pendiente_revision');assert.equal(await M.countDocuments({usuario:x.u._id}),0);}
  });
  await caso('sin índice único imprescindible no se admiten nuevas escrituras',async()=>{
   const u=await cuenta(),c=await login(u),antes=await S.countDocuments();await R.collection.dropIndex('revision_solicitud_unica');
   try{assert.equal((await crear(c,datos(411))).status,503);assert.equal(await S.countDocuments(),antes);}finally{await R.collection.createIndex({solicitud:1,version:1},{unique:true,name:'revision_solicitud_unica'});}
  });
  await caso('repetir aprobación tras revocar permiso no devuelve respuesta administrativa',async()=>{
   const x=await nueva(412),key=crypto.randomUUID();assert.equal((await decidir(gc,x.s,'aprobar',key)).status,200);
   await P.updateOne({_id:'revision_altas'},{$set:{estado:'revocado'}});
   try{assert.equal((await decidir(gc,x.s,'aprobar',key)).status,403);}finally{await P.updateOne({_id:'revision_altas'},{$set:{estado:'activo'}});}
  });
  await caso('revocación del gestor y desactivar MFA se comprueban en cada acceso',async()=>{
   await P.updateOne({_id:'revision_altas'},{$set:{estado:'revocado'}});assert.equal((await call('get',adm,gc)).status,403);
   await P.updateOne({_id:'revision_altas'},{$set:{estado:'activo'}});await U.updateOne({_id:gestor._id},{$set:{twoFactorEnabled:false},$inc:{sessionVersion:1}});
   assert.equal((await call('get',adm,gc)).status,401);const c=await login(gestor);const cap=(await call('get','/me/altas-capacidades',c)).body.data;
   assert.equal(cap.gestionarAltas,false);assert.equal(cap.requiereMfa,true);assert.equal((await call('get',adm,c)).body.codigo,'MFA_REQUERIDO');
  });
  await caso('persistencia tras desconectar y reconectar mantiene decisiones e historia',async()=>{
   const antes=await S.findById(a.s.id).lean();await mongoose.disconnect();await mongoose.connect(uri,{dbName:nombreBD,serverSelectionTimeoutMS:3000});
   assert.deepEqual(await S.findById(a.s.id).lean(),antes);assert.equal(await R.countDocuments({solicitud:a.s.id}),4);
  });
  return resultados;
 }finally{await mongoose.disconnect();}
}
module.exports={comprobar};
