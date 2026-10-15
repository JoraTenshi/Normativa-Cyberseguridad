'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const D=require('../models/DecisionOperacion'), E=require('../models/EventoOrganizacion');
const {comprobarGuardada}=require('../services/decisionesOperacion');
const {validarFiltros}=require('../services/consultaActividad');
const {preparar}=require('../services/exportarActividad');
const {entrada}=require('./fixtures/aplicabilidadContextual');
const {evaluarAplicabilidadContextual}=require('../services/aplicabilidadContextual');
const {huella}=require('../validation/aplicabilidadContextual');
const oid='a'.repeat(24), org='b'.repeat(24);
function guardada(){
 const e=entrada(); e.organizacionId=org;e.contexto.organizacionId=org;
 e.contexto.id='ctx_op_'+oid;e.contexto.objeto={tipo:'operacion',id:oid};
 const resultado=evaluarAplicabilidadContextual(e);
 return {organizacion:org,operacion:oid,revision_contexto:oid,version_contexto:1,numero:1,
 regla_id:e.regla.id,version_regla:1,resultado,sha256:huella(resultado),actor:oid,membresia_actor:oid,
 motivo:'Prueba',clave_operacion:'operacion-decision-00001',huella_operacion:'c'.repeat(64)};
}
const cabecera=()=>({_id:oid,organizacion:org,version_actual:1});
test('decisión de operación tiene colección y referencias propias',()=>{
 const d=guardada();assert.equal(new D(d).validateSync(),undefined);
 assert.equal(D.collection.collectionName,'decisiones_operacion');
 assert.equal(D.schema.path('operacion').options.ref,'Operacion');
 assert.equal(D.schema.path('revision_contexto').options.ref,'RevisionOperacion');
 assert.equal(D.schema.path('contexto'),undefined);
 assert.equal(D.schema.path('clave_operacion').options.select,false);
 assert.equal(new D({...d,anterior:null}).validateSync(),undefined);
 assert.ok(new D({...d,anterior:'mal'}).validateSync());
 assert.throws(()=>new D({...d,contexto:oid}));
});
test('índices únicos de secuencia y reintento distintos del contexto general',()=>{
 const indices=D.schema.indexes();
 assert.ok(indices.some(([k,o])=>k.operacion===1&&k.numero===1&&o.unique));
 assert.ok(indices.some(([k,o])=>k.organizacion===1&&k.clave_operacion===1&&o.unique));
});
test('snapshot reproducible de operación aceptado',()=>assert.doesNotThrow(()=>comprobarGuardada(guardada(),cabecera())));
for(const [nombre,alterar] of [
 ['sha',d=>d.sha256='0'.repeat(64)],['version',d=>d.version_contexto=2],
 ['regla',d=>d.regla_id='OTRA'],['reglaVersion',d=>d.version_regla=2],
 ['resultado',d=>d.resultado.decision.estado='no_aplica']
]){
 test('rechaza incoherencia '+nombre,()=>{const d=guardada();alterar(d);
 assert.throws(()=>comprobarGuardada(d,cabecera()),e=>e.codigo==='SERVICIO_NO_DISPONIBLE');});
}
for(const campo of ['operacion','organizacion']){
 test('rechaza referencia ajena '+campo,()=>{const d=guardada();d[campo]='c'.repeat(24);
 assert.throws(()=>comprobarGuardada(d,cabecera()),e=>e.codigo==='RECURSO_NO_DISPONIBLE');});
}
for(const objeto of [{tipo:'operacion',id:'otra_operacion'},{tipo:'organizacion',id:org}]){
 test('rechaza snapshot reproducible con objeto incorrecto '+objeto.tipo,()=>{
 const d=guardada(),s=d.resultado.snapshot;s.contexto.objeto=objeto;
 d.resultado=evaluarAplicabilidadContextual({organizacionId:org,contexto:s.contexto,regla:s.regla,fechaEvaluacion:s.fechaEvaluacion});
 d.sha256=huella(d.resultado);
 assert.throws(()=>comprobarGuardada(d,cabecera()),e=>e.codigo==='SERVICIO_NO_DISPONIBLE');
 });
}
test('histórico con versión anterior sigue verificable',()=>assert.doesNotThrow(()=>comprobarGuardada(guardada(),{...cabecera(),version_actual:5})));
test('evento requiere decisión de operación y operación sin contexto general',async()=>{
 const base={organizacion:org,actor:oid,membresia_actor:oid,accion:'decision_operacion_creada',despues:{version:1}};
 await assert.rejects(new E(base).validate());
 const d={...base,operacion:oid,decision_operacion:oid};
 await assert.doesNotReject(new E(d).validate());
 for(const extra of [{contexto:oid},{decision:oid},{unidad:oid}])
 await assert.rejects(new E({...d,...extra}).validate());
 await assert.rejects(new E({...d,accion:'operacion_creada'}).validate());
});
test('filtro de decisión de operación no se confunde con decisión general',()=>{
 const f=validarFiltros({categoria:'decisiones_operacion',decisionOperacionId:oid,operacionId:oid});
 assert.equal(f.decisionOperacionId,oid);assert.equal(f.decisionId,undefined);
 assert.throws(()=>validarFiltros({decisionOperacionId:{$ne:'x'}}));
 assert.throws(()=>validarFiltros({categoria:'decisiones_aplicabilidad',accion:'decision_operacion_creada'}));
 assert.deepEqual(preparar({columnas:'operacionId,decisionOperacionId'}).elegidas,['operacionId','decisionOperacionId']);
});

test('entrada de demo no conecta Mongo al importarse ni modifica entorno',()=>{
  const mongoose=require('mongoose');
  const antes=process.env.JWT_SECRET;
  assert.equal(typeof require('../scripts/run-workspace-demo').main,'function');
  assert.equal(mongoose.connection.readyState,0);
  assert.equal(process.env.JWT_SECRET,antes);
});
test('app productiva no publica login/info de demo',async()=>{
  process.env.JWT_SECRET=require('node:crypto').randomBytes(32).toString('hex');
  process.env.TOTP_ENCRYPTION_KEY=require('node:crypto').randomBytes(32).toString('hex');
  process.env.APP_URL='https://localhost';
  const request=require('supertest'),app=require('../app').createApp({ rateLimits:false, politicaSesiones:'legado_pruebas' });
  assert.equal((await request(app).get('/demo/info')).status,404);
  assert.equal((await request(app).post('/demo/login').set('X-Requested-With','XMLHttpRequest').send({})).status,404);
  assert.equal((await request(app).get('/organizaciones/'+org+'/operaciones/'+oid+'/propuestas/rgpd28')).status,401);
  assert.equal((await request(app).get('/organizaciones/'+org+'/operaciones/'+oid+'/decisiones')).status,401);
});
