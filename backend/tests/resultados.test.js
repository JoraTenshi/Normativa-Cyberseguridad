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
  const req = request(app).post('/resultado');
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
