'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validar,contrato,entradaMotor}=require('../validation/deteccionEIPD');
const {preparar}=require('../validation/registroNormativo');
const {evaluarDeteccionDP}=require('../services/deteccionDP');
const {crearExtensionDeteccionEIPD,implementacion}=require('../services/expedienteDeteccionEIPD');
const {combinar}=require('../validation/contextoEmpresa');
const {huella}=require('../validation/aplicabilidadContextual');
const {fallo}=require('../services/datosOrganizacion');
const {deteccion,declarar}=require('./fixtures/deteccionEIPD');
const {ref,conocido}=require('./fixtures/unidadDP');
const O=require('../models/Operacion'),RO=require('../models/RevisionOperacion');
const key='eipd-persistente-prueba-0001';
const hechos=(rol='responsable')=>combinar([],['dp_ambito_rgpd','dp_regimen_general','dp_establecimiento_es','dp_entidad_privada'].map(k=>conocido(k,true)).concat(conocido('dp_rol',rol),conocido('dp_fase','prevista')),ref('d').id);
test('borrador guarda todos desconocidos sin defaults negativos',()=>{const d=deteccion();assert.deepEqual(validar(d),d);assert.equal(preparar('deteccion_eipd',d,key).clave,key);const input=entradaMotor(d,{hechos:hechos()});assert.equal(input.regimen,'pendiente');assert.equal(input.rol,'pendiente');assert.ok(contrato.campos.every(k=>input[k]==='desconocido'));});
for(const [name,change] of [
 ['rol navegador',d=>d.rol='responsable'],['regimen navegador',d=>d.regimen='rgpd_privado_es'],
 ['snapshot cliente',d=>d.calculo={resultado:'favorable'}],['atribución cliente',d=>d.atribucion={membresiaId:ref().id}],
 ['fecha imposible',d=>d.fechaEvaluacion='2026-02-30'],['datetime en fecha',d=>d.fechaEvaluacion='2026-10-16T00:00:00Z'],
 ['contexto omitido',d=>delete d.contextoOperacion],['declaración ausente',d=>delete d.declaraciones.granEscala],
 ['campo libre',d=>d.declaraciones.otro={}],['booleano coercible',d=>d.declaraciones.granEscala.estado=true],
 ['motivo vacío',d=>d.declaraciones.granEscala.motivo=''],['sin inventario',d=>d.declaraciones.granEscala.evidencias=[ref('e')]],
 ['evidencia duplicada',d=>d.evidencias=[ref('e'),ref('e')]],['ref inválida',d=>d.operacion.sha256='no'],
 ['confirmar en alta',d=>d.confirmarBases=true],['afirmación sin fundamento',d=>d.declaraciones.lista35_5.estado='si'],
 ['fundamento incompleto',d=>{declarar(d,'lista35_5','si');delete d.declaraciones.lista35_5.fundamento.localizador;}],
 ['fundamento futuro',d=>{declarar(d,'lista35_5','no');d.declaraciones.lista35_5.fundamento.fechaVersion='2026-10-17';}],
 ['hash evidencia distinto',d=>{d.evidencias=[ref('e')];d.declaraciones.granEscala.evidencias=[{...ref('e'),sha256:'f'.repeat(64)}];}]
])test('detección rechaza '+name,()=>{const d=deteccion();change(d);assert.throws(()=>preparar('deteccion_eipd',d,key),e=>e.codigo==='DATOS_INVALIDOS');});
for(const [rol,expected] of [['responsable','responsable'],['corresponsable_delimitado','responsable'],['encargado','encargado'],['subencargado_delimitado','encargado']])
 test('rol servidor '+rol,()=>{const d=deteccion();d.contextoOperacion='confirmado';const input=entradaMotor(d,{hechos:hechos(rol)});assert.equal(input.rol,expected);assert.equal(input.regimen,'rgpd_privado_es');const r=evaluarDeteccionDP({tipo:'eipd',fechaEvaluacion:d.fechaEvaluacion,entrada:input});assert.equal(r.satisfaccion,'no_evaluada');assert.equal(r.resultado.conformidad,null);if(expected==='encargado')assert.equal(r.resultado.estado,'asistencia_28_3_f');});
