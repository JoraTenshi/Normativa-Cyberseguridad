'use strict';
// Preparado, NO ejecutado por importar. Solo nueva BD sintética aislada del QA UI.
const {comprobar:fixture}=require('./check-rat-mongo');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),request=require('supertest'),jwt=require('jsonwebtoken'),mongoose=require('mongoose');
const {createApp}=require('../app'),{deteccion,declarar}=require('../tests/fixtures/deteccionEIPD');
const {conocido,confirmacion}=require('../tests/fixtures/nexoSoftware');
const H=require('../models/RegistroNormativo'),V=require('../models/VersionRegistroNormativo'),E=require('../models/EventoOrganizacion');
async function comprobar(options) {
 const casos=[],caso=async(n,fn)=>{await fn();casos.push(n);console.log('OK '+n);};
 await fixture({...options,prepararUI:async seed=>{
  const app=createApp({rateLimits:false,politicaSesiones:'legado_pruebas'}),base='/organizaciones/'+seed.organizationId,key=()=>crypto.randomUUID();
  const api=(m,path,user='admin')=>request(app)[m](base+path).set('Cookie','cyberaudit_token='+jwt.sign({id:seed.members[user].usuarioId,jti:key(),sessionVersion:0},process.env.JWT_SECRET,{expiresIn:'30m'})).set('X-Requested-With','XMLHttpRequest');
  const get=(p,user='admin')=>api('get','/normativa/'+p,user),post=(p,d,user='admin',k=key())=>api('post','/normativa/'+p,user).set('Idempotency-Key',k).send(d),patch=(p,d,k=key())=>api('patch','/normativa/'+p).set('Idempotency-Key',k).send(d);
  const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.body));return r.body.data;};
  const snap=async()=>JSON.stringify({h:await H.find().sort({_id:1}).lean(),v:await V.find().sort({_id:1}).lean(),e:await E.find().sort({_id:1}).lean()});
  const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const initial={...deteccion(seed.operaciones[0],seed.alcance),contextoOperacion:'confirmado',fechaEvaluacion:hoy};let row,body;
  await caso('Contrato y autorización aislada de organización; anónimo y otros roles denegados',async()=>{
   assert.equal(ok(await get('detecciones-eipd/contrato')).contrato.tipo,'deteccion_eipd');
   assert.equal((await request(app).get(base+'/normativa/detecciones-eipd/contrato')).status,401);
   for(const u of ['consulta','colaborador','ajeno']){assert.equal((await get('detecciones-eipd/contrato',u)).status,403);assert.equal((await post('detecciones-eipd',initial,u)).status,403);}
  });
  await caso('Persistencia sin dato privado conserva cobertura pendiente, no falsa exención',async()=>{
   row=ok(await post('detecciones-eipd',initial),201);assert.equal(row.contenido.deteccionEIPD.contextoResuelto.regimen,'pendiente');assert.equal(row.contenido.deteccionEIPD.calculo.snapshot.resultado.estado,'pendiente_ambito_rol');assert.equal(row.deteccion.eipdRealizada,false);assert.equal(row.permisos.revisar,false);
  });
  await caso('Payload forjado y referencias falsas no escriben versiones ni auditoría',async()=>{
   const before=await snap();for(const d of [{...initial,rol:'responsable'},{...initial,calculo:{resultado:'favorable'}},{...initial,operacion:{...initial.operacion,sha256:'0'.repeat(64)}},{...initial,operacion:{...initial.operacion,id:seed.ratResponsable.id}}])assert.ok([400,404,409].includes((await post('detecciones-eipd',d)).status));assert.equal(await snap(),before);
  });
  await caso('Tratamiento previsto privado, alcance actualizado y motivo de alto riesgo conservados',async()=>{
   const o=ok(await api('patch','/operaciones/'+seed.operaciones[0].id).set('Idempotency-Key',key()).send({version:1,cambios:[conocido('dp_entidad_privada',true),conocido('dp_fase','prevista')],motivo:'Calificación FICTICIA de cobertura'}));
   const prev=ok(await get('detecciones-eipd/'+row.id));assert.equal(prev.vigencia.requiereRevision,true);
   const proposal=ok(await api('get','/contexto/propuestas'));
   const mat=ok(await api('post','/contexto/materializaciones').set('Idempotency-Key',key()).send(confirmacion(proposal)),201);
   const scopes=await Promise.all(mat.alcances.map(a=>api('get','/alcances/'+a.id).then(ok))),scope=scopes.find(a=>a.contenido.origen.operaciones.some(x=>x.id===o.operacion.id));assert.ok(scope);
   body={...deteccion({id:o.operacion.id,version:o.revision.numero,sha256:o.revision.sha256},{id:scope.id,version:scope.revision.numero,sha256:scope.revision.sha256}),contextoOperacion:'confirmado',fechaEvaluacion:hoy};
   declarar(body,'altoRiesgoProbable','si');row=ok(await post('detecciones-eipd',body),201);
   assert.equal(row.contenido.deteccionEIPD.contextoResuelto.regimen,'rgpd_privado_es');assert.equal(row.contenido.deteccionEIPD.calculo.snapshot.resultado.estado,'indicios_obligacion_excepcion_pendiente');assert.equal(row.deteccion.eipdRealizada,false);
  });
  await caso('Concurrencia CAS conserva un ganador y no pisa el otro borrador',async()=>{
   const d={...body,version:row.version},responses=await Promise.all([patch('detecciones-eipd/'+row.id,{...d,motivoContexto:'Cambio A'}),patch('detecciones-eipd/'+row.id,{...d,motivoContexto:'Cambio B'})]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);row=ok(responses.find(r=>r.status===200));
  });
  await caso('Reintento exacto no duplica y reutilización distinta se rechaza',async()=>{
   const k=key(),d={...body,version:row.version};row=ok(await patch('detecciones-eipd/'+row.id,d,k));const before=await snap();assert.equal(ok(await patch('detecciones-eipd/'+row.id,d,k)).repetida,true);assert.equal((await patch('detecciones-eipd/'+row.id,{...d,motivo:'Otro'},k)).status,409);assert.equal(await snap(),before);
  });
  await caso('Auditoría fallida revierte cabecera, versión y resultado',async()=>{
   const before=await snap(),original=E.create;E.create=async()=>{throw Error('SYNTHETIC_AUDIT_FAILURE');};try{assert.equal((await patch('detecciones-eipd/'+row.id,{...body,version:row.version})).status,503);}finally{E.create=original;}assert.equal(await snap(),before);
  });
  await caso('Historia mantiene snapshot exacto y eventos generales sin fundamentos narrativos',async()=>{
   assert.equal(ok(await get('detecciones-eipd/'+row.id+'/versiones')).versiones.length,row.version);const first=ok(await get('detecciones-eipd/'+row.id+'/versiones/1'));assert.equal(first.contenido.deteccionEIPD.declaraciones.altoRiesgoProbable.estado,'si');assert.equal(first.deteccion.seRefiereAVersionActual,row.version);const ev=await E.find({registro_normativo:row.id}).lean();assert.equal(ev.length,row.version);assert.ok(!JSON.stringify(ev).includes(body.declaraciones.altoRiesgoProbable.motivo));assert.equal((await get('detecciones-eipd/'+row.id,'ajeno')).status,403);
  });
  await caso('Reconexión conserva contenido, hash, versiones y atribución',async()=>{
   const before=ok(await get('detecciones-eipd/'+row.id));await mongoose.disconnect();await mongoose.connect(options.uri,{dbName:options.nombreBD});const after=ok(await get('detecciones-eipd/'+row.id));assert.deepEqual(after.contenido,before.contenido);assert.deepEqual(after.referencia,before.referencia);assert.equal(after.contenido.deteccionEIPD.atribucion.membresiaId,seed.members.admin.membresiaId);
  });
 }});return casos;
}
module.exports={comprobar};
