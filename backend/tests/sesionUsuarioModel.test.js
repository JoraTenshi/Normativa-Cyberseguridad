'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const SesionUsuario = require('../models/SesionUsuario');
const { crearEstadoSesion, DURACION_MAXIMA_MS } = require('../services/politicaSesion');

const inicio = new Date('2026-10-11T08:00:00.000Z');
function ficha(cambios = {}) {
  return {
    usuario: new mongoose.Types.ObjectId(),
    identificadorHash: 'a'.repeat(64),
    versionCredenciales: 0,
    ...crearEstadoSesion({ ahora: inicio }),
    ...cambios
  };
}

test('sesión con datos sintéticos válida, sin abrir una conexión Mongo', () => {
  const s = new SesionUsuario(ficha());
  assert.equal(s.validateSync(), undefined);
  assert.equal(mongoose.connection.readyState, 0);
  assert.equal(s.mantenerSesion, false);
});
for (const campo of ['usuario', 'identificadorHash', 'versionCredenciales', 'autenticadaEn', 'ultimaActividadEn', 'expiraEn']) {
  test('exige el campo ' + campo, () => {
    for (const valor of [undefined, null]) assert.ok(new SesionUsuario(ficha({ [campo]: valor })).validateSync()?.errors[campo]);
  });
}
test('identificador debe ser una huella hexadecimal, no un JWT o un valor arbitrario', () => {
  for (const valor of ['eyJ.demo.firma', 'a'.repeat(63), 'A'.repeat(64), 123, true, {}, []]) {
    assert.ok(new SesionUsuario(ficha({ identificadorHash: valor })).validateSync()?.errors.identificadorHash);
  }
  assert.equal(SesionUsuario.schema.path('identificadorHash').options.select, false);
});
test('versión de credenciales debe ser un entero seguro no negativo', () => {
  for (const valor of [-1, 0.5, '1', true, Number.MAX_SAFE_INTEGER + 1]) {
    assert.ok(new SesionUsuario(ficha({ versionCredenciales: valor })).validateSync()?.errors.versionCredenciales);
  }
});
test('no convierte una preferencia ambigua en consentimiento', () => {
  for (const valor of ['true', 'false', 1, 0, null, {}, []]) {
    assert.ok(new SesionUsuario(ficha({ mantenerSesion: valor })).validateSync()?.errors.mantenerSesion);
  }
  assert.equal(new SesionUsuario(ficha({ mantenerSesion: true })).validateSync(), undefined);
});
test('la versión de política desconocida no se admite', () => {
  for (const valor of [0, 2, '1', null]) assert.ok(new SesionUsuario(ficha({ versionPolitica: valor })).validateSync()?.errors.versionPolitica);
});
test('el vencimiento es exactamente ocho horas, también cuando se recuerda sesión', () => {
  for (const mantenerSesion of [false, true]) {
    for (const desviacion of [-1, 1, 16 * 60 * 60 * 1000]) {
      const expiraEn = new Date(inicio.getTime() + DURACION_MAXIMA_MS + desviacion);
      assert.ok(new SesionUsuario(ficha({ mantenerSesion, expiraEn })).validateSync()?.errors.expiraEn);
    }
  }
});
test('la actividad debe estar entre la autenticación y el vencimiento', () => {
  for (const ultimaActividadEn of [new Date(inicio.getTime() - 1), new Date(inicio.getTime() + DURACION_MAXIMA_MS)]) {
    assert.ok(new SesionUsuario(ficha({ ultimaActividadEn })).validateSync()?.errors.ultimaActividadEn);
  }
});
test('la revocación puede registrarse, pero no antes de autenticar', () => {
  assert.equal(new SesionUsuario(ficha({ revocadaEn: inicio })).validateSync(), undefined);
  assert.ok(new SesionUsuario(ficha({ revocadaEn: new Date(inicio.getTime() - 1) })).validateSync()?.errors.revocadaEn);
});
test('rechaza campos ajenos, credenciales y permisos dentro de la sesión', () => {
  for (const campo of ['password', 'token', 'jwt', 'cookie', 'twoFactorSecret', 'rol', 'organizacion', 'permisos']) {
    assert.throws(() => new SesionUsuario(ficha({ [campo]: 'no guardar' })), { name: 'StrictModeError' });
  }
});
test('campos fijados por el servidor se declaran inmutables; esto no sustituye al servicio', () => {
  for (const campo of ['usuario', 'identificadorHash', 'versionCredenciales', 'versionPolitica', 'autenticadaEn', 'expiraEn', 'mantenerSesion']) {
    assert.equal(SesionUsuario.schema.path(campo).options.immutable, true);
  }
});
test('declara unicidad y búsqueda de sesiones sin TTL ni borrado automático', () => {
  const indices = SesionUsuario.schema.indexes();
  assert.equal(indices.length, 2);
  assert.deepEqual(indices[0][0], { identificadorHash: 1 });
  assert.equal(indices[0][1].unique, true);
  for (const [, opciones] of indices) assert.equal(Object.hasOwn(opciones, 'expireAfterSeconds'), false);
  assert.equal(SesionUsuario.collection.name, 'sesiones_usuario');
  assert.equal(SesionUsuario.schema.options.strict, 'throw');
  assert.equal(SesionUsuario.schema.options.timestamps, true);
  // Solo declaración. No se ha creado ni probado ningún índice en una BD.
});
