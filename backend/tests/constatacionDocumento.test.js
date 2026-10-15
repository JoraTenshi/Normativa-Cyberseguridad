'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const f = require('./fixtures/revisionRequisito');
const { evaluarAplicabilidadContextual } = require('../services/aplicabilidadContextual');
const { contextualizarRequisito, validarEvidencia, crearRevisionRequisito, vigenciaRevision } = require('../services/revisionRequisito');
const { preparar } = require('../validation/registroNormativo');
const doc = () => ({identificador:'EXP-EXTERNO-1',version:'Edición 2026-10-14 / 2',localizador:'Repositorio externo / apartado 3',contenidoExaminado:'Identificación y examen de la causa documentada; no se copia el texto completo'});
function fixture() {
  const x=f.revision(), p=f.paquete();
  p.ficha.criterios.forEach(c=>c.tiposEvidencia.push('constatacion_documento'));
  x.ficha=p.ficha;
  x.requisito=contextualizarRequisito({id:x.requisito.id,version:1,organizacionId:x.requisito.organizacionId,alcance:x.requisito.alcance,
    decisionId:x.requisito.decisionId,resultado:evaluarAplicabilidadContextual(p.entrada),ficha:p.ficha});
  x.datos.requisito={id:x.requisito.id,version:1,sha256:x.requisito.sha256};
  x.evidencias[0].tipo='constatacion_documento';
  x.evidencias[0].soporte={tipo:'comprobacion',metodo:'Examen documental declarado',realizadaEn:'2026-10-14T12:00:00.000Z',responsableRef:'membresia:'+f.oid(71),
    resultado:'Examen sintético',limitaciones:'No prueba de autenticidad',documentoExaminado:doc()};
  return x;
}
function payload(e) {
  const {responsableRef,...soporte}=e.soporte;
  return {alcances:[{id:e.alcanceIds[0],version:1,sha256:'a'.repeat(64)}],tipo:e.tipo,titulo:e.titulo,procedencia:e.procedencia,localizador:e.localizador,periodo:e.periodo,soporte,motivo:'Prueba'};
}
test('documento externo identificado/versionado no exige PDF, cambia huella y conserva autor',()=>{
  const x=fixture(), r=crearRevisionRequisito(x), antes=structuredClone(r);
  assert.equal(r.conclusion,'favorable'); assert.deepEqual(r.evidencias[0].soporte.documentoExaminado,doc());
  assert.deepEqual(preparar('evidencia',payload(x.evidencias[0]),'clave_constatacion_test').soporte.documentoExaminado,doc());
  x.evidencias[0].version++;x.evidencias[0].soporte.documentoExaminado.version='3';
  const v=vigenciaRevision({revision:r,requisitoActual:x.requisito,evidenciasActuales:x.evidencias,fechaConsulta:x.fechaRevision});
  assert.equal(v.requiereRevision,true);assert.ok(v.motivos.some(m=>m.startsWith('evidencia_modificada:')));assert.deepEqual(r,antes);
});
test('afirmación oral mal etiquetada no puede crearse ni revisarse favorablemente',()=>{
  const x=fixture();delete x.evidencias[0].soporte.documentoExaminado;
  x.evidencias[0].soporte.metodo='Entrevista oral sin documento';
  assert.throws(()=>preparar('evidencia',payload(x.evidencias[0]),'clave_constatacion_test'));
  assert.throws(()=>crearRevisionRequisito(x),/documento_subyacente_no_identificado/);
  assert.deepEqual(validarEvidencia(x.evidencias[0]),x.evidencias[0]); // Lectura histórica, no aprobación.
  x.datos.criterios.forEach(c=>c.resultado='no_determinado');x.datos.conclusion='no_determinado';
  assert.equal(crearRevisionRequisito(x).conclusion,'no_determinado');
});
for(const campo of ['identificador','version','localizador','contenidoExaminado']) for(const valor of [undefined,'','   ',{texto:'invento'}])
  test('referencia documental rechaza '+campo+' '+String(valor),()=>{
    const e=fixture().evidencias[0]; if(valor===undefined)delete e.soporte.documentoExaminado[campo];else e.soporte.documentoExaminado[campo]=valor;
    assert.throws(()=>validarEvidencia(e));assert.throws(()=>preparar('evidencia',payload(e),'clave_constatacion_test'));
  });
test('campos extra, texto excesivo y actor inyectado son rechazados',()=>{
  for(const cambio of [d=>d.rol='admin',d=>d.identificador='x'.repeat(501),d=>d.version='x'.repeat(201),d=>d.localizador='x'.repeat(1001),d=>d.contenidoExaminado='x'.repeat(2001)]) {
    const e=fixture().evidencias[0];cambio(e.soporte.documentoExaminado);assert.throws(()=>validarEvidencia(e));
  }
  const p=payload(fixture().evidencias[0]);p.soporte.responsableRef='forjado';assert.throws(()=>preparar('evidencia',p,'clave_constatacion_test'));
});
test('soporte PDF exacto y comprobación genérica mantienen contrato anterior',()=>{
  const e=f.revision().evidencias[0];e.tipo='constatacion_documento';assert.equal(validarEvidencia(e).soporte.tipo,'version_documento');
  const r=crearRevisionRequisito(f.revision());assert.equal(r.sha256,'5cc52b6d1cc4b5c9fcd77e4cc8824d112ebe4d75bbc28f3eec5e0687144709d0');
  const generica=fixture().evidencias[0];generica.tipo='constatacion_revision';delete generica.soporte.documentoExaminado;assert.deepEqual(validarEvidencia(generica),generica);
});
test('revisión histórica antigua legible conserva su conclusión pero requiere nueva revisión',()=>{
  const x=fixture(), r=crearRevisionRequisito(x);delete r.evidencias[0].soporte.documentoExaminado;delete x.evidencias[0].soporte.documentoExaminado;
  const {sha256,...base}=r;r.sha256=f.huella(base); // Simula la forma histórica anterior con hash coherente.
  const original=structuredClone(r), v=vigenciaRevision({revision:r,requisitoActual:x.requisito,evidenciasActuales:x.evidencias,fechaConsulta:x.fechaRevision});
  assert.equal(v.conclusionHistorica,'favorable');assert.equal(v.satisfaccionActual,'requiere_revision');assert.ok(v.motivos.some(m=>m.startsWith('documento_subyacente_no_identificado:')));
  assert.deepEqual(r,original);
});