test('España y régimen general no suponen entidad privada; no/conflicto no se inventan',()=>{const d=deteccion();d.contextoOperacion='confirmado';const hs=hechos().filter(h=>h.clave!=='dp_entidad_privada');assert.equal(entradaMotor(d,{hechos:hs}).regimen,'pendiente');assert.equal(entradaMotor(d,{hechos:hs.concat(conocido('dp_entidad_privada',false))}).regimen,'otro');assert.equal(entradaMotor(d,{hechos:hs.concat({clave:'dp_entidad_privada',estado:'conflictivo',alternativas:[{valor:true},{valor:false}]})}).regimen,'pendiente');});
test('motivos/fundamentos quedan separados de hechos y no muta solicitud',()=>{const d=deteccion();declarar(d,'lista35_5','si');const before=structuredClone(d);validar(d);const input=entradaMotor(d,{hechos:hechos()});assert.equal(input.lista35_5,'si');assert.equal(Object.hasOwn(input,'fundamento'),false);assert.deepEqual(d,before);});
function fixture(t) {
 const org=ref('2').id,actor=ref('d').id,scope=ref('a'),op=ref('b').id;
 const contenido={nombre:'FICTICIA',descripcion:'Operación prevista',subespacioId:null,hechos:hechos()};
 const o={_id:op,organizacion:org,version_actual:1,nombre:contenido.nombre,descripcion:contenido.descripcion,subespacio:null};
 const ro={organizacion:org,operacion:op,numero:1,contenido,sha256:huella(contenido),createdAt:'2026-10-16T00:00:00.000Z'};
 t.mock.method(O,'findOne',f=>f.organizacion===org&&f._id===op?o:null);
 t.mock.method(RO,'findOne',f=>f.organizacion===org&&f.operacion===op?ro:null);
 const d=deteccion({id:op,version:1,sha256:ro.sha256},scope);d.contextoOperacion='confirmado';
 let stored=null,clock=new Date('2026-10-15T23:30:00.000Z'),scopeMotivos=[],evidenceScope=scope.id;
 const referencia=(h,v)=>({id:String(h._id),version:v.numero,sha256:v.sha256});
 const compararRef=(a,b)=>{if(huella(a)!==huella(b))fallo('VERSION_DESACTUALIZADA');};
 const evidence={h:{_id:ref('e').id},v:{numero:1,sha256:ref('e').sha256},evidencia:{alcanceIds:[scope.id]},motivos:[]};
 const svc=crearExtensionDeteccionEIPD({q:async x=>x,referencia,compararRef,
  registro:async()=>stored,alcance:async(o,r,s,strict)=>{if(o!==org)fallo('RECURSO_NO_DISPONIBLE');if(strict){compararRef(r,scope);if(scopeMotivos.length)fallo('VERSION_DESACTUALIZADA');}return {motivos:scopeMotivos,actual:scope,r:{contenido:{origen:{operaciones:[d.operacion]}}}};},
  evidenciaActual:async(o,r,s,strict)=>{if(o!==org||r.id!==String(evidence.h._id))fallo('RECURSO_NO_DISPONIBLE');if(strict)compararRef(r,referencia(evidence.h,evidence.v));return {...evidence,evidencia:{alcanceIds:[evidenceScope]}};},
  reloj:()=>clock});
 const ctx={contexto:{organizacionId:org,membresiaId:actor},session:null},h={_id:ref('c').id,tipo:'deteccion_eipd',organizacion:org,version_actual:1};
 return {org,d,o,ro,svc,ctx,h,scope,evidence,
  clock:v=>clock=new Date(v),scopeMotivos:v=>scopeMotivos=v,evidenceScope:v=>evidenceScope=v,
  store:built=>(stored={h,v:{numero:h.version_actual,contenido:built.contenido,sha256:huella(built.contenido)}})};
}
test('construye snapshot atribuido sin revisión favorable ni habilitación automática',async t=>{const f=fixture(t),before=structuredClone(f.d);const built=await f.svc.construir(validar(f.d),f.ctx,f.h,1);const c=built.contenido.deteccionEIPD;assert.deepEqual(f.d,before);assert.equal(c.atribucion.membresiaId,f.ctx.contexto.membresiaId);assert.equal(c.calculo.implementacion,implementacion);assert.equal(c.calculo.snapshot.resultado.estado,'pendiente_analisis');assert.equal(c.calculo.snapshot.satisfaccion,'no_evaluada');assert.ok(c.contextoResuelto.hechos.some(h=>h.clave==='dp_fase'&&h.valor==='prevista'));const row=f.store(built);const dto=await f.svc.estado(f.org,row.h,row.v,null);assert.equal(dto.vigencia.requiereRevision,false);assert.equal(dto.deteccion.eipdRealizada,false);assert.equal(dto.deteccion.declaracionesPendientes.length,16);assert.deepEqual(built.requisitoIds,[]);});
test('cambio operación/evidencia deja pendiente sin recalcular el snapshot histórico',async t=>{const f=fixture(t);f.d.evidencias=[ref('e')];const row=f.store(await f.svc.construir(validar(f.d),f.ctx,f.h,1)),before=structuredClone(row.v.contenido);f.o.version_actual=2;f.ro.numero=2;f.ro.contenido.hechos=hechos('encargado');f.ro.sha256=huella(f.ro.contenido);f.evidence.v.numero=2;const dto=await f.svc.estado(f.org,row.h,row.v,null);assert.deepEqual(dto.vigencia.motivos,['operacion_modificada','evidencia_modificada:'+ref('e').id]);assert.deepEqual(row.v.contenido,before);});
test('rebase explícito, no cambio de identidad ni confirmación espuria',async t=>{const f=fixture(t);f.store(await f.svc.construir(validar(f.d),f.ctx,f.h,1));await assert.rejects(()=>f.svc.construir({...f.d,version:1,operacion:{...f.d.operacion,id:ref('f').id}},f.ctx,f.h,2),e=>e.codigo==='DATOS_INVALIDOS');await assert.rejects(()=>f.svc.construir({...f.d,version:1,confirmarBases:true},f.ctx,f.h,2),e=>e.codigo==='DATOS_INVALIDOS');f.o.version_actual=2;f.ro.numero=2;const changed={...f.d,version:1,operacion:{...f.d.operacion,version:2}};await assert.rejects(()=>f.svc.construir(changed,f.ctx,f.h,2),e=>e.codigo==='DATOS_INVALIDOS');const next=await f.svc.construir({...changed,confirmarBases:true},f.ctx,f.h,2);assert.equal(next.contenido.deteccionEIPD.operacion.version,2);});
test('fecha Madrid acepta día actual tras medianoche local y rechaza futuro',async t=>{const f=fixture(t);await f.svc.construir(f.d,f.ctx,f.h,1);await assert.rejects(()=>f.svc.construir({...f.d,fechaEvaluacion:'2026-10-17'},f.ctx,f.h,1),e=>e.codigo==='DATOS_INVALIDOS');});
test('cambio de implementación o fuentes encapsuladas exige revisión sin recalcular historia',async t=>{const f=fixture(t),row=f.store(await f.svc.construir(f.d,f.ctx,f.h,1));row.v.contenido.deteccionEIPD.calculo.implementacion='0'.repeat(64);const before=structuredClone(row.v.contenido);const dto=await f.svc.estado(f.org,row.h,row.v,null);assert.deepEqual(dto.vigencia.motivos,['detector_modificado']);assert.deepEqual(row.v.contenido,before);});
test('paso del día solo advierte antigüedad editorial, no invalida el seguimiento',async t=>{const f=fixture(t),row=f.store(await f.svc.construir(f.d,f.ctx,f.h,1));const before=structuredClone(row.v.contenido);f.clock('2026-10-17T09:00:00Z');const dto=await f.svc.estado(f.org,row.h,row.v,null);assert.equal(dto.vigencia.requiereRevision,false);assert.deepEqual(dto.vigencia.motivos,[]);assert.equal(dto.actualidadFuentes.posteriorAlCorteEditorial,true);assert.equal(dto.actualidadFuentes.vigenciaJuridicaComprobadaAhora,false);assert.equal(dto.actualidadFuentes.fechaConsultaResultado,'2026-10-17');assert.equal(Object.hasOwn(dto.actualidadFuentes,'consultadasEn'),false);assert.deepEqual(row.v.contenido,before);});
test('referencias tenant/versión/evidencia fuera de alcance fallan cerradas',async t=>{const f=fixture(t);await assert.rejects(()=>f.svc.construir({...f.d,operacion:{...f.d.operacion,version:8}},f.ctx,f.h,1),e=>e.codigo==='VERSION_DESACTUALIZADA');await assert.rejects(()=>f.svc.construir(f.d,{...f.ctx,contexto:{...f.ctx.contexto,organizacionId:ref('9').id}},f.h,1),e=>e.codigo==='RECURSO_NO_DISPONIBLE');f.evidenceScope(ref('f').id);await assert.rejects(()=>f.svc.construir({...f.d,evidencias:[ref('e')]},f.ctx,f.h,1),e=>e.codigo==='RECURSO_NO_DISPONIBLE');});
test('vigencia del DTO identifica la versión actual aunque se consulte una histórica',async t=>{const f=fixture(t),built=await f.svc.construir(f.d,f.ctx,f.h,1);const old={numero:1,contenido:built.contenido};f.h.version_actual=2;const row=f.store(built);const dto=await f.svc.estado(f.org,row.h,old,null);assert.equal(dto.vigencia.seRefiereAVersionActual,2);assert.equal(dto.deteccion.seRefiereAVersionActual,2);});
