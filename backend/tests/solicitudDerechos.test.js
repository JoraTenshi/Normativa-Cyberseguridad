'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {preparar}=require('../validation/registroNormativo');
const {validar,contrato}=require('../validation/solicitudDerechos');
const {crearExtensionDerechos,contextoComun}=require('../services/expedienteDerechos');
const {solicitud,pretension}=require('./fixtures/solicitudDerechos'),{ref,conocido}=require('./fixtures/unidadDP');
const {combinar}=require('../validation/contextoEmpresa');
const {catalogoNormativo}=require('../services/catalogoNormativoC2');
const H=require('../models/RegistroNormativo');
const key='solicitud-validacion-test';
test('admite recepción sin operación/alcance/persona identificados',()=>{const d=solicitud();assert.deepEqual(validar('solicitud_derechos',d),d);assert.equal(preparar('solicitud_derechos',d,key).clave,key);});
test('fecha civil no se convierte a instante; zona y motivo explícitos',()=>{const d=solicitud();d.recepcion={estado:'conocida',precision:'fecha_civil',instante:null,fecha:'2026-10-15',zona:'Europe/Madrid',motivo:'Constancia de entrada con fecha sin hora'};assert.equal(validar('solicitud_derechos',d).recepcion.instante,null);d.recepcion.instante='2026-10-15T00:00:00.000Z';assert.throws(()=>validar('solicitud_derechos',d));});
for(const [name,change]of [
 ['email en persona',d=>d.personaReferencia='someone@example.invalid'],['fecha inventada',d=>d.recepcion.fecha='2026-10-15'],['fecha inexistente',d=>d.recepcion={estado:'conocida',precision:'fecha_civil',instante:null,fecha:'2026-02-29',zona:'Europe/Madrid',motivo:'test'}],
 ['tipo ambiguo',d=>d.recepcion.precision='hoy'],['rol técnico',d=>d.hechos.push(conocido('dp_rol','administrador'))],['hecho ausente',d=>d.hechos=[]],['coerción',d=>d.hechos=[conocido('sol_expediente_delimitado','true')]],['borrador aprobado',d=>d.conclusion='favorable'],['fechaalta',d=>d.createdAt='2026-10-16'],['autoplazo',d=>d.vencimiento='2026-11-16'],['scope duplicado',d=>d.alcances=[ref(),ref()]],['falta canal',d=>delete d.canal]
])test('rechaza solicitud '+name,()=>{const d=solicitud();change(d);assert.throws(()=>preparar('solicitud_derechos',d,key),e=>e.codigo==='DATOS_INVALIDOS');});
test('pretensión independiente con derecho pendiente y estado no favorable',()=>{assert.deepEqual(validar('pretension_derecho',pretension()),pretension());for(const derecho of contrato.derechos)validar('pretension_derecho',{...pretension(),derecho});for(const estadoGestion of contrato.pretension.estadosGestion)validar('pretension_derecho',{...pretension(),estadoGestion});assert.throws(()=>validar('pretension_derecho',{...pretension(),estadoGestion:'cumplido'}));});
test('no acepta fecha de recepción distinta en pretensión',()=>assert.throws(()=>validar('pretension_derecho',{...pretension(),recepcion:solicitud().recepcion})));
test('PADRE: roles mezclados o desconocidos no se eligen por mayoría',()=>{
 const ctx=rol=>({hechos:combinar([],['dp_ambito_rgpd','dp_establecimiento_es','dp_regimen_general'].map(k=>conocido(k,true)).concat(conocido('dp_rol',rol)),ref('d').id)});
 assert.equal(contextoComun([ctx('responsable'),ctx('encargado')],true).find(h=>h.clave==='dp_rol').estado,'desconocido');
 assert.equal(contextoComun([ctx('responsable'),{hechos:[]}],true).find(h=>h.clave==='dp_rol').estado,'desconocido');
 assert.ok(contextoComun([ctx('responsable')],false).every(h=>h.estado==='desconocido'));
 assert.equal(contextoComun([ctx('responsable'),ctx('responsable')],true).find(h=>h.clave==='dp_rol').valor,'responsable');
});
function deps(old){return {alcance:async()=>{throw Error('NO_REFERENCIA_ESPERADA');},registro:async()=>({h:{_id:ref('e').id,version_actual:1},v:{contenido:{solicitudDerechos:old}}}),referenciado:async()=>{throw Error('NO_REFERENCIA_ESPERADA');},evidenciaActual:async()=>{throw Error('NO_EVIDENCIA_ESPERADA');},referencia:()=>ref('e'),compararRef:()=>{},q:async x=>x,reloj:()=>new Date('2026-10-16T10:00:00.000Z')};}
const ctx={contexto:{organizacionId:ref().id,membresiaId:ref('d').id},session:null},header={_id:ref('e').id};
test('servicio crea solicitud sin inventar recepción, operación ni persona',async()=>{const svc=crearExtensionDerechos(deps());const r=await svc.construir('solicitud_derechos',validar('solicitud_derechos',solicitud()),ctx,header,1);assert.equal(r.titulo,'Solicitud de derechos');assert.equal(r.contenido.solicitudDerechos.recepcion.estado,'pendiente');assert.equal(r.contenido.solicitudDerechos.personaReferencia,null);assert.deepEqual(r.alcanceIds,[]);});
test('recepción futura rechazada, no cambiada al reloj del servidor',async()=>{const d=solicitud();d.recepcion={estado:'conocida',precision:'instante',instante:'2026-10-17T10:00:00.000Z',fecha:null,zona:'Europe/Madrid',motivo:'test'};await assert.rejects(()=>crearExtensionDerechos(deps()).construir('solicitud_derechos',d,ctx,header,1),/recepcion_futura/);});
test('corregir recepción exige confirmación; no se acepta opt-in sin cambio',async()=>{
 const original=solicitud(),svc=crearExtensionDerechos(deps(original)),d={...solicitud(),version:1};
 d.recepcion={estado:'conocida',precision:'fecha_civil',instante:null,fecha:'2026-10-14',zona:'Europe/Madrid',motivo:'Acta de recepción revisada'};
 await assert.rejects(()=>svc.construir('solicitud_derechos',d,ctx,header,2),/confirmacion_recepcion/);
 const r=await svc.construir('solicitud_derechos',{...d,confirmarRecepcion:true},ctx,header,2);assert.equal(r.contenido.solicitudDerechos.recepcion.fecha,'2026-10-14');assert.equal(original.recepcion.estado,'pendiente');
 await assert.rejects(()=>svc.construir('solicitud_derechos',{...solicitud(),confirmarRecepcion:true},ctx,header,2),/confirmacion_recepcion/);
});
test('DTO de admisión sin pretensiones no devuelve cumplimiento ni vencimiento inventado',async t=>{
 t.mock.method(H,'find',()=>({sort(){return this;},limit(){return [];}}));
 const r=await crearExtensionDerechos(deps()).estado(ref().id,{...header,tipo:'solicitud_derechos',version_actual:1},{numero:1,contenido:{solicitudDerechos:solicitud()}},null);
 assert.equal(r.gestionDerechos.vencimiento,'no_calculado');assert.equal(r.gestionDerechos.satisfaccionAutomatica,false);assert.deepEqual(r.gestionDerechos.pretensiones,[]);
});
test('catálogo procedimiento exige solicitud real; no declara criterios sustantivos integrados',()=>{const p=catalogoNormativo.obtener('RGPD12_SOLICITUD_DERECHOS');assert.equal(p.ficha.version,2);assert.deepEqual(p.regla.tiposObjeto,['solicitud_derechos']);assert.equal(p.ficha.criterios.length,18);assert.equal(catalogoNormativo.obtener('RGPD20_PORTABILIDAD'),null);});
test('contexto procedimental cuenta versiones de pretensiones y bloquea vacío/truncado',async t=>{
 const {huella}=require('../validation/aplicabilidadContextual'),O=require('../models/Operacion'),RO=require('../models/RevisionOperacion');
 const contenido={nombre:'Fixture',descripcion:'Fixture',subespacioId:null,hechos:combinar([],['dp_ambito_rgpd','dp_establecimiento_es','dp_regimen_general'].map(k=>conocido(k,true)).concat(conocido('dp_rol','responsable')),ref('d').id)};
 const o={_id:ref('b').id,organizacion:ref().id,nombre:contenido.nombre,descripcion:contenido.descripcion,subespacio:null,version_actual:1};
 const ro={operacion:o._id,organizacion:o.organizacion,numero:1,contenido,sha256:huella(contenido),createdAt:'2026-10-16T00:00:00.000Z'},op={id:o._id,version:1,sha256:ro.sha256};
 t.mock.method(O,'findOne',filter=>filter.organizacion===ref().id&&filter._id===op.id?o:null);t.mock.method(RO,'findOne',()=>ro);
 const s={...solicitud(),personaReferencia:'persona_fixture_001',operaciones:[op],alcances:[ref()],contextoOperacion:'confirmado',inventarioPretensionesCompleto:true,canal:{estado:'conocido',contenido:'Test',motivo:''},recepcion:{estado:'conocida',precision:'fecha_civil',fecha:'2026-10-15',instante:null,zona:'Europe/Madrid',motivo:'Test'},hechos:combinar([],[conocido('sol_expediente_delimitado',true)],ref('d').id)};
 const parent={h:{_id:ref('e').id,version_actual:1},v:{numero:1,sha256:huella(s),createdAt:'2026-10-16T00:00:00.000Z',contenido:{solicitudDerechos:s}}},parentRef={id:parent.h._id,version:1,sha256:parent.v.sha256};
 const child={h:{_id:ref('f').id,version_actual:1},v:{numero:1,sha256:'f'.repeat(64),contenido:{pretensionDerecho:{...pretension(),solicitud:parentRef,operacion:op,alcance:ref(),derecho:'acceso'}}}};
 let heads=[];t.mock.method(H,'find',()=>({sort(){return this;},limit(){return heads;}}));
 const ar={actual:ref(),motivos:[],r:{contenido:{origen:{operaciones:[op]}}}};
 const deps2={...deps(),alcance:async()=>ar,registro:async(org,tipo)=>tipo==='solicitud_derechos'?parent:child,referenciado:async()=>parent,compararRef:(a,b)=>assert.deepEqual(a,b),referencia:(h,v)=>({id:h._id,version:v.numero,sha256:v.sha256})};
 const svc=crearExtensionDerechos(deps2),obj={tipo:'solicitud_derechos',id:parent.h._id,version:1};
 const vacio=await svc.contexto(ref().id,obj,ar,null);assert.equal(vacio.contexto.hechos.find(h=>h.clave==='sol_expediente_delimitado').estado,'desconocido');
 heads=[child.h];const completo=await svc.contexto(ref().id,obj,ar,null);assert.equal(completo.contexto.hechos.find(h=>h.clave==='sol_expediente_delimitado').valor,true);assert.notEqual(completo.objetoSha256,vacio.objetoSha256);
 child.v.numero=2;child.v.sha256='a'.repeat(64);child.h.version_actual=2;const cambiado=await svc.contexto(ref().id,obj,ar,null);assert.notEqual(cambiado.objetoSha256,completo.objetoSha256);
 heads=Array.from({length:101},()=>child.h);assert.equal((await svc.contexto(ref().id,obj,ar,null)).contexto.hechos.find(h=>h.clave==='sol_expediente_delimitado').estado,'desconocido');
});
