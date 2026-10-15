'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { preparar, combinar, validarHechosGuardados, numeroURL } = require('../validation/contextoEmpresa');
const { validarContexto } = require('../validation/aplicabilidadContextual');
const C = require('../models/ContextoEmpresa'), R = require('../models/RevisionContextoEmpresa');
const E = require('../models/EventoOrganizacion');
const { validarFiltros } = require('../services/consultaActividad');
const { preparar: exportacion } = require('../services/exportarActividad');
const oid = 'a'.repeat(24), key = 'operacion-contexto-0001';
const conocido = (valor = false) => ({ clave: 'vende_software', estado: 'conocido', valor });
const alta = () => ({ hechos: [conocido()], motivo: 'Primera declaración' });
const invalido = fn => assert.throws(fn, e => e.codigo === 'DATOS_INVALIDOS');
test('acepta false sin confundirlo con respuesta ausente', () => {
  assert.equal(preparar(alta(), false, key).hechos[0].valor, false);
});
test('admite contexto vacío sin inventar respuestas', () => {
  assert.deepEqual(preparar({ ...alta(), hechos: [] }, false, key).hechos, []);
});
for (const v of [true, false, 0, 123, 'ES', [], ['ES', 'FR']]) {
  test('valor permitido ' + JSON.stringify(v), () => assert.doesNotThrow(() =>
    preparar({ ...alta(), hechos: [conocido(v)] }, false, key)));
}
for (const v of [null, {}, { $gt: 1 }, NaN, Infinity, 1e13, '', ' ES', ['ES', 'ES'], [1], 'x'.repeat(401)]) {
  test('rechaza valor ' + JSON.stringify(v), () => invalido(() =>
    preparar({ ...alta(), hechos: [conocido(v)] }, false, key)));
}
for (const nombre of ['organizacionId', 'actor', 'createdAt', 'estadoRevision', 'objeto', 'version']) {
  test('alta rechaza campo controlado por servidor ' + nombre, () =>
    invalido(() => preparar({ ...alta(), [nombre]: 'falso' }, false, key)));
}
for (const tipo of ['declarado', 'documentado', 'revisado']) {
  test('el cliente no escoge procedencia ' + tipo, () => invalido(() => preparar({
    ...alta(), hechos: [{ ...conocido(), procedencia: { tipo, referencia: 'falsa' } }]
  }, false, key)));
}
test('rechaza getter sin ejecutarlo', () => {
  let ejecutado = false;
  const d = alta();
  Object.defineProperty(d, 'extra', { enumerable: true, get() { ejecutado = true; return 1; } });
  invalido(() => preparar(d, false, key)); assert.equal(ejecutado, false);
});
test('rechaza propiedades prototype desde JSON', () => invalido(() =>
  preparar(JSON.parse('{"hechos":[],"motivo":"Prueba","__proto__":{}}'), false, key)));
