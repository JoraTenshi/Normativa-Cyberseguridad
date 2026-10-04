const crypto = require('node:crypto');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const Normativa = require('../models/Normativa');
const Resultado = require('../models/Resultado');
const Usuario = require('../models/Usuario');
const RevokedToken = require('../models/RevokedToken');
const { createApp } = require('../app');
const { generateJti } = require('../middleware/auth');
const { cargarNormativas } = require('../seed/seed');

const USER_ID = '64b000000000000000000001';
const app = createApp({ rateLimits: false });

// Normativa real del seed: LSSI-CE (5 bloques, 11 preguntas)
const lssi = cargarNormativas().find(n => n.id === 'lssi_ce');
const ids = lssi.bloques.flatMap(b => b.preguntas.map(p => p.id));

let creados;
Normativa.findOne = async ({ id }) => (id === lssi.id ? lssi : null);
Normativa.find = async () => [];
Resultado.create = async doc => { creados.push(doc); return { _id: 'resultado-1', ...doc }; };
RevokedToken.exists = async () => null;
Usuario.findById = () => ({ select: async () => ({ emailVerifiedAt: new Date(), sessionVersion: 0 }) });

const sesion = `cyberaudit_token=${jwt.sign(
  { id: USER_ID, sessionVersion: 0, jti: generateJti() }, process.env.JWT_SECRET, { expiresIn: '1h' }
)}`;

test.beforeEach(() => { creados = []; });

const todas = (valor = 1) => ids.map(pregunta_id => ({ pregunta_id, valor }));
const enviar = (respuestas, { normativa = 'lssi_ce', conSesion = true } = {}) => {
  const req = request(app).post('/resultado').set('X-Requested-With', 'XMLHttpRequest'); // como el frontend
  if (conSesion) req.set('Cookie', sesion);
  return req.send({ normativa, respuestas });
};

test('cuestionario completo con sesión: 201 y se guarda un Resultado', async () => {
  const res = await enviar(todas(1));
  assert.equal(res.status, 201);
  assert.equal(res.body.data.porcentaje, 100);
  assert.equal(res.body.data.id, 'resultado-1');
  assert.equal(creados.length, 1);
  assert.equal(creados[0].respuestas.length, ids.length);
});

test('cuestionario completo sin sesión: 201 y no se guarda nada', async () => {
  const res = await enviar(todas(0.5), { conSesion: false });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.id, null);
  assert.equal(creados.length, 0);
});

const sustituir = (i, r) => todas().map((x, j) => (j === i ? r : x));

for (const [caso, respuestas, code, extra] of [
  ['una entrada null',          sustituir(0, null),                                  'RESPUESTA_INVALIDA', { indice: 0 }],
  ['un número suelto',          sustituir(1, 7),                                     'RESPUESTA_INVALIDA', { indice: 1 }],
  ['una pregunta de otra norma', sustituir(2, { pregunta_id: 'nis2_q1', valor: 1 }), 'RESPUESTA_INVALIDA', { indice: 2 }],
  ['pregunta_id no string',     sustituir(3, { pregunta_id: 42, valor: 1 }),         'RESPUESTA_INVALIDA', { indice: 3 }],
  ['un valor 0.7',              sustituir(4, { pregunta_id: ids[4], valor: 0.7 }),   'RESPUESTA_INVALIDA', { indice: 4 }],
  ['un valor "1" (string)',     sustituir(5, { pregunta_id: ids[5], valor: '1' }),   'RESPUESTA_INVALIDA', { indice: 5 }],
  ['una pregunta repetida',     [...todas(), { pregunta_id: ids[0], valor: 0 }],    'RESPUESTA_DUPLICADA', { pregunta_id: ids[0] }],
  ['faltan preguntas',          todas().slice(0, -2),                                'CUESTIONARIO_INCOMPLETO', { faltan: ids.slice(-2) }],
]) {
  test(`${caso}: 400 ${code} y no se crea ningún Resultado`, async () => {
    const res = await enviar(respuestas);
    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.code, code);
    assert.equal(typeof res.body.error, 'string');
    for (const [k, v] of Object.entries(extra)) assert.deepEqual(res.body[k], v, k);
    assert.equal(creados.length, 0);
  });
}

test('normativa desconocida: 404 y no se crea ningún Resultado', async () => {
  const res = await enviar(todas(), { normativa: 'no_existe' });
  assert.equal(res.status, 404);
  assert.equal(creados.length, 0);
});

test('respuestas vacío o que no es un array: 400 sin consultar la normativa', async () => {
  for (const respuestas of [[], 'x', null]) {
    const res = await enviar(respuestas);
    assert.equal(res.status, 400);
  }
  assert.equal(creados.length, 0);
});

// ── Algoritmo v2 (docs/contrato-evaluacion.md) ───────────────────────────────
const conValores = valores => ids.map(pregunta_id => ({ pregunta_id, valor: valores[pregunta_id] ?? 0 }));
const soloCOM = { 'LSSI-COM-001': 1, 'LSSI-COM-002': 1, 'LSSI-COM-003': 1 };

