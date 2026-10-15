'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioSesiones } = require('../services/sesionesUsuario');
const usuario = '1234567890abcdef12345678';
const datos = { usuario, versionCredenciales: 0, identificador: 'a'.repeat(64) };

test('el servicio expone solo las cuatro operaciones internas previstas', () => {
  const servicio = crearServicioSesiones();
  assert.deepEqual(Object.keys(servicio), ['crear', 'consultar', 'registrarActividad', 'revocar']);
  assert.equal(Object.isFrozen(servicio), true);
});
test('el reloj de pruebas debe ser una función, nunca una fecha de la petición', () => {
  for (const relojPruebas of [null, 0, 'ahora', new Date()]) {
    assert.throws(() => crearServicioSesiones({ relojPruebas }), TypeError);
  }
});
test('crear rechaza inyección de campos y valores coercibles antes de tocar Mongo', async () => {
  const servicio = crearServicioSesiones();
  for (const entrada of [
    null, undefined, [], {}, { usuario, versionCredenciales: '0' },
    { usuario, versionCredenciales: -1 }, { usuario, versionCredenciales: 0.5 },
    { usuario, versionCredenciales: Number.MAX_SAFE_INTEGER + 1 },
    { usuario: { $ne: null }, versionCredenciales: 0 },
    { usuario, versionCredenciales: 0, mantenerSesion: 'true' },
    { usuario, versionCredenciales: 0, mantenerSesion: undefined },
    ...['ahora', 'expiraEn', 'ultimaActividadEn', 'identificador', 'rol', 'pending2fa']
      .map(k => ({ usuario, versionCredenciales: 0, [k]: 'inyectado' }))
  ]) await assert.rejects(servicio.crear(entrada), TypeError);
});
test('consultar/actividad rechazan identificadores o identidades inválidos sin Mongo', async () => {
  const servicio = crearServicioSesiones();
  for (const entrada of [
    undefined, null, [], Object.create({ ...datos }), {},
    ...['', 'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), { $ne: null }]
      .map(identificador => ({ ...datos, identificador })),
    { ...datos, usuario: 'otra' }, { ...datos, usuario: { $ne: null } },
    { ...datos, versionCredenciales: '0' }, { ...datos, versionCredenciales: NaN },
    { ...datos, ahora: new Date() }, { ...datos, expiraEn: new Date() },
    { ...datos, registrarActividad: true }
  ]) {
    assert.deepEqual(await servicio.consultar(entrada), { valida: false, codigo: 'SESION_NO_VALIDA' });
    assert.deepEqual(await servicio.registrarActividad(entrada), { valida: false, codigo: 'SESION_NO_VALIDA' });
    assert.deepEqual(await servicio.revocar(entrada), { ok: false, codigo: 'SESION_NO_VALIDA' });
  }
});
test('sin conexión ninguna operación acepta la sesión ni devuelve un identificador', async () => {
  const servicio = crearServicioSesiones({ Modelo: { db: { readyState: 0 } } });
  for (const ejecutar of [
    () => servicio.crear({ usuario, versionCredenciales: 0 }),
    () => servicio.consultar(datos), () => servicio.registrarActividad(datos),
    () => servicio.revocar(datos)
  ]) await assert.rejects(ejecutar, e => e.code === 'SESIONES_NO_DISPONIBLES' && e.status === 503);
});
test('fallos del driver no filtran consultas o secretos ni se convierten en sesión válida', async () => {
  const secreto = 'token-que-no-debe-salir';
  const fallo = () => { throw new Error(secreto); };
  const Modelo = { db: { readyState: 1 }, collection: {
    aggregate: fallo, findOneAndUpdate: fallo, updateOne: fallo
  } };
  const servicio = crearServicioSesiones({ Modelo });
  for (const nombre of ['consultar', 'registrarActividad', 'revocar']) {
    await assert.rejects(servicio[nombre](datos), e => {
      assert.equal(e.code, 'SESIONES_NO_DISPONIBLES');
      assert.equal(JSON.stringify(e).includes(secreto), false);
      assert.equal(String(e).includes(secreto), false);
      assert.equal(e.cause, undefined);
      return true;
    });
  }
});
test('un reloj de pruebas inválido falla cerrado', async () => {
  const servicio = crearServicioSesiones({
    Modelo: { db: { readyState: 1 } }, relojPruebas: () => new Date(NaN)
  });
  for (const nombre of ['consultar', 'registrarActividad', 'revocar']) {
    await assert.rejects(servicio[nombre](datos), { code: 'SESIONES_NO_DISPONIBLES' });
  }
});
