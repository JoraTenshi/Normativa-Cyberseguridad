'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validarFiltros, crearServicioActividad } = require('../services/consultaActividad');
const { ErrorContextoOrganizacion } = require('../services/contextoOrganizacion');
const Evento = require('../models/EventoOrganizacion');
const Pertenencia = require('../models/MembresiaUnidad');
const O = '100000000000000000000001', U = '200000000000000000000001';
const M = '300000000000000000000001', D = '400000000000000000000001';
const contexto = { usuarioId: U, organizacionId: O, membresiaId: M, rol: 'administrador' };
const entrada = { usuarioId: U, organizacionId: O };
function query(resultado) {
  return { select() { return this; }, read(v) { assert.equal(v, 'primary'); return this; },
    maxTimeMS(v) { assert.equal(v, 5000); return this; }, limit() { return this; }, sort() { return this; },
    async lean() { return typeof resultado === 'function' ? resultado() : resultado; } };
}
test('filtros por defecto: descendente y 50, sin modificar la entrada', () => {
  const e = {};
  assert.deepEqual(validarFiltros(e), { orden: 'desc', limite: 50 });
  assert.deepEqual(e, {});
});
test('normaliza IDs y fechas UTC explicitas', () => {
  const f = validarFiltros({ unidadId: 'ABCDEF123456ABCDEF123456', limite: '100',
    desde: '2026-10-08T00:00:00Z', hasta: '2026-10-09T00:00:00.000Z' });
  assert.equal(f.unidadId, 'abcdef123456abcdef123456');
  assert.equal(f.desde, '2026-10-08T00:00:00.000Z');
});
for (const [nombre, filtros] of [
  ['null', null], ['array', []], ['operador', { $where: 'true' }],
  ['organizacion inyectada', { organizacionId: O }], ['rol inyectado', { rol: 'administrador' }],
  ['objeto operador', { actorId: { $ne: null } }], ['parametro repetido', { accion: ['unidad_creada', 'unidad_archivada'] }],
  ['array de ID', { unidadId: [D] }], ['ID de 12 caracteres', { unidadId: 'abcdefghijkl' }],
  ['ID vacio', { actorId: '' }], ['limite cero', { limite: '0' }], ['limite negativo', { limite: '-1' }],
  ['limite enorme', { limite: '101' }], ['limite no entero', { limite: '1.5' }],
  ['limite array', { limite: ['5'] }], ['numero fuera de contrato HTTP', { limite: 50 }],
  ['orden arbitrario', { orden: 'password' }], ['accion desconocida', { accion: 'borrar_todo' }],
  ['categoria desconocida', { categoria: 'seguridad' }],
  ['categoria incompatible', { categoria: 'unidades', accion: 'miembro_revocado' }],
  ['fecha sin hora', { desde: '2026-10-08' }], ['hora local', { desde: '2026-10-08T12:00:00' }],
  ['fecha imposible', { desde: '2026-02-30T00:00:00Z' }],
  ['hora imposible', { desde: '2026-10-08T24:00:00Z' }],
  ['intervalo vacio', { desde: '2026-10-08T00:00:00Z', hasta: '2026-10-08T00:00:00Z' }],
  ['intervalo invertido', { desde: '2026-10-09T00:00:00Z', hasta: '2026-10-08T00:00:00Z' }],
  ['cursor demasiado largo', { cursor: 'a'.repeat(1201) }]
]) {
  test('rechaza ' + nombre, () => assert.throws(() => validarFiltros(filtros), { codigo: 'FILTROS_INVALIDOS' }));
}
for (const campo of ['clienteId', 'normativaId', 'estandarId', 'categoriaTarea']) {
  test('no ofrece como operativo el filtro pendiente ' + campo, () =>
    assert.throws(() => validarFiltros({ [campo]: 'x' }), { codigo: 'FILTRO_NO_IMPLEMENTADO' }));
}
test('no interpreta una instancia de clase como filtros', () =>
  assert.throws(() => validarFiltros(new Date()), { codigo: 'FILTROS_INVALIDOS' }));
test('no acepta nombres de propiedad Symbol', () =>
  assert.throws(() => validarFiltros({ [Symbol('x')]: 'y' }), { codigo: 'FILTROS_INVALIDOS' }));