test('v2: el índice pondera por peso_bloque (solo LSSI-COM, peso 26, al 100 % → 26)', async () => {
  // Con la fórmula anterior (pesos de pregunta) daría 26/94 ≈ 28.
  const res = await enviar(conValores(soloCOM));
  assert.equal(res.status, 201);
  assert.equal(res.body.data.porcentaje_exacto, 26);
  assert.equal(res.body.data.porcentaje, 26);
  assert.equal(res.body.data.nivel, 'Crítico');
});

test('v2: el nivel se decide con el valor exacto (29,73 se muestra 30 pero es Crítico)', async () => {
  const res = await enviar(conValores({ ...soloCOM, 'LSSI-INT-002': 0.5 }));
  assert.ok(res.body.data.porcentaje_exacto > 29.5 && res.body.data.porcentaje_exacto < 30);
  assert.equal(res.body.data.porcentaje, 30);
  assert.equal(res.body.data.nivel, 'Crítico');
  assert.equal(creados[0].nivel, 'Crítico');
});

test('v2: formato de respuesta acordado, sin puntos brutos', async () => {
  const { body } = await enviar(todas(1));
  const d = body.data;
  assert.equal(d.algoritmo_version, '2');
  assert.equal(d.sin_base_evaluable, false);
  assert.equal(d.nivel, 'Alto');
  assert.match(d.mensaje, /^Índice de autoevaluación alto/);
  assert.equal('puntuacion_total' in d, false);
  assert.equal('puntuacion_maxima' in d, false);
  assert.equal(d.puntuaciones_bloques.length, lssi.bloques.length);
  for (const b of d.puntuaciones_bloques) {
    assert.deepEqual(Object.keys(b).sort(),
      ['bloque_id', 'evaluable', 'max_puntuacion', 'nombre', 'peso_bloque', 'porcentaje', 'porcentaje_exacto', 'puntuacion']);
  }
  assert.ok(Array.isArray(d.remediaciones));
  assert.ok(Array.isArray(d.cobertura_estimada));
});

test('v2: el Resultado guardado incluye versión, valor exacto, nivel y desglose', async () => {
  await enviar(conValores(soloCOM));
  const r = creados[0];
  assert.equal(r.algoritmo_version, '2');
  assert.equal(r.porcentaje_exacto, 26);
  assert.equal(r.porcentaje, 26);
  assert.equal(r.nivel, 'Crítico');
  assert.equal('puntuacion_total' in r, false);
  const com = r.puntuaciones_bloques.find(b => b.bloque_id === 'LSSI-COM');
  assert.equal(com.peso_bloque, 26);
  assert.equal(com.porcentaje, 100);
});

test('el modelo Resultado exige algoritmo_version y acepta los niveles del contrato', () => {
  const base = { normativa: 'lssi_ce', normativa_nombre: 'LSSI-CE', respuestas: [] };
  assert.ok(new Resultado(base).validateSync().errors.algoritmo_version);
  assert.equal(new Resultado({ ...base, algoritmo_version: '2', nivel: 'Crítico' }).validateSync(), undefined);
  assert.ok(new Resultado({ ...base, algoritmo_version: '2', nivel: 'Excelente' }).validateSync().errors.nivel);
});

// ── Copia guardada en el Resultado (tarea 9) ─────────────────────────────────
test('el Resultado guarda la copia de lo calculado: nombre, cuestionario, remediaciones y cobertura', async () => {
  const otra = cargarNormativas().find(n => n.id === 'nis2');
  Normativa.find = async () => [otra];
  try {
    const { body } = await enviar(conValores(soloCOM));
    const r = creados[0];

    assert.equal(r.normativa_nombre, lssi.nombre);
    assert.deepEqual(r.cuestionario, lssi.bloques.map(b => ({
      id: b.id, nombre: b.nombre, preguntas: b.preguntas.map(p => ({ id: p.id, texto: p.texto, peso: p.peso }))
    })));
    assert.equal(r.remediaciones.length, ids.length - 3, 'todas menos las 3 de LSSI-COM');
    assert.deepEqual(r.remediaciones, body.data.remediaciones);
    assert.equal(r.cobertura_estimada.length, 1);
    assert.deepEqual(r.cobertura_estimada, body.data.cobertura_estimada);
  } finally {
    Normativa.find = async () => [];
  }
});

test('el Resultado del modelo exige el nombre de la normativa', () => {
  const r = new Resultado({ normativa: 'lssi_ce', respuestas: [], algoritmo_version: '2' });
  assert.ok(r.validateSync().errors.normativa_nombre);
});

test('MongoDB no disponible: 503 (no 500) y no se crea ningún Resultado', async () => {
  const original = Normativa.findOne;
  try {
    for (const err of [
      Object.assign(new Error('Server selection timed out after 5000 ms'), { name: 'MongooseServerSelectionError' }),
      Object.assign(new Error('connection refused'), { name: 'MongoNetworkError' }),
      new Error('Operation `normativas.findOne()` buffering timed out after 10000ms'),
    ]) {
      Normativa.findOne = async () => { throw err; };
      const res = await enviar(todas(1), { conSesion: false });
      assert.equal(res.status, 503, err.name);
    }
    Normativa.findOne = async () => { throw new TypeError('bug'); };
    assert.equal((await enviar(todas(1), { conSesion: false })).status, 500, 'un fallo de código sigue siendo 500');
    assert.equal(creados.length, 0);
  } finally {
    Normativa.findOne = original;
  }
});
