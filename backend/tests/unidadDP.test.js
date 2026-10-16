'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {contrato,validar,contextoUnidad,datos}=require('../validation/unidadDP');
const {preparar}=require('../validation/registroNormativo');
const {combinar}=require('../validation/contextoEmpresa');
const {catalogoNormativo}=require('../services/catalogoNormativoC2');
const {evaluarAplicabilidadContextual}=require('../services/aplicabilidadContextual');
const {unidad,ref,conocido}=require('./fixtures/unidadDP');
const k='unidades-prueba-0001';
const padre={hechos:combinar([],['dp_ambito_rgpd','dp_establecimiento_es','dp_regimen_general'].map(k=>conocido(k,true)).concat([conocido('dp_rol','responsable'),conocido('dp_fase','activa')]),ref('c').id)};
const ctx=c=>({id:'ctx_unidad',version:1,organizacionId:ref().id,objeto:{tipo:c.clase,id:ref('d').id},registradoEn:'2026-10-16T00:00:00.000Z',hechos:contextoUnidad(datos(c,ref('c').id),padre).hechos});
function decision(c){const id={finalidad_tratamiento:'RGPD6_7_LICITUD_FINALIDAD',flujo_transferencia:'RGPD44_49_TRANSFERENCIA_FLUJO',unidad_informativa:'RGPD12_14_TRANSPARENCIA_UNIDAD'}[c.clase];return evaluarAplicabilidadContextual({organizacionId:ref().id,regla:catalogoNormativo.obtener(id).regla,contexto:ctx(c),fechaEvaluacion:'2026-10-16T00:00:00.000Z'}).decision;}
for(const clase of Object.keys(contrato.clases))test('unidad cerrada y borrador '+clase,()=>{
 const d=unidad(clase);assert.deepEqual(validar(d),d);assert.equal(preparar('unidad_dp',d,k).clave,k);
 d.contextoOperacion='pendiente';for(const c of Object.values(d.campos)){c.estado='pendiente';c.contenido='';c.motivo='Por consultar';}
 validar(d);assert.equal(decision(d).habilitaEvaluacion,false);
});
for(const [nombre,change]of [
 ['tipo bool',d=>d.hechos[0].valor='true'],['enum',d=>d.hechos[1].valor='consentimiento'],
 ['herencia falsa',d=>d.hechos.push(conocido('dp_rol','responsable'))],['incompleto',d=>d.hechos.pop()],
 ['duplicate',d=>d.hechos.push({...d.hechos[0]})],['favorable',d=>d.aprobado=true],
 ['campo libre',d=>d.campos.aprobado=true],['falta campo',d=>delete d.campos.datos],
 ['sin motivo pendiente',d=>d.campos.datos={estado:'pendiente',contenido:'',motivo:''}],
 ['ref falsa',d=>d.operacion.sha256='hash'],['baseconfirmcreate',d=>d.confirmarBases=true],
 ['relación prohibida',d=>d.relaciones=[ref('c')]],['proveniencia cliente',d=>d.hechos[0].procedencia={tipo:'revisado',referencia:'falsa'}]
])test('rechaza '+nombre,()=>{const d=unidad();change(d);assert.throws(()=>preparar('unidad_dp',d,k),e=>e.codigo==='DATOS_INVALIDOS');});
test('conflictos tipados y desconocidos preservados sin defaults',()=>{const d=unidad();d.hechos=[{clave:'lic_finalidad_delimitada',estado:'desconocido',motivo:'no_sabe'},{clave:'lic_base6',estado:'conflictivo',alternativas:[{valor:'a'},{valor:'f'}]}];validar(d);const h=datos(d,ref('c').id).hechos;assert.equal(h.find(x=>x.clave==='lic_base6').estado,'conflictivo');assert.equal(decision(d).habilitaEvaluacion,false);});
test('padre no confirmado o desconocido no hereda valores ni permite evaluar',()=>{const d=unidad();d.contextoOperacion='pendiente';assert.equal(decision(d).habilitaEvaluacion,false);assert.ok(contextoUnidad(datos(d,ref('c').id),padre).hechos.filter(h=>h.clave.startsWith('dp_')).every(h=>h.estado==='desconocido'));});
test('delimitado true no oculta datos pendientes y no muta declaración',()=>{const d=unidad();d.campos.datos={estado:'pendiente',contenido:'',motivo:'Falta inventario'};const c=datos(d,ref('c').id);assert.equal(contextoUnidad(c,padre).hechos.find(h=>h.clave==='lic_finalidad_delimitada').estado,'desconocido');assert.equal(c.hechos.find(h=>h.clave==='lic_finalidad_delimitada').valor,true);assert.equal(decision(d).habilitaEvaluacion,false);});
test('finalidad/flujo habilitan examen, nunca favorable automático',()=>{for(const clase of Object.keys(contrato.clases)){const r=decision(unidad(clase));assert.equal(r.habilitaEvaluacion,true);assert.notEqual(r.resultado,'favorable');}});
test('v2 deriva solo tipo y versiones, preservando criterio editorial y sourcehash',()=>{
 const manifest=require('../contracts/unidadDP-procedencia.v1.json');
 for(const p of manifest.paquetes){const raw=fs.readFileSync(path.join(__dirname,'fixtures','editorial',p.id+'.v1.json'));assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),p.sourceSha256);const original=JSON.parse(raw),nuevo=require('../catalogo/c2/'+p.id+'.v2.json');const expected=structuredClone(original);expected.ficha.version=2;expected.ficha.versionRegla=2;expected.ficha.sustituyeVersionPreparacion=1;expected.regla.version=2;expected.regla.tiposObjeto=[p.clase];assert.deepEqual(nuevo,expected);assert.deepEqual(catalogoNormativo.obtener(p.id).regla.tiposObjeto,[p.clase]);}
});
