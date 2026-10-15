'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { preparar, validarContenido } = require('../validation/operacion');
const { combinar } = require('../validation/contextoEmpresa');
const { huella } = require('../validation/aplicabilidadContextual');
const { contextoDeRevisionOperacion } = require('../services/operaciones');
const { compararEntradasAplicabilidad } = require('../services/aplicabilidadContextual');
const { entrada: ejemplo } = require('./fixtures/aplicabilidadContextual');
const O = require('../models/Operacion'), R = require('../models/RevisionOperacion');
const E = require('../models/EventoOrganizacion');
const { validarFiltros } = require('../services/consultaActividad');
const { preparar: exportar } = require('../services/exportarActividad');
const oid = 'a'.repeat(24), org = 'b'.repeat(24), key = 'operacion-prueba-0001';
const hecho = (valor = false) => ({ clave: 'por_cuenta_cliente', estado: 'conocido', valor });
const alta = () => ({ nombre: 'Servicio A', descripcion: 'Alojamiento de prueba', hechos: [hecho()], motivo: 'Alta' });
const fallo = fn => assert.throws(fn, e => e.codigo === 'DATOS_INVALIDOS');
test('alta sin subespacio, respuestas false y procedencia solo desde servidor', () => {
  const d = preparar(alta(), false, key);
  assert.equal(d.subespacioId, null); assert.equal(d.hechos[0].valor, false);
  assert.equal(Object.hasOwn(d.hechos[0], 'procedencia'), false);
});
test('normaliza metadatos e ID sin mutar entrada', () => {
  const e = { ...alta(), nombre: ' Servicio A ', subespacioId: oid.toUpperCase() }, copy = structuredClone(e);
  const d = preparar(e, false, key);
  assert.equal(d.nombre, 'Servicio A'); assert.equal(d.subespacioId, oid); assert.deepEqual(e, copy);
});
test('PATCH de metadatos permite desvincular con null y no inventa cambios de hechos', () => {
  const d = preparar({ version: 1, subespacioId: null, motivo: 'Desvincular' }, true, key);
  assert.deepEqual(d.cambios, []); assert.equal(d.subespacioId, null); assert.equal(d.nombre, undefined);
});
test('PATCH de hechos no elimina metadatos omitidos', () => {
  const d = preparar({ version: 1, cambios: [hecho(true)], motivo: 'Cambio' }, true, key);
  assert.equal(Object.hasOwn(d, 'subespacioId'), false); assert.equal(d.nombre, undefined);
});
for (const [nombre, d] of [
  ['sin nombre', { ...alta(), nombre: undefined }],
  ['sin descripcion', { ...alta(), descripcion: undefined }],
  ['nombre largo', { ...alta(), nombre: 'x'.repeat(121) }],
  ['descripcion larga', { ...alta(), descripcion: 'x'.repeat(501) }],
  ['nombre objeto', { ...alta(), nombre: { $gt: '' } }],
  ['descripcion nula', { ...alta(), descripcion: null }],
  ['organizacion cliente', { ...alta(), organizacion: org }],
  ['cliente aun no modelado', { ...alta(), clienteId: oid }],
  ['unidad confundida', { ...alta(), unidadId: oid }],
  ['fecha cliente', { ...alta(), createdAt: '2026-10-10' }],
  ['version cliente al crear', { ...alta(), version: 1 }],
  ['subespacio objeto', { ...alta(), subespacioId: { $ne: null } }],
  ['subespacio invalido', { ...alta(), subespacioId: 'abcdef' }],
  ['procedencia revisada', { ...alta(), hechos: [{ ...hecho(), procedencia: { tipo: 'revisado', referencia: 'yo' } }] }],
  ['sin hechos', { ...alta(), hechos: undefined }],
  ['hechos nulos', { ...alta(), hechos: null }],
  ['hechos duplicados', { ...alta(), hechos: [hecho(), hecho()] }]
]) test('rechaza alta ' + nombre, () => fallo(() => preparar(d, false, key)));
for (const [nombre, d] of [
  ['sin cambio', { version: 1, motivo: 'Nada' }],
  ['cambios vacíos', { version: 1, cambios: [], motivo: 'Nada' }],
  ['version cero', { version: 0, nombre: 'X', motivo: 'Nada' }],
  ['version texto', { version: '1', nombre: 'X', motivo: 'Nada' }],
  ['version fraccion', { version: 1.5, nombre: 'X', motivo: 'Nada' }],
  ['motivo vacío', { version: 1, nombre: 'X', motivo: '' }],
  ['motivo largo', { version: 1, nombre: 'X', motivo: 'x'.repeat(301) }],
  ['huella manipulada', { version: 1, nombre: 'X', motivo: 'X', sha256: 'f'.repeat(64) }],
  ['estado no implementado', { version: 1, estado: 'archivada', motivo: 'X' }],
  ['borrado de hecho ambiguo', { version: 1, cambios: [{ clave: 'por_cuenta_cliente', valor: null }], motivo: 'X' }]
]) test('rechaza PATCH ' + nombre, () => fallo(() => preparar(d, true, key)));
test('rechaza entradas con getters sin invocarlos y prototipos', () => {
  let llamadas = 0; const d = alta();
  Object.defineProperty(d, 'malicioso', { enumerable: true, get() { llamadas++; return true; } });
  fallo(() => preparar(d, false, key)); assert.equal(llamadas, 0);
  fallo(() => preparar(Object.create(alta()), false, key));
});
test('rechaza límite 201 hechos o 51 cambios', () => {
  const hechos = n => Array.from({ length: n }, (_, i) => ({ ...hecho(), clave: 'dato_' + i }));
  fallo(() => preparar({ ...alta(), hechos: hechos(201) }, false, key));
  fallo(() => preparar({ version: 1, cambios: hechos(51), motivo: 'X' }, true, key));
});
test('clave idempotente obligatoria y sin coerción', () => {
  for (const k of [undefined, 'breve', 1, [], {}]) fallo(() => preparar(alta(), false, k));
});
function datosRevision() {
  const contenido = { nombre: 'A', descripcion: 'Operación A', subespacioId: null, hechos: combinar([], [hecho()], oid) };
  const o = { _id: oid, organizacion: org, nombre: 'A', descripcion: 'Operación A', subespacio: null, version_actual: 1 };
  const r = { _id: oid, operacion: oid, organizacion: org, numero: 1, contenido, actor: oid,
    membresia_actor: oid, motivo: 'Prueba', sha256: huella(contenido), clave_operacion: key,
    huella_operacion: 'c'.repeat(64), createdAt: new Date('2026-10-10T10:00:00.000Z') };
  return { o, r };
}
test('modelo cabecera nullable y sin organización global implícita', () => {
  const { o } = datosRevision();
  assert.equal(new O(o).validateSync(), undefined);
  assert(new O({ ...o, organizacion: undefined }).validateSync());
  assert(new O({ ...o, version_actual: '1' }).validateSync());
  assert.throws(() => new O({ ...o, rol: 'administrador' }));
});
test('modelo revisión valida snapshot y declara unicidad real requerida', () => {
  const { r } = datosRevision();
  assert.equal(new R(r).validateSync(), undefined);
  assert(new R({ ...r, contenido: { ...r.contenido, hechos: [hecho()] } }).validateSync());
  assert.equal(R.schema.path('clave_operacion').options.select, false);
  assert(R.schema.indexes().some(([k, o]) => k.operacion === 1 && k.numero === 1 && o.unique));
  assert(R.schema.indexes().some(([k, o]) => k.organizacion === 1 && k.clave_operacion === 1 && o.unique));
});
test('adaptador produce solo hechos propios del objeto operacion', () => {
  const { o, r } = datosRevision(), c = contextoDeRevisionOperacion(o, r);
  assert.equal(c.id, 'ctx_op_' + oid); assert.equal(c.objeto.tipo, 'operacion');
  assert.equal(c.objeto.id, oid); assert.equal(c.organizacionId, org);
  assert.deepEqual(c.hechos, r.contenido.hechos);
});
for (const tipo of ['hash', 'operacion', 'organizacion', 'futura', 'cabecera', 'contenido']) {
  test('adaptador rechaza inconsistencia ' + tipo, () => {
    const { o, r } = datosRevision();
    if (tipo === 'hash') r.sha256 = '0'.repeat(64);
    if (tipo === 'operacion') r.operacion = 'c'.repeat(24);
    if (tipo === 'organizacion') r.organizacion = 'c'.repeat(24);
    if (tipo === 'futura') r.numero = 2;
    if (tipo === 'cabecera') o.nombre = 'Alterado';
    if (tipo === 'contenido') r.contenido.extra = true;
    assert.throws(() => contextoDeRevisionOperacion(o, r), e => e.codigo === 'SERVICIO_NO_DISPONIBLE');
  });
}
test('revisión histórica conserva metadatos anteriores y un hash diferente al de hechos solos', () => {
  const { o, r } = datosRevision(); o.version_actual = 2; o.nombre = 'Nombre actual';
  assert.equal(contextoDeRevisionOperacion(o, r).version, 1);
  assert.notEqual(r.sha256, huella(r.contenido.hechos));
});
test('no compara snapshots de operaciones distintas como evolución de la misma', () => {
  const a = ejemplo(), b = structuredClone(a);
  b.contexto.objeto.id = 'operacion_B'; b.contexto.id = 'CTX_B';
  const snapshot = { contexto: a.contexto, regla: a.regla, fechaEvaluacion: a.fechaEvaluacion,
    motorVersion: 'aplicabilidad-contextual/1' };
  assert.throws(() => compararEntradasAplicabilidad(snapshot, b), e => e.codigo === 'AMBITO_NO_COINCIDE');
});
test('eventos de operación exigen referencia y no contexto de empresa ni unidad', async () => {
  const d = { organizacion: org, actor: oid, membresia_actor: oid, accion: 'operacion_creada',
    despues: { version: 1, subespacio_id: null, sha256: 'a'.repeat(64), claves_cambiadas: [] } };
  await assert.rejects(new E(d).validate());
  await assert.doesNotReject(new E({ ...d, operacion: oid }).validate());
  await assert.rejects(new E({ ...d, operacion: oid, unidad: oid }).validate());
  await assert.rejects(new E({ ...d, operacion: oid, contexto: oid }).validate());
});
test('filtro y columna de operación sin reutilizar contextoId ni habilitar clienteId', () => {
  assert.equal(validarFiltros({ categoria: 'operaciones', operacionId: oid, accion: 'operacion_creada' }).operacionId, oid);
  assert.throws(() => validarFiltros({ categoria: 'contextos', accion: 'operacion_creada' }));
  assert.throws(() => validarFiltros({ operacionId: { $ne: null } }));
  assert.throws(() => validarFiltros({ clienteId: oid }), e => e.codigo === 'FILTRO_NO_IMPLEMENTADO');
  assert.deepEqual(exportar({ columnas: 'fecha,operacionId' }).elegidas, ['fecha', 'operacionId']);
});
test('contenido interno estricto sin revisión fingida', () => {
  const { r } = datosRevision();
  assert(validarContenido(r.contenido));
  r.contenido.hechos[0].procedencia.tipo = 'revisado';
  assert.equal(validarContenido(r.contenido), false);
});
