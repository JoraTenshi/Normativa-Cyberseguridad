'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  VERSION_POLITICA, DURACION_MAXIMA_MS, INACTIVIDAD_MAXIMA_MS,
  crearEstadoSesion, evaluarVigencia, prepararActividad
} = require('../services/politicaSesion');

// Reloj fijo del servidor: no espera 30 minutos/8 horas y no usa datos reales.
const inicio = new Date('2026-10-11T08:00:00.000Z');
const en = ms => new Date(inicio.getTime() + ms);
const nueva = cambios => ({ ...crearEstadoSesion({ ahora: inicio }), ...cambios });

test('política aprobada: ocho horas y treinta minutos', () => {
  assert.equal(VERSION_POLITICA, 1);
  assert.equal(DURACION_MAXIMA_MS, 28_800_000);
  assert.equal(INACTIVIDAD_MAXIMA_MS, 1_800_000);
});
test('una sesión empieza sin persistencia voluntaria ni revocación', () => {
  const s = nueva();
  assert.equal(s.mantenerSesion, false);
  assert.equal(s.revocadaEn, null);
  assert.deepEqual(s.expiraEn, en(DURACION_MAXIMA_MS));
  assert.deepEqual(s.ultimaActividadEn, inicio);
});
test('mantener sesión no amplía ninguno de los dos límites', () => {
  for (const mantenerSesion of [false, true]) {
    const s = crearEstadoSesion({ ahora: inicio, mantenerSesion });
    assert.equal(s.mantenerSesion, mantenerSesion);
    assert.deepEqual(s.expiraEn, en(DURACION_MAXIMA_MS));
    assert.equal(evaluarVigencia(s, en(INACTIVIDAD_MAXIMA_MS)).codigo, 'SESION_INACTIVA');
  }
});
test('no comparte fechas mutables con el reloj de entrada', () => {
  const reloj = new Date(inicio), s = crearEstadoSesion({ ahora: reloj });
  reloj.setFullYear(2040);
  assert.deepEqual(s.autenticadaEn, inicio);
  s.ultimaActividadEn.setFullYear(2041);
  assert.deepEqual(s.autenticadaEn, inicio);
});
test('rechaza booleanos ambiguos y relojes inválidos al crear', () => {
  for (const mantenerSesion of ['true', 'false', 1, 0, null, {}, []]) {
    assert.throws(() => crearEstadoSesion({ ahora: inicio, mantenerSesion }), TypeError);
  }
  for (const ahora of [null, '2026-10-11', 0, new Date(NaN), {}]) {
    assert.throws(() => crearEstadoSesion({ ahora }), TypeError);
  }
});
test('está vigente justo antes del límite de inactividad', () => {
  const r = evaluarVigencia(nueva(), en(INACTIVIDAD_MAXIMA_MS - 1));
  assert.equal(r.valida, true);
  assert.equal(r.restanteMs, 1);
  assert.deepEqual(r.limiteEfectivoEn, en(INACTIVIDAD_MAXIMA_MS));
});
test('caduca exactamente al cumplir treinta minutos y no revive después', () => {
  for (const desplazamiento of [0, 1, 60_000]) {
    const r = evaluarVigencia(nueva(), en(INACTIVIDAD_MAXIMA_MS + desplazamiento));
    assert.deepEqual(r, { valida: false, codigo: 'SESION_INACTIVA' });
  }
});
test('se impone el límite absoluto aunque haya habido actividad reciente', () => {
  const s = nueva({ ultimaActividadEn: en(DURACION_MAXIMA_MS - 1_000) });
  assert.equal(evaluarVigencia(s, en(DURACION_MAXIMA_MS - 1)).valida, true);
  for (const desplazamiento of [0, 1, 60_000]) {
    assert.equal(evaluarVigencia(s, en(DURACION_MAXIMA_MS + desplazamiento)).codigo, 'SESION_LIMITE_ABSOLUTO');
  }
});
test('una sesión revocada no se valida ni admite actividad', () => {
  const s = nueva({ revocadaEn: en(1_000) });
  assert.equal(evaluarVigencia(s, en(2_000)).codigo, 'SESION_REVOCADA');
  assert.deepEqual(prepararActividad(s, en(2_000)), { permitida: false, codigo: 'SESION_REVOCADA' });
});
test('un salto hacia atrás del reloj no prolonga la sesión', () => {
  assert.equal(evaluarVigencia(nueva(), en(-1)).codigo, 'SESION_DATOS_INVALIDOS');
});
test('registros ausentes o malformados se rechazan', () => {
  for (const s of [null, undefined, {}, [], 'sesion']) {
    assert.equal(evaluarVigencia(s, inicio).valida, false);
  }
  for (const campo of ['autenticadaEn', 'ultimaActividadEn', 'expiraEn']) {
    for (const valor of [null, undefined, inicio.toISOString(), 0, new Date(NaN)]) {
      assert.equal(evaluarVigencia(nueva({ [campo]: valor }), inicio).codigo, 'SESION_DATOS_INVALIDOS');
    }
  }
});
test('rechaza versiones, preferencias y cronologías no válidas', () => {
  for (const cambio of [
    { versionPolitica: 2 }, { versionPolitica: '1' }, { mantenerSesion: 'true' },
    { expiraEn: en(DURACION_MAXIMA_MS + 1) }, { expiraEn: en(DURACION_MAXIMA_MS - 1) },
    { ultimaActividadEn: en(-1) }, { ultimaActividadEn: en(1) },
    { ultimaActividadEn: en(DURACION_MAXIMA_MS) },
    { revocadaEn: undefined }, { revocadaEn: en(-1) }, { revocadaEn: en(1) }, { revocadaEn: 'ahora' }
  ]) assert.equal(evaluarVigencia(nueva(cambio), inicio).codigo, 'SESION_DATOS_INVALIDOS');
});
test('un reloj inválido deniega, nunca autoriza por defecto', () => {
  for (const reloj of [null, 0, inicio.toISOString(), new Date(NaN)]) {
    assert.equal(evaluarVigencia(nueva(), reloj).codigo, 'SESION_DATOS_INVALIDOS');
  }
});
test('consultar vigencia no modifica la actividad ni otros campos', () => {
  const s = nueva(), copia = structuredClone(s);
  evaluarVigencia(s, en(60_000));
  assert.deepEqual(s, copia);
});
test('preparar actividad solo propone la fecha del servidor sin persistir nada', () => {
  const s = nueva(), copia = structuredClone(s);
  const r = prepararActividad(s, en(60_000));
  assert.equal(r.permitida, true);
  assert.deepEqual(r.cambios, { ultimaActividadEn: en(60_000) });
  assert.deepEqual(s, copia);
  const actualizada = { ...s, ...r.cambios };
  assert.equal(evaluarVigencia(actualizada, en(INACTIVIDAD_MAXIMA_MS)).valida, true);
  assert.deepEqual(actualizada.expiraEn, s.expiraEn);
});
test('actividad repetida no mueve el límite de ocho horas', () => {
  let s = nueva();
  for (let minuto = 20; minuto < 480; minuto += 20) {
    const r = prepararActividad(s, en(minuto * 60_000));
    assert.equal(r.permitida, true);
    s = { ...s, ...r.cambios };
  }
  assert.deepEqual(s.expiraEn, en(DURACION_MAXIMA_MS));
  assert.equal(prepararActividad(s, en(DURACION_MAXIMA_MS)).permitida, false);
});
test('preparar actividad no resucita una sesión que ya caducó por inactividad', () => {
  const r = prepararActividad(nueva(), en(INACTIVIDAD_MAXIMA_MS));
  assert.equal(r.permitida, false);
  assert.equal(Object.hasOwn(r, 'cambios'), false);
});
test('updatedAt u otras fechas técnicas no cuentan como actividad del usuario', () => {
  const s = nueva({ updatedAt: en(INACTIVIDAD_MAXIMA_MS - 1), ultimoSondeo: en(INACTIVIDAD_MAXIMA_MS - 1) });
  assert.equal(evaluarVigencia(s, en(INACTIVIDAD_MAXIMA_MS)).codigo, 'SESION_INACTIVA');
});
