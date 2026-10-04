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

const USER_ID = '64b000000000000000000001';
const RESULTADO_ID = '64b0000000000000000000aa';
const app = createApp({ rateLimits: false });

// Resultado guardado en el límite: se muestra 30 % pero el nivel exacto es Crítico.
const guardado = {
  _id: RESULTADO_ID, usuario: USER_ID, normativa: 'lssi_ce', respuestas: [],
  algoritmo_version: '2', porcentaje_exacto: 29.73, porcentaje: 30, nivel: 'Crítico',
  puntuaciones_bloques: [], createdAt: new Date('2026-10-04T10:00:00Z')
};

Resultado.find = () => ({ sort: async () => [guardado] });
Resultado.findOne = async () => guardado;
Normativa.find = async () => [];
Normativa.findOne = async () => null;
RevokedToken.exists = async () => null;
Usuario.findById = () => ({ select: async () => ({ emailVerifiedAt: new Date(), sessionVersion: 0 }) });

const sesion = `cyberaudit_token=${jwt.sign(
  { id: USER_ID, sessionVersion: 0, jti: generateJti() }, process.env.JWT_SECRET, { expiresIn: '1h' }
)}`;

test('GET /me/historial devuelve el nivel guardado, no uno recalculado, y sin puntos brutos', async () => {
  const res = await request(app).get('/me/historial').set('Cookie', sesion);
  assert.equal(res.status, 200);
  const [item] = res.body.data;
  assert.equal(item.porcentaje, 30);
  assert.equal(item.nivel, 'Crítico');
  assert.equal(item.algoritmo_version, '2');
  assert.equal('puntuacion_total' in item, false);
});

test('GET /me/historial/:id devuelve el nivel y el valor exacto guardados, sin puntos brutos', async () => {
  const res = await request(app).get(`/me/historial/${RESULTADO_ID}`).set('Cookie', sesion);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.nivel, 'Crítico');
  assert.equal(res.body.data.porcentaje_exacto, 29.73);
  assert.equal('puntuacion_total' in res.body.data, false);
  assert.equal('puntuacion_maxima' in res.body.data, false);
});
