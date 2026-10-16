'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const f = require('./fixtures/alternativasRevision');
const legacy = require('./fixtures/revisionRequisito');
const { validarPaquete } = require('../validation/paqueteNormativo');
const { validarSujeto, validarDesignacion } = require('../validation/designacionFuncional');
const { crearRevisionRequisito: crear, vigenciaRevision, validarEvidencia } = require('../services/revisionRequisito');
const { preparar } = require('../validation/registroNormativo');
const key = 'clave_prueba_alternativas';
test('R3/contrato1 conserva hash y representación anterior sin rutas implícitas', () => {
  const r = crear(legacy.revisionHistorica()); assert.equal(r.schemaVersion, 1);
  assert.equal(r.sha256, '5cc52b6d1cc4b5c9fcd77e4cc8824d112ebe4d75bbc28f3eec5e0687144709d0');
  assert.equal(Object.hasOwn(r, 'ruta'), false);
  assert.throws(() => crear({ ...legacy.revision(), datos: { ...legacy.revision().datos, ruta: { id: 'A', motivo: 'B' } } }));
});
test('ficha2 no cambia aplicabilidad ni interpreta hechos de satisfacción como exclusión', () => {
  const x = f.revision(p => p.entrada.contexto.hechos.find(h=>h.clave==='via_ordinaria').valor=false);
  assert.equal(x.requisito.resultado.decision.estado, 'aplica'); assert.throws(()=>crear(x), /hechos_ruta_no_resueltos/);
});
for (const [nombre, cambiar] of [
  ['ruta duplicada', p => p.ficha.satisfaccion.rutas.push(p.ficha.satisfaccion.rutas[0])],
  ['criterio ausente', p => p.ficha.satisfaccion.rutas[0].requiereTodos.push('AJENO')],
  ['criterio duplicado', p => p.ficha.satisfaccion.rutas[0].requiereTodos.push('C1')],
  ['criterio huérfano', p => p.ficha.satisfaccion.rutas.pop()],
  ['ruta vacía', p => p.ficha.satisfaccion.rutas[0].requiereTodos=[]],
  ['hecho no declarado', p => p.ficha.satisfaccion.rutas[0].hechosRequeridos[0].clave='ajeno'],
  ['valor mal tipado', p => p.ficha.satisfaccion.rutas[0].hechosRequeridos[0].valor='true'],
  ['clave duplicada', p => p.ficha.satisfaccion.rutas[0].hechosRequeridos.push(p.ficha.satisfaccion.rutas[0].hechosRequeridos[0])],
  ['expresión inyectada', p => p.ficha.satisfaccion.rutas[0].eval='return true'],
  ['versión desconocida', p => p.ficha.schemaVersion=3],
  ['ruta en legacy', p => p.ficha.schemaVersion=1]
]) test('contrato cerrado rechaza '+nombre,()=>{const p=f.paquete();cambiar(p);assert.throws(()=>validarPaquete({ficha:p.ficha,regla:p.regla}));});
test('revisión explícita normal solo cuenta criterios de su ruta',()=>{
  const x=f.revision(), antes=structuredClone(x), r=crear(x);
  assert.equal(r.schemaVersion,2);assert.equal(r.ruta.id,'NORMAL');assert.equal(r.conclusion,'favorable');
  assert.deepEqual(r.criteriosFueraRuta,[{criterioId:'C3',estado:'no_exigido_por_ruta',motivo:'No forma parte de la alternativa seleccionada NORMAL'}]);
  assert.equal(r.ruta.hechos[0].estado,'coincide');assert.deepEqual(x,antes);
});
test('ruta alternativa completa explícita es válida, nunca elegida por máximo de favorables',()=>{
  const x=f.revision(p=>p.entrada.contexto.hechos.find(h=>h.clave==='via_ordinaria').valor=false);
  x.datos.ruta.id='ALTERNATIVA';x.datos.criterios[0].criterioId='C3';assert.equal(crear(x).conclusion,'favorable');
});
for(const [nombre, cambiar] of [
  ['sin ruta',x=>delete x.datos.ruta],['ruta inventada',x=>x.datos.ruta.id='EXENCION_MICRO'],
  ['sin motivo de selección',x=>x.datos.ruta.motivo=''],['mezcla de rutas',x=>x.datos.criterios[1].criterioId='C3'],
  ['criterio omitido',x=>x.datos.criterios.pop()],['criterio sobrante',x=>x.datos.criterios.push({...x.datos.criterios[0],criterioId:'C3'})],
  ['no procede libre',x=>x.datos.criterios[0].resultado='no_procede'],['compatibilidad desconocida',x=>x.datos.criterios[0].compatibilidad.estado='desconocida'],
  ['evidencia en conflicto',x=>x.datos.criterios[0].compatibilidad.estado='en_conflicto'],['compatibilidad omitida',x=>delete x.datos.criterios[0].compatibilidad],
  ['sin evidencia',x=>x.datos.criterios[0].evidenciaIds=[]],['sin motivo compatibilidad',x=>x.datos.criterios[0].compatibilidad.motivo='']
]) test('revisión v2 rechaza '+nombre,()=>{const x=f.revision();cambiar(x);assert.throws(()=>crear(x));});
for(const estado of ['ausente','desconocido','conflictivo']) test('hecho '+estado+' bloquea favorable sin falsear no aplica',()=>{
  const x=f.revision(p=>{const hs=p.entrada.contexto.hechos, i=hs.findIndex(h=>h.clave==='via_ordinaria');
    if(estado==='ausente')hs.splice(i,1);else hs[i]=estado==='desconocido'?{clave:'via_ordinaria',estado,motivo:'no_sabe'}:
      {clave:'via_ordinaria',estado,alternativas:[true,false].map(valor=>({valor,procedencia:{tipo:'declarado',referencia:'Test'}}))};});
  assert.equal(x.requisito.resultado.decision.estado,'aplica');assert.throws(()=>crear(x));
  x.datos.criterios.forEach(c=>c.resultado='no_determinado');x.datos.conclusion='no_determinado';
  assert.equal(crear(x).ruta.hechos[0].estado,estado==='conflictivo'?'en_conflicto':'desconocido');
});
test('no_determinado con compatibilidad conflictiva conserva explicación, no inventa favorable',()=>{
  const x=f.revision();x.datos.criterios[0].resultado=x.datos.conclusion='no_determinado';x.datos.criterios[0].compatibilidad.estado='en_conflicto';
  assert.equal(crear(x).conclusion,'no_determinado');
});
test('sujeto externo sin cuenta y varios titulares delimitados son válidos',()=>{
  assert.equal(validarSujeto(f.sujeto()).membresiaId,null);
  const d=f.designacion(), s=f.sujeto(93);d.titulares.push({sujeto:{id:s.id,version:1,sha256:f.huella({sujeto:s})},datosSujeto:s,delimitacion:'Parte B'});
  assert.equal(validarDesignacion(d).estado,'identificada');assert.equal(crear(f.conDesignacion()).conclusion,'favorable');
});
for(const [nombre, cambiar] of [
  ['sin titulares',d=>d.titulares=[]],['sin instrumento',d=>d.instrumentos=[]],['sin delimitación',d=>d.titulares[0].delimitacion=''],
  ['titular repetido',d=>d.titulares.push(d.titulares[0])],['sujeto forjado',d=>d.titulares[0].datosSujeto.nombre='Otro'],
  ['otra organización',d=>d.organizacionId=f.oid(999)],['periodo invertido',d=>d.periodo.hasta=d.periodo.desde],
  ['permiso inyectado',d=>d.rol='administrador']
]) test('designación rechaza '+nombre,()=>{const d=f.designacion();cambiar(d);assert.throws(()=>validarDesignacion(d));});
for(const estado of ['por_aclarar','en_conflicto']) test('designación '+estado+' no permite favorable',()=>assert.throws(()=>crear(f.conDesignacion(d=>{d.estado=estado;}))));
test('designación de otro sistema o periodo no cubre la revisión',()=>{
  assert.throws(()=>crear(f.conDesignacion(d=>d.objeto.id=f.oid(999))));
  assert.throws(()=>crear(f.conDesignacion(d=>d.periodo.desde='2026-10-15')));
});
test('PDF no suplanta soporte de designación y cambio conserva histórico',()=>{
  const x=f.revision();x.evidencias[0].tipo='designacion_versionada';assert.throws(()=>validarEvidencia(x.evidencias[0]));
  const e=f.conDesignacion(), r=crear(e);e.evidencias[0].soporte.designacion.motivoDelEstado='Actualizado';
  e.evidencias[0].soporte.referencia.sha256=f.huella({designacion:e.evidencias[0].soporte.designacion});
  const estado=vigenciaRevision({revision:r,requisitoActual:e.requisito,evidenciasActuales:e.evidencias,fechaConsulta:e.fechaRevision});
  assert.equal(estado.conclusionHistorica,'favorable');assert.equal(estado.requiereRevision,true);
});
test('HTTP no admite actor/rol/instantánea en sujetos ni instrumentos',()=>{
  const base={tipo:'persona',nombre:'Externa',procedenciaOrganizativa:'Cliente',membresiaId:null,motivo:'Registro'};
  assert.equal(preparar('sujeto_funcional',base,key).membresiaId,null);
  for(const k of ['rol','actor','organizacionId','id'])assert.throws(()=>preparar('sujeto_funcional',{...base,[k]:'invento'},key));
  assert.throws(()=>preparar('evidencia',{alcances:[],tipo:'designacion_versionada',titulo:'A',procedencia:'A',localizador:'A',periodo:{},
    soporte:{tipo:'designacion_versionada',referencia:{id:f.oid(91),version:1,sha256:'a'.repeat(64)},designacion:f.designacion()},motivo:'A'},key));
});
