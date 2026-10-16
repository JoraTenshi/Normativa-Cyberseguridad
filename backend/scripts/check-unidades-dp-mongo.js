'use strict';
// El preparador reutiliza fixtures RAT en una nueva BD sintética, nunca el QA UI.
const {comprobar: prepararFixture}=require('./check-rat-mongo');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),request=require('supertest'),jwt=require('jsonwebtoken'),mongoose=require('mongoose');
const {createApp}=require('../app'),{unidad,conocido}=require('../tests/fixtures/unidadDP');
const H=require('../models/RegistroNormativo'),V=require('../models/VersionRegistroNormativo'),E=require('../models/EventoOrganizacion');
async function comprobar(options){
 const resultados=[],caso=async(n,f)=>{await f();resultados.push(n);console.log('OK '+n);};
 if(options.standalone){
  const url=new URL(options.uri);assert.equal(url.hostname,'127.0.0.1');assert.notEqual(url.port,'27017');assert.match(options.nombreBD,/^nc_org03_[a-f0-9]{24}$/);
  try{
   await mongoose.connect(options.uri,{dbName:options.nombreBD});for(const m of Object.values(mongoose.models))await m.init();
   const Org=require('../models/Organizacion'),M=require('../models/Membresia'),U=require('../models/Usuario');
   const org=await Org.create({razon_social:'Unidad STANDALONE FICTICIA',pais:'ES',identificador_tipo:'NIF',identificador_valor:'B00009001',estado:'activa'}),uid=new mongoose.Types.ObjectId();
   await U.collection.insertOne({_id:uid,nombre:'Fixture',email:uid+'@example.invalid',emailVerifiedAt:new Date(),sessionVersion:0,rol:'usuario'});await M.create({usuario:uid,organizacion:org._id,rol:'administrador',estado:'activa'});
   const app=createApp({rateLimits:false,politicaSesiones:'legado_pruebas'}),snap=async()=>JSON.stringify({h:await H.find().lean(),v:await V.find().lean(),e:await E.find().lean()});
   await caso('Unidad standalone rechaza transacción sin escrituras parciales',async()=>{const before=await snap();const r=await request(app).post('/organizaciones/'+org._id+'/normativa/unidades-dp').set('Cookie','cyberaudit_token='+jwt.sign({id:String(uid),jti:crypto.randomUUID(),sessionVersion:0},process.env.JWT_SECRET,{expiresIn:'30m'})).set('X-Requested-With','XMLHttpRequest').set('Idempotency-Key',crypto.randomUUID()).send(unidad());assert.equal(r.status,503);assert.equal(await snap(),before);});
  }finally{await mongoose.disconnect();}return resultados;
 }
 await prepararFixture({...options,prepararUI:async seed=>{
  const app=createApp({rateLimits:false,politicaSesiones:'legado_pruebas'}),base='/organizaciones/'+seed.organizationId;
  const key=()=>crypto.randomUUID(),ok=(r,s=200)=>{assert.equal(r.status,s,JSON.stringify(r.body));return r.body.data;};
  const api=(method,path,user='admin')=>request(app)[method](base+path).set('Cookie','cyberaudit_token='+jwt.sign({id:seed.members[user].usuarioId,jti:key(),sessionVersion:0},process.env.JWT_SECRET,{expiresIn:'30m'})).set('X-Requested-With','XMLHttpRequest');
  const post=(path,d,user='admin',k=key())=>api('post','/normativa/'+path,user).set('Idempotency-Key',k).send(d);
  const patch=(path,d,k=key())=>api('patch','/normativa/'+path).set('Idempotency-Key',k).send(d);
  const get=(path,user='admin')=>api('get','/normativa/'+path,user);
  const snap=async()=>JSON.stringify({h:await H.find().sort({_id:1}).lean(),v:await V.find().sort({_id:1}).lean(),e:await E.find().sort({_id:1}).lean()});
  const make=clase=>unidad(clase,seed.operaciones[0],seed.alcance);
  let fin,flow,req,review;
  await caso('Unidad contrato, tenant y roles exactos',async()=>{assert.equal(ok(await get('unidades-dp/contrato')).contrato.version,1);for(const u of ['consulta','colaborador','ajeno']){assert.equal((await get('unidades-dp/contrato',u)).status,403);assert.equal((await post('unidades-dp',make(),u)).status,403);}assert.equal((await request(app).get(base+'/normativa/unidades-dp/contrato')).status,401);});
  await caso('Dos finalidades independientes; flujo enlaza finalidad exacta',async()=>{
   fin=ok(await post('unidades-dp',make()),201);const second=ok(await post('unidades-dp',{...make(),nombre:'Otra finalidad'}),201);assert.notEqual(fin.id,second.id);
   flow=ok(await post('unidades-dp',{...make('flujo_transferencia'),relaciones:[fin.referencia],evidencias:[seed.evidencia]}),201);
   assert.equal(flow.vigencia.requiereRevision,false);assert.equal(flow.contenido.unidadDP.relaciones[0].id,fin.id);
   assert.ok(ok(await get('unidades-dp?limite=1')).paginacion.hayMas);
  });
  await caso('Rechaza referencias y tipos falsos sin escrituras',async()=>{const before=await snap();for(const d of [
   {...make(),operacion:{...seed.operaciones[0],sha256:'0'.repeat(64)}},
   {...make(),operacion:{...seed.operaciones[0],id:seed.ratResponsable.id}},
   {...make('flujo_transferencia'),relaciones:[seed.ratResponsable]},
   {...make('flujo_transferencia'),relaciones:[flow.referencia]},
   {...make(),evidencias:[seed.ratResponsable]},
   {...make(),hechos:[...make().hechos,conocido('dp_rol','responsable')]}
  ])assert.ok([400,404,409].includes((await post('unidades-dp',d)).status));assert.equal(await snap(),before);});
  const reqBody=(obj,clase='finalidad_tratamiento')=>({alcance:seed.alcance,objeto:{tipo:clase,id:obj.id,version:obj.version},ficha:{id:clase==='finalidad_tratamiento'?'RGPD6_7_LICITUD_FINALIDAD':'RGPD44_49_TRANSFERENCIA_FLUJO',version:2},motivo:'Contextualización FICTICIA'});
  await caso('C2 acepta unidad real, no operación disfrazada ni clase equivocada',async()=>{req=ok(await post('requisitos',reqBody(fin)),201);assert.equal(req.evaluabilidad.habilitaEvaluacion,true);assert.equal(req.estadoRevision.satisfaccionActual,'sin_revisar');const r=ok(await post('requisitos',reqBody(flow,'flujo_transferencia')),201);assert.equal(r.evaluabilidad.habilitaEvaluacion,true);assert.equal((await post('requisitos',reqBody({id:seed.operaciones[0].id,version:1}))).status,404);assert.equal((await post('requisitos',reqBody(flow))).status,404);});
  await caso('Ruta de licitud y evidencia exacta; elección no sustituye revisión',async()=>{
   const p=ok(await get('catalogo/RGPD6_7_LICITUD_FINALIDAD')).paquete,ruta=p.ficha.satisfaccion.rutas.find(x=>x.id==='LIC_VIA_A');
   const ev=ok(await get('evidencias/'+seed.evidencia.id)).contenido.evidencia;
   const body={requisito:req.referencia,evidencias:[seed.evidencia],tipo:'interna',periodo:ev.periodo,ruta:{id:ruta.id,motivo:'Ensayo de revisión sintética'},
    criterios:ruta.requiereTodos.map(criterioId=>({criterioId,resultado:'favorable',motivo:'Examen FICTICIO de '+criterioId,evidenciaIds:[seed.evidencia.id],compatibilidad:{estado:'compatible',motivo:'Fixture, no prueba jurídica'}})),conclusion:'favorable',motivo:'Revisión FICTICIA'};
   review=ok(await post('revisiones',body),201);assert.equal(review.estadoRevision.satisfaccionActual,'favorable');
   assert.equal((await post('revisiones',{...body,ruta:{id:'LIC_VIA_F',motivo:'No coincide'},criterios:p.ficha.satisfaccion.rutas.find(x=>x.id==='LIC_VIA_F').requiereTodos.map(criterioId=>({...body.criterios[0],criterioId}))})).status,400);
  });
  await caso('Edición concurrente, replay e historia exacta; relación/juicio caducan',async()=>{
   const body={...make(),version:1};const rs=await Promise.all([patch('unidades-dp/'+fin.id,{...body,nombre:'Cambio A'}),patch('unidades-dp/'+fin.id,{...body,nombre:'Cambio B'})]);assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);fin=ok(rs.find(r=>r.status===200));
   assert.equal(ok(await get('unidades-dp/'+flow.id)).vigencia.requiereRevision,true);assert.equal(ok(await get('requisitos/'+req.id)).estadoRevision.satisfaccionActual,'requiere_revision');assert.deepEqual(ok(await get('revisiones/'+review.id)).contenido,review.contenido);
   const before1=ok(await get('unidades-dp/'+fin.id+'/versiones/1'));assert.equal(before1.contenido.unidadDP.nombre,'Unidad FICTICIA');
   const k=key(),d={...make(),version:fin.version};fin=ok(await patch('unidades-dp/'+fin.id,d,k));const before=await snap();assert.equal(ok(await patch('unidades-dp/'+fin.id,d,k)).repetida,true);assert.equal((await patch('unidades-dp/'+fin.id,{...d,nombre:'Otro'},k)).status,409);assert.equal(await snap(),before);
  });
  await caso('Identidad inmutable y confirmación explícita de nuevas bases',async()=>{const before=await snap(),d={...make(),version:fin.version};assert.equal((await patch('unidades-dp/'+fin.id,{...d,operacion:seed.operaciones[1],confirmarBases:true})).status,400);assert.equal((await patch('unidades-dp/'+fin.id,{...d,operacion:{...d.operacion,version:2}})).status,400);assert.equal((await patch('unidades-dp/'+fin.id,{...d,confirmarBases:true})).status,400);assert.equal(await snap(),before);});
  await caso('Fallo de auditoría revierte unidad y versión',async()=>{const before=await snap(),original=E.create;E.create=async()=>{throw Error('SYNTHETIC_AUDIT_FAILURE');};try{assert.equal((await patch('unidades-dp/'+fin.id,{...make(),version:fin.version})).status,503);}finally{E.create=original;}assert.equal(await snap(),before);});
  await caso('Actualizar operación deja unidades pendientes y bloquea revisión obsoleta',async()=>{ok(await api('patch','/operaciones/'+seed.operaciones[0].id).set('Idempotency-Key',key()).send({version:1,cambios:[conocido('dp_fase','residual')],motivo:'Cambio ficticio'}));const u=ok(await get('unidades-dp/'+fin.id));assert.equal(u.vigencia.requiereRevision,true);assert.ok(u.vigencia.motivos.includes('operacion_modificada'));assert.equal((await post('requisitos',reqBody(fin))).status,409);assert.equal(ok(await get('revisiones/'+review.id)).estadoRevision.satisfaccionActual,'requiere_revision');});
  await caso('Reconexión conserva unidad, versiones y evento por versión',async()=>{await mongoose.disconnect();await mongoose.connect(options.uri,{dbName:options.nombreBD});assert.equal(ok(await get('unidades-dp/'+fin.id)).version,fin.version);assert.equal(ok(await get('unidades-dp/'+fin.id+'/versiones')).versiones.length,fin.version);assert.equal(await E.countDocuments({registro_normativo:fin.id}),fin.version);});
 }});return resultados;
}
module.exports={comprobar};