test('rechaza claves duplicadas o peligrosas y cuerpo incompleto', () => {
  for (const d of [
    { ...alta(), hechos: [conocido(), conocido()] },
    { ...alta(), hechos: [{ ...conocido(), clave: '$where' }] },
    { ...alta(), hechos: [{ ...conocido(), clave: 'constructor' }] },
    { hechos: [] }, {}, null, { ...alta(), motivo: 'a'.repeat(301) }
  ]) invalido(() => preparar(d, false, key));
});
test('estado desconocido exige un motivo explícito', () => {
  for (const motivo of ['no_aportado', 'no_sabe', 'por_consultar']) {
    assert.doesNotThrow(() => preparar({ ...alta(), hechos: [{ clave: 'dato', estado: 'desconocido', motivo }] }, false, key));
  }
  invalido(() => preparar({ ...alta(), hechos: [{ clave: 'dato', estado: 'desconocido', motivo: 'si' }] }, false, key));
});
test('conflicto guarda alternativas distintas sin resolverlas automáticamente', () => {
  const hechos = [{ clave: 'dato', estado: 'conflictivo', alternativas: [{ valor: true }, { valor: false }] }];
  assert.doesNotThrow(() => preparar({ ...alta(), hechos }, false, key));
  const r = combinar([], hechos, oid);
  assert.equal(r[0].estado, 'conflictivo');
  assert.ok(r[0].alternativas.every(a => a.procedencia.tipo === 'declarado'));
  hechos[0].alternativas[1].valor = true;
  invalido(() => preparar({ ...alta(), hechos }, false, key));
});
test('PATCH preserva hechos no enviados y procedencias anteriores', () => {
  const anteriores = combinar([], [conocido(), { clave: 'pais', estado: 'conocido', valor: 'ES' }], oid);
  const copia = structuredClone(anteriores);
  const resultado = combinar(anteriores, [conocido(true)], 'b'.repeat(24));
  assert.deepEqual(anteriores, copia);
  assert.equal(resultado.find(h => h.clave === 'pais').procedencia.referencia, 'membresia:' + oid);
  assert.equal(resultado.find(h => h.clave === 'vende_software').procedencia.referencia, 'membresia:' + 'b'.repeat(24));
});
test('omitir no borra; desconocido reemplaza de manera expresa', () => {
  const original = combinar([], [conocido()], oid);
  assert.deepEqual(combinar(original, [], oid), original);
  assert.deepEqual(combinar(original, [{ clave: 'vende_software', estado: 'desconocido', motivo: 'por_consultar' }], oid),
    [{ clave: 'vende_software', estado: 'desconocido', motivo: 'por_consultar' }]);
});
test('rechaza más de 50 cambios, más de 200 hechos y mezcla final sobredimensionada', () => {
  const hechos = n => Array.from({ length: n }, (_, i) => ({ ...conocido(), clave: 'dato_' + i }));
  invalido(() => preparar({ hechos: hechos(201), motivo: 'Prueba' }, false, key));
  invalido(() => preparar({ cambios: hechos(51), motivo: 'Prueba', version: 1 }, true, key));
  invalido(() => preparar({ cambios: [], motivo: 'Prueba', version: 1 }, true, key));
  invalido(() => combinar(combinar([], hechos(200), oid), [{ ...conocido(), clave: 'extra' }], oid));
  invalido(() => combinar([], hechos(200).map(h => ({ ...h, valor: 'x'.repeat(400) })), oid));
});
for (const version of ['1', 0, -1, 1.5, Number.MAX_SAFE_INTEGER]) {
  test('PATCH rechaza versión inválida ' + version, () => invalido(() =>
    preparar({ version, cambios: [conocido()], motivo: 'Prueba' }, true, key)));
}
for (const valor of ['0', '01', '-1', '1.5', '1e2', '1000000000', ['1'], undefined]) {
  test('parámetro numérico no ambiguo ' + JSON.stringify(valor), () => invalido(() => numeroURL(valor)));
}
test('rechaza clave de reintento ausente o breve', () => {
  for (const k of [undefined, 'abc', {}, []]) invalido(() => preparar(alta(), false, k));
});
test('hechos almacenados compatibles con el motor, sin convertir declaraciones en revisión', () => {
  const hechos = combinar([], [conocido()], oid);
  assert.equal(validarHechosGuardados(hechos), true);
  assert.doesNotThrow(() => validarContexto({ id: 'ctx_' + oid, version: 1, organizacionId: oid,
    objeto: { tipo: 'organizacion', id: oid }, registradoEn: '2026-10-09T12:00:00.000Z', hechos }));
  hechos[0].procedencia.tipo = 'revisado';
  assert.equal(validarHechosGuardados(hechos), false);
});
test('modelo cabecera exige organización y versión entera', () => {
  assert.equal(new C({ organizacion: oid, version_actual: 1 }).validateSync(), undefined);
  assert.ok(new C({ organizacion: oid, version_actual: '1' }).validateSync());
  assert.ok(new C({ organizacion: oid, version_actual: 1.5 }).validateSync());
  assert.throws(() => new C({ organizacion: oid, version_actual: 1, permiso: true }));
  assert.ok(C.schema.indexes().some(([k, o]) => k.organizacion === 1 && o.unique && o.name === 'contexto_empresa_unico'));
});
test('modelo revisión requiere hechos y no permite valores arbitrarios', () => {
  const d = { organizacion: oid, contexto: oid, numero: 1, hechos: combinar([], [conocido()], oid),
    actor: oid, membresia_actor: oid, motivo: 'Prueba', sha256: 'a'.repeat(64),
    clave_operacion: key, huella_operacion: 'b'.repeat(64) };
  assert.equal(new R(d).validateSync(), undefined);
  assert.ok(new R({ ...d, hechos: [conocido()] }).validateSync());
  assert.equal(R.schema.path('clave_operacion').options.select, false);
  assert.ok(R.schema.indexes().some(([k, o]) => k.contexto === 1 && k.numero === 1 && o.unique));
});
test('historial exige referencia al contexto y no unidad ficticia', async () => {
  const d = { organizacion: oid, actor: oid, membresia_actor: oid, accion: 'contexto_creado',
    despues: { version: 1, sha256: 'a'.repeat(64), claves_cambiadas: ['pais'] } };
  await assert.rejects(new E(d).validate());
  await assert.doesNotReject(new E({ ...d, contexto: oid }).validate());
  await assert.rejects(new E({ ...d, contexto: oid, unidad: oid }).validate());
});
test('historial y exportación admiten contextoId/categoría, sin habilitar normativa ficticia', () => {
  assert.equal(validarFiltros({ categoria: 'contextos', contextoId: oid }).contextoId, oid);
  assert.equal(validarFiltros({ categoria: 'contextos', accion: 'contexto_actualizado' }).categoria, 'contextos');
  assert.throws(() => validarFiltros({ categoria: 'documentos', accion: 'contexto_creado' }));
  assert.throws(() => validarFiltros({ normativaId: oid }), e => e.codigo === 'FILTRO_NO_IMPLEMENTADO');
  assert.deepEqual(exportacion({ columnas: 'fecha,contextoId' }).elegidas, ['fecha', 'contextoId']);
});
