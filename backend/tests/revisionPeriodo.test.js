'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { contextualizarRequisito, crearRevisionRequisito, vigenciaRevision } = require('../services/revisionRequisito');
const { evaluarAplicabilidadContextual } = require('../services/aplicabilidadContextual');
const { periodo: periodoRegla, periodoCobertura } = require('../services/calendarioAplicabilidad');
const { oid } = require('./fixtures/revisionRequisito');
const { huella } = require('../validation/aplicabilidadContextual');
const paquete = require('../catalogo/c2/ENS_POLITICA_SEGURIDAD.v3.json');
function escenario(desde='2026-10-14',hasta='2026-10-15',instante='2026-10-14T14:13:18.000Z') {
  const org=oid(1), periodo={desde,hasta,calendario:'gregoriano',jurisdiccion:'ES',zonaEvaluacion:'Europe/Madrid'};
  const contexto={id:'CTX_PERIODO_R3',version:1,organizacionId:org,objeto:{tipo:'sistema',id:'SISTEMA_FICTICIO'},registradoEn:instante,
    hechos:Object.entries(paquete.casosAplicabilidad.base).map(([clave,valor])=>({clave,valor,estado:'conocido',procedencia:{tipo:'declarado',referencia:'prueba-sintetica'}}))};
  const resultado=evaluarAplicabilidadContextual({organizacionId:org,contexto,regla:paquete.regla,fechaEvaluacion:instante});
  const requisito=contextualizarRequisito({id:oid(2),version:1,organizacionId:org,alcance:{id:oid(3),version:1,sha256:'a'.repeat(64)},decisionId:oid(4),resultado,ficha:paquete.ficha});
  const evidencias=[{id:oid(5),version:1,organizacionId:org,alcanceIds:[oid(3)],tipo:'version_documento',titulo:'Ficticio',procedencia:'Prueba',localizador:'p1',periodo,
    soporte:{tipo:'version_documento',documentoId:oid(6),versionDocumentoId:oid(7),numero:1,sha256:'b'.repeat(64)}}];
  const revision=crearRevisionRequisito({id:oid(8),version:1,requisito,ficha:paquete.ficha,evidencias,fechaRevision:instante,
    permiso:{usuarioId:oid(9),membresiaId:oid(10),organizacionId:org,rol:'administrador'},
    datos:{requisito:{id:requisito.id,version:requisito.version,sha256:requisito.sha256},tipo:'interna',periodo,
      criterios:paquete.ficha.criterios.map(c=>({criterioId:c.id,resultado:'favorable',motivo:'Conclusión ficticia de prueba',evidenciaIds:[oid(5)]})),conclusion:'favorable',motivo:'Prueba no jurídica'}});
  return {revision,requisitoActual:requisito,evidenciasActuales:evidencias};
}
for (const [instante,estado,cubre] of [
  ['2026-10-13T21:59:59.999Z','antes_del_periodo',false],
  ['2026-10-13T22:00:00.000Z','dentro_del_periodo',true],
  ['2026-10-14T14:13:18.000Z','dentro_del_periodo',true],
  ['2026-10-14T21:59:59.999Z','dentro_del_periodo',true],
  ['2026-10-14T22:00:00.000Z','despues_del_periodo',false],
  ['2026-10-20T12:00:00.000Z','despues_del_periodo',false]
]) test('R3 periodo factual inclusivo/exclusivo '+instante,()=>{
  const e=escenario(), antes=structuredClone(e), r=vigenciaRevision({...e,fechaConsulta:instante});
  assert.equal(periodoRegla(paquete.regla,instante),'en_periodo');assert.equal(periodoCobertura(paquete.regla,instante),'en_periodo');
  assert.equal(r.coberturaPeriodo.estado,estado);assert.equal(r.coberturaPeriodo.cubreFechaConsulta,cubre);
  assert.equal(r.conclusionHistorica,'favorable');assert.deepEqual(e,antes);
  assert.deepEqual(r.avisosCobertura,cubre?[]:['fecha_consulta_fuera_del_periodo_revisado']);
  assert.equal(r.motivos.includes('fecha_consulta_fuera_del_periodo_revisado'),false);
  if(instante<e.revision.fechaRevision){assert.equal(r.satisfaccionActual,'requiere_revision');assert.equal(r.requiereRevision,true);assert.ok(r.motivos.includes('reloj_anterior_revision'));}
  else {assert.equal(r.satisfaccionActual,cubre?'favorable':'fuera_del_periodo_revisado');assert.equal(r.requiereRevision,false);assert.deepEqual(r.motivos,[]);}
});
for(const [desde,hasta,inicio,ultimo,fin,horas] of [
  ['2026-10-25','2026-10-26','2026-10-24T22:00:00.000Z','2026-10-25T22:59:59.999Z','2026-10-25T23:00:00.000Z',25],
  ['2027-03-28','2027-03-29','2027-03-27T23:00:00.000Z','2027-03-28T21:59:59.999Z','2027-03-28T22:00:00.000Z',23]
]) test('periodo factual respeta cambio horario de '+horas+' horas',()=>{
  const e=escenario(desde,hasta,inicio);assert.equal((Date.parse(fin)-Date.parse(inicio))/3600000,horas);
  for(const f of [inicio,ultimo])assert.equal(vigenciaRevision({...e,fechaConsulta:f}).satisfaccionActual,'favorable');
  const r=vigenciaRevision({...e,fechaConsulta:fin});assert.equal(r.coberturaPeriodo.cubreFechaConsulta,false);assert.equal(r.satisfaccionActual,'fuera_del_periodo_revisado');
  assert.equal(r.requiereRevision,false);assert.deepEqual(r.motivos,[]);assert.deepEqual(r.avisosCobertura,['fecha_consulta_fuera_del_periodo_revisado']);
});
test('cobertura factual e integridad de evidencia son condiciones independientes',()=>{
  const e=escenario();e.evidenciasActuales[0].version=2;
  let r=vigenciaRevision({...e,fechaConsulta:'2026-10-14T16:00:00.000Z'});assert.equal(r.coberturaPeriodo.cubreFechaConsulta,true);
  assert.equal(r.satisfaccionActual,'requiere_revision');assert.ok(r.motivos.some(x=>x.startsWith('evidencia_modificada')));
  r=vigenciaRevision({...e,fechaConsulta:'2026-10-20T12:00:00.000Z'});assert.equal(r.coberturaPeriodo.cubreFechaConsulta,false);
  assert.deepEqual(r.avisosCobertura,['fecha_consulta_fuera_del_periodo_revisado']);assert.ok(r.motivos.some(x=>x.startsWith('evidencia_modificada')));
  assert.equal(r.requiereRevision,true);assert.equal(r.satisfaccionActual,'requiere_revision');
});

