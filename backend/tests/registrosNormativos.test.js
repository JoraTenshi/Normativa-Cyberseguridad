'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { preparar, filtros } = require('../validation/registroNormativo');
const { catalogoNormativo, crearCatalogoNormativo } = require('../services/catalogoNormativoC2');
const { validarFiltros } = require('../services/consultaActividad');
const { oid } = require('./fixtures/revisionRequisito');
const ref = { id: oid(10), version: 1, sha256: 'a'.repeat(64) }, key = 'clave_registro_123456';
const sistema = () => ({ nombre: 'Sistema concreto', descripcion: 'Soporta un servicio concreto', alcance: ref, hechos: [], motivo: 'Alta explícita' });
test('sistema exige alcance exacto y no hereda hechos generales', () => {
  const d = preparar('sistema', sistema(), key); assert.deepEqual(d.hechos, []); assert.deepEqual(d.alcance, ref);
  assert.throws(() => preparar('sistema', { ...sistema(), alcance: { id: ref.id } }, key));
});
for (const campo of ['actor', 'organizacionId', 'rol', 'permisos', 'resultado', 'fechaEvaluacion', 'sha256'])
  test('no acepta campo forjado ' + campo, () => assert.throws(() => preparar('sistema', { ...sistema(), [campo]: 'inventado' }, key)));
test('edición exige versión positiva y revisión no admite edición', () => {
  assert.throws(() => preparar('sistema', sistema(), key, true));
  assert.equal(preparar('sistema', { ...sistema(), version: 1 }, key, true).version, 1);
  assert.throws(() => preparar('revision', {}, key, true));
});
test('la procedencia de hechos solo la genera servidor', () => assert.throws(() => preparar('sistema', {
  ...sistema(), hechos: [{ clave: 'a', estado: 'conocido', valor: true, procedencia: { tipo: 'declarado', referencia: 'inventada' } }]
}, key)));
test('catálogo de cinco fichas conserva las dos R3 con fuente y cobertura, no fixtures', () => {
  const ps = catalogoNormativo.listar(); assert.equal(ps.length, 5);
  assert.deepEqual(ps.filter(p => p.ficha.schemaVersion === 1).map(p => [p.ficha.version, p.regla.version, p.ficha.criterios.length]), [[3,3,10],[3,4,14]]);
  assert.ok(ps.every(p => p.regla.cobertura.periodo && !p.ficha.usoContenido.incluyeISOoCCNProtegido));
  assert.throws(() => crearCatalogoNormativo([ps[0], ps[0]]));
});
test('lectura del catálogo no puede mutar originales ni seleccionar una demo', () => {
  const p = catalogoNormativo.listar()[0]; p.ficha.titulo = 'alterado';
  assert.notEqual(catalogoNormativo.obtener(p.ficha.id).ficha.titulo, p.ficha.titulo);
  assert.equal(catalogoNormativo.obtener('DEMO'), null);
});
test('filtros paginados estrictos y categoría normativa exportable', () => {
  assert.equal(filtros({ limite: '2', alcanceId: ref.id }).limite, 2);
  for (const d of [{ limite: '51' }, { antes: { $ne: null } }, { organizacionId: ref.id }]) assert.throws(() => filtros(d));
  assert.equal(validarFiltros({ categoria: 'normativa', registroNormativoId: ref.id }).categoria, 'normativa');
});
test('evidencia documental no admite hash, número o autor declarados por cliente', () => {
  const base = { alcances: [ref], tipo: 'version_documento', titulo: 'Documento', procedencia: 'Archivo', localizador: 'p1',
    periodo: {}, soporte: { tipo: 'version_documento', documentoId: oid(20), versionDocumentoId: oid(21) }, motivo: 'Vínculo' };
  assert.equal(preparar('evidencia', base, key).soporte.versionDocumentoId, oid(21));
  for (const campo of ['sha256', 'numero', 'responsableRef']) assert.throws(() => preparar('evidencia', { ...base, soporte: { ...base.soporte, [campo]: 1 } }, key));
});
