'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { crearCatalogo, catalogo } = require('../services/catalogoAplicabilidad');
const { preparar, reglaId, verificarResultado, resultadoValido, periodo } = require('../validation/decisionAplicabilidad');
const { evaluarAplicabilidadContextual } = require('../services/aplicabilidadContextual');
const { entrada } = require('./fixtures/aplicabilidadContextual');
const D = require('../models/DecisionAplicabilidad'), E = require('../models/EventoOrganizacion');
const { validarFiltros } = require('../services/consultaActividad');
const { preparar: exportar } = require('../services/exportarActividad');
const key = 'decision-prueba-00001';
const peticion = () => ({ versionContexto: 1, reglaId: 'DEMO_CONDICION', versionRegla: 1, motivo: 'Prueba sintética' });
const invalido = fn => assert.throws(fn, e => e.codigo === 'DATOS_INVALIDOS');
test('catálogo por defecto vacío: no se publica ninguna fixture', () => {
  assert.deepEqual(catalogo.listar(), []); assert.equal(catalogo.actual('DEMO_CONDICION'), null);
});
test('catálogo conserva copia interna, no referencias del constructor o consumidor', () => {
  const r = entrada().regla, c = crearCatalogo([r]);
  r.estado = 'retirada'; const copia = c.actual(r.id); copia.condicion.op = 'or';
  c.listar()[0].fuentes[0].titulo = 'Alterado';
  assert.equal(c.actual(r.id).estado, 'revisada');
  assert.equal(c.actual(r.id).condicion.op, 'and');
  assert.notEqual(c.actual(r.id).fuentes[0].titulo, 'Alterado');
});
test('catálogo rechaza duplicación de id/versión aunque el contenido difiera', () => {
  const r = entrada().regla;
  assert.throws(() => crearCatalogo([r, { ...r, naturaleza: 'guia' }]));
});
test('la última versión retirada/borrador no resucita una versión anterior', () => {
  for (const estado of ['borrador', 'retirada']) {
    const r = entrada().regla, c = crearCatalogo([r, { ...r, version: 2, estado }]);
    assert.equal(c.actual(r.id).version, 2); assert.deepEqual(c.listar(), []);
  }
});
test('catálogo exige contrato válido y no acepta operadores ejecutables', () => {
  const r = entrada().regla;
  assert.throws(() => crearCatalogo([{ ...r, condicion: { op: '$where', codigo: 'x' } }]));
  assert.throws(() => crearCatalogo([{ ...r, revision: undefined }]));
  assert.throws(() => crearCatalogo(Array(101).fill(r)));
});
test('petición solo contiene selección de regla/versiones/motivo', () => {
  assert.deepEqual(preparar(peticion(), key), { ...peticion(), clave: key });
});
for (const k of ['regla', 'contexto', 'organizacionId', 'actor', 'decision', 'snapshot', 'fechaEvaluacion',
  'estado', 'revision', 'habilitaEvaluacion', 'motorVersion', 'catalogo', 'anteriorId', 'numero']) {
  test('cliente no puede imponer ' + k, () => invalido(() => preparar({ ...peticion(), [k]: 'falso' }, key)));
}
for (const campo of ['versionContexto', 'versionRegla']) {
  for (const v of [0, -1, '1', 1.5, null, 1000000000]) {
    test(campo + ' rechaza ' + JSON.stringify(v), () => invalido(() => preparar({ ...peticion(), [campo]: v }, key)));
  }
}
for (const v of ['__proto__', 'constructor', 'toJSON', '../regla', '$where', '', 'x'.repeat(81), {}, []]) {
  test('id de regla cerrado ' + JSON.stringify(v), () => invalido(() => reglaId(v)));
}
test('getter rechazado antes de ejecutarse', () => {
  let llamado = false; const d = peticion();
  Object.defineProperty(d, 'extra', { enumerable: true, get() { llamado = true; return 1; } });
  invalido(() => preparar(d, key)); assert.equal(llamado, false);
});
test('cuerpo, motivo y clave obligatorios sin campos omitidos', () => {
  for (const d of [null, {}, { ...peticion(), motivo: '' }, { ...peticion(), motivo: 'x'.repeat(301) }])
    invalido(() => preparar(d, key));
  for (const k of [null, '', 'corta']) invalido(() => preparar(peticion(), k));
});
test('paquete coherente se verifica y se copia sin mutar entradas', () => {
  const original = evaluarAplicabilidadContextual(entrada()), copia = verificarResultado(original);
  assert.deepEqual(copia, original); assert.equal(resultadoValido(original), true);
  copia.decision.estado = 'no_aplica'; assert.equal(original.decision.estado, 'aplica');
});
for (const alterar of [
  r => { r.decision.estado = 'no_aplica'; },
  r => { r.decision.revisionDecision = 'humana'; },
  r => { r.snapshot.motorVersion = 'desconocido'; },
  r => { r.snapshot.regla.fuentes[0].titulo = 'Otra fuente'; },
  r => { r.decision.contexto.version++; },
  r => { r.snapshot.fechaEvaluacion = 'ayer'; },
  r => { r.decision.habilitaEvaluacion = false; }
]) {
  test('rechaza cálculo o snapshot incoherente ' + alterar.toString(), () => {
    const r = evaluarAplicabilidadContextual(entrada()); alterar(r); assert.equal(resultadoValido(r), false);
  });
}
test('periodo distingue antes/durante/después sin alterar la conclusión guardada', () => {
  const r = entrada().regla;
  r.vigencia = { estado: 'definida', desde: '2026-10-01T00:00:00.000Z', hasta: '2026-11-01T00:00:00.000Z' };
  assert.equal(periodo(r, '2026-09-30T23:59:59.999Z'), 'futura');
  assert.equal(periodo(r, r.vigencia.desde), 'en_periodo');
  assert.equal(periodo(r, r.vigencia.hasta), 'finalizada');
  assert.equal(periodo({ ...r, vigencia: { estado: 'pendiente' } }, r.vigencia.hasta), 'por_determinar');
});
test('modelo conserva paquete completo y oculta claves de reintento', () => {
  const oid = 'a'.repeat(24), resultado = evaluarAplicabilidadContextual(entrada());
  const d = { organizacion: oid, contexto: oid, revision_contexto: oid, version_contexto: 1, numero: 1,
    regla_id: 'DEMO_CONDICION', version_regla: 1, actor: oid, membresia_actor: oid, motivo: 'Prueba',
    resultado, sha256: 'b'.repeat(64), clave_operacion: key, huella_operacion: 'c'.repeat(64) };
  assert.equal(new D(d).validateSync(), undefined);
  assert.equal(new D({ ...d, anterior: null }).validateSync(), undefined);
  assert.ok(new D({ ...d, anterior: 'incorrecto' }).validateSync());
  assert.ok(new D({ ...d, resultado: { ...resultado, decision: {} } }).validateSync());
  assert.ok(new D({ ...d, numero: '1' }).validateSync());
  assert.throws(() => new D({ ...d, permiso: true }));
  assert.equal(D.schema.path('clave_operacion').options.select, false);
  assert.ok(D.schema.indexes().some(([k,o]) => k.contexto === 1 && k.numero === 1 && o.unique));
});
test('evento de decisión exige contexto/decisión y nunca una unidad ficticia', async () => {
  const oid = 'a'.repeat(24), d = { organizacion: oid, actor: oid, membresia_actor: oid,
    accion: 'decision_aplicabilidad_creada', despues: { version: 1 } };
  await assert.rejects(new E(d).validate());
  await assert.doesNotReject(new E({ ...d, contexto: oid, decision: oid }).validate());
  await assert.rejects(new E({ ...d, contexto: oid, decision: oid, unidad: oid }).validate());
});
test('historial incorpora reglas/decisiones sin fingir filtros de normativa', () => {
  const f = validarFiltros({ categoria: 'decisiones_aplicabilidad', reglaId: 'DEMO_CONDICION', decisionId: 'a'.repeat(24) });
  assert.equal(f.reglaId, 'DEMO_CONDICION');
  assert.throws(() => validarFiltros({ normativaId: 'a'.repeat(24) }), e => e.codigo === 'FILTRO_NO_IMPLEMENTADO');
  assert.throws(() => validarFiltros({ reglaId: { $ne: 'x' } }));
  assert.throws(() => validarFiltros({ categoria: 'contextos', accion: 'decision_aplicabilidad_creada' }));
  assert.deepEqual(exportar({ columnas: 'decisionId,reglaId' }).elegidas, ['decisionId', 'reglaId']);
});