test('TEMP-01 permite registrar un periodo pasado sin exigir repetirlo ni modificar su histórico',()=>{
  const e=escenario('2026-10-14','2026-10-15','2026-10-16T10:00:00.000Z'),antes=structuredClone(e);
  const r=vigenciaRevision({...e,fechaConsulta:e.revision.fechaRevision});
  assert.equal(r.satisfaccionActual,'fuera_del_periodo_revisado');assert.equal(r.requiereRevision,false);
  assert.equal(r.conclusionHistorica,'favorable');assert.deepEqual(e,antes);
});
for(const [desde,hasta] of [['2026-10-15','2026-10-16'],['2026-10-14','2026-10-16']])
  test('TEMP-01 sigue rechazando hechos futuros '+desde+' '+hasta,()=>{
    assert.throws(()=>escenario(desde,hasta),/periodo_futuro/);
  });
for(const conclusion of ['favorable','desfavorable','no_determinado'])
  test('TEMP-01 conserva conclusión '+conclusion+' sin proyectarla fuera del periodo',()=>{
    const e=escenario();const {sha256,...base}=e.revision;
    // Snapshot sintético coherente; no modificación de registros persistidos.
    base.conclusion=conclusion;base.criterios=base.criterios.map(c=>({...c,resultado:conclusion}));
    e.revision={...base,sha256:huella(base)};
    const antes=structuredClone(e);
    const r=vigenciaRevision({...e,fechaConsulta:'2026-10-15T10:00:00.000Z'});
    assert.equal(r.conclusionHistorica,conclusion);assert.equal(r.satisfaccionActual,'fuera_del_periodo_revisado');
    assert.equal(r.requiereRevision,false);assert.deepEqual(r.motivos,[]);assert.deepEqual(e,antes);
  });
for(const [nombre,cambiar,motivo] of [
  ['evidencia retirada',e=>{e.evidenciasActuales=[];},'evidencia_no_disponible:'],
  ['requisito actualizado',e=>{const {sha256,...base}=e.requisitoActual;base.version++;e.requisitoActual={...base,sha256:huella(base)};},'requisito_o_fundamento_modificado'],
  ['fundamento no evaluable',e=>{
    const {sha256,...base}=e.requisitoActual;
    const contexto=structuredClone(base.resultado.snapshot.contexto);contexto.version++;
    contexto.hechos.find(h=>h.clave==='cliente_sector_publico_es').valor=false;
    base.resultado=evaluarAplicabilidadContextual({organizacionId:base.organizacionId,contexto,
      regla:paquete.regla,fechaEvaluacion:e.revision.fechaRevision});
    base.version++;e.requisitoActual={...base,sha256:huella(base)};
  },'evaluacion_no_habilitada']
])test('TEMP-01 fuera del periodo no oculta '+nombre,()=>{
  const e=escenario();cambiar(e);const antes=structuredClone(e);
  const r=vigenciaRevision({...e,fechaConsulta:'2026-10-15T10:00:00.000Z'});
  assert.equal(r.requiereRevision,true);assert.equal(r.satisfaccionActual,'requiere_revision');
  assert.ok(r.motivos.some(m=>m.startsWith(motivo)));assert.deepEqual(r.avisosCobertura,['fecha_consulta_fuera_del_periodo_revisado']);
  assert.equal(r.conclusionHistorica,'favorable');assert.deepEqual(e,antes);
});
test('TEMP-01 sigue rechazando integridad alterada en una revisión pasada',()=>{
  const e=escenario();e.revision.motivo='Alteración sin recalcular huella';
  assert.throws(()=>vigenciaRevision({...e,fechaConsulta:'2026-10-15T10:00:00.000Z'}),/revision_alterada/);
});