test('indices de lectura declarados, sin afirmar que existen en el despliegue', () => {
  assert.ok(Evento.schema.indexes().some(([k, o]) => o.name === 'eventos_organizacion_fecha' &&
    JSON.stringify(k) === JSON.stringify({ organizacion: 1, createdAt: -1, _id: -1 })));
  assert.ok(Pertenencia.schema.indexes().some(([, o]) => o.name === 'pertenencias_por_membresia'));
});
test('autoriza antes de consultar eventos o interpretar filtros', async () => {
  let leidos = false;
  const s = crearServicioActividad({
    resolverOrganizacion: async () => { throw new ErrorContextoOrganizacion('ACCESO_ORGANIZACION_DENEGADO'); },
    EventoModel: { find() { leidos = true; } }
  });
  await assert.rejects(s.listarActividad({ ...entrada, filtros: { $where: 'x' } }),
    { codigo: 'ACCESO_ORGANIZACION_DENEGADO' });
  assert.equal(leidos, false);
});
test('construye consulta propia, no recibe condiciones Mongo del cliente', async () => {
  let filtro, orden, limite, llamadas = 0;
  const s = crearServicioActividad({
    resolverOrganizacion: async () => { llamadas++; return contexto; },
    reloj: () => new Date('2026-10-08T10:00:00Z'),
    EventoModel: { find(f) { filtro = f; return { ...query([]),
      sort(v) { orden = v; return this; }, limit(v) { limite = v; return this; } }; } }
  });
  const res = await s.listarActividad({ ...entrada, filtros: {
    unidadId: D, actorId: U, categoria: 'unidades', limite: '2',
    desde: '2026-10-01T00:00:00Z', hasta: '2026-10-08T00:00:00Z'
  } });
  assert.equal(filtro.organizacion, O);
  assert.equal(filtro.unidad, D);
  assert.equal(filtro.actor, U);
  assert.deepEqual(filtro.accion.$in, Evento.schema.path('accion').enumValues.filter(a => a.startsWith('unidad_')));
  assert.equal(filtro.createdAt.$gte.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(filtro.createdAt.$lt.toISOString(), '2026-10-08T00:00:00.000Z');
  assert.deepEqual(orden, { createdAt: -1, _id: -1 });
  assert.equal(limite, 3); assert.equal(llamadas, 2);
  assert.equal(res.horaServidor, '2026-10-08T10:00:00.000Z');
  assert.equal(res.paginacion.siguienteCursor, null);
  assert.equal(res.capacidades.exportacion, true);
  assert.deepEqual(res.capacidades.formatosExportacion, ['csv', 'xlsx']);
});
test('consulta y miembros normales no leen el historial', async () => {
  for (const rol of ['consulta', 'colaborador']) {
    const s = crearServicioActividad({
      resolverOrganizacion: async () => ({ ...contexto, rol }),
      PertenenciaModel: { find: () => query([{ _id: M, membresia: M, unidad: D, rol: 'miembro', estado: 'activa' }]) },
      EventoModel: { find() { assert.fail('No debe consultar eventos'); } }
    });
    await assert.rejects(s.listarActividad(entrada), { codigo: 'ACTIVIDAD_DENEGADA' });
  }
});
test('fallo Mongo de eventos devuelve error neutro, no sus detalles', async () => {
  const s = crearServicioActividad({
    resolverOrganizacion: async () => contexto,
    EventoModel: { find: () => query(() => { throw new Error('secreto sintetico'); }) }
  });
  await assert.rejects(s.listarActividad(entrada), e =>
    e.codigo === 'ACTIVIDAD_NO_DISPONIBLE' && !e.message.includes('secreto'));
});
test('revalidar permisos tras lectura impide entregar datos si se revoca pertenencia', async () => {
  let veces = 0;
  const s = crearServicioActividad({
    resolverOrganizacion: async () => {
      if (++veces > 1) throw new ErrorContextoOrganizacion('ACCESO_ORGANIZACION_DENEGADO');
      return contexto;
    }, EventoModel: { find: () => query([]) }
  });
  await assert.rejects(s.listarActividad(entrada), { codigo: 'ACCESO_ORGANIZACION_DENEGADO' });
});
test('duplicidad de pertenencias de coordinador falla cerrada', async () => {
  const r = { membresia: M, unidad: D, rol: 'coordinador', estado: 'activa' };
  const s = crearServicioActividad({
    resolverOrganizacion: async () => ({ ...contexto, rol: 'colaborador' }),
    PertenenciaModel: { find: () => query([r, { ...r, estado: 'revocada' }]) }
  });
  await assert.rejects(s.listarActividad(entrada), { codigo: 'ACTIVIDAD_DENEGADA' });
});
test('el limite defensivo de relaciones no devuelve resultados parciales silenciosos', async () => {
  const s = crearServicioActividad({
    resolverOrganizacion: async () => ({ ...contexto, rol: 'colaborador' }),
    PertenenciaModel: { find: () => query(Array(201).fill({})) }
  });
  await assert.rejects(s.listarActividad(entrada), { codigo: 'ACTIVIDAD_NO_DISPONIBLE' });
});
test('cursores manipulados se rechazan sin consultar eventos', async () => {
  const s = crearServicioActividad({
    resolverOrganizacion: async () => contexto,
    EventoModel: { find() { assert.fail('No consultar'); } }
  });
  for (const cursor of ['no_json', Buffer.from('{}').toString('base64url'),
    Buffer.from('null').toString('base64url')]) {
    await assert.rejects(s.listarActividad({ ...entrada, filtros: { cursor } }), { codigo: 'CURSOR_INVALIDO' });
  }
});
