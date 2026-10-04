const crypto = require('node:crypto');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');

const Usuario = require('../models/Usuario');
const RevokedToken = require('../models/RevokedToken');
const { createApp } = require('../app');
const { encryptTotpSecret, readTotpSecret } = require('../utils/totpEncryption');

const USER_ID = '507f1f77bcf86cd799439011';
let user;
let antesDeActualizar = () => {};

function usuarioNuevo() {
  return {
    _id: USER_ID, email: 'ana@example.test', emailVerifiedAt: new Date(), sessionVersion: 0,
    twoFactorEnabled: false, twoFactorSecret: null,
    twoFactorPendingSecret: null, twoFactorPendingExpiresAt: null,
    updateOne: async update => { Object.assign(user, update); }
  };
}

Usuario.findById = () => ({ select: async () => ({ ...user, updateOne: user.updateOne }) });
Usuario.findOneAndUpdate = (filter, update) => {
  antesDeActualizar();
  const cumple = Object.entries(filter).every(([k, v]) => k === '_id' || user[k] === v);
  if (cumple) Object.assign(user, update.$set);
  const resultado = Promise.resolve(cumple ? { ...user } : null);
  return { select: () => resultado, then: (ok, ko) => resultado.then(ok, ko) };
};
RevokedToken.exists = async () => null;

const app = createApp({ rateLimits: false });
const sesion = `cyberaudit_token=${jwt.sign(
  { id: USER_ID, email: 'ana@example.test', sessionVersion: 0, jti: crypto.randomBytes(16).toString('hex') },
  process.env.JWT_SECRET, { expiresIn: '1h' }
)}`;

test.beforeEach(() => { user = usuarioNuevo(); antesDeActualizar = () => {}; });

const pendiente = (minutos = 10) => {
  const secret = speakeasy.generateSecret({ length: 20 }).base32;
  user.twoFactorPendingSecret = encryptTotpSecret(secret, USER_ID);
  user.twoFactorPendingExpiresAt = new Date(Date.now() + minutos * 60 * 1000);
  return secret;
};
const codigo = secret => speakeasy.totp({ secret, encoding: 'base32' });

test('GET /me/2fa/setup ya no existe (cambiaba datos con un GET)', async () => {
  assert.equal((await request(app).get('/me/2fa/setup').set('Cookie', sesion)).status, 404);
  assert.equal(user.twoFactorPendingSecret, null);
});

test('setup con 2FA ya activo: 409 y no toca el secreto activo', async () => {
  user.twoFactorEnabled = true;
  user.twoFactorSecret = 'activo';
  const res = await request(app).post('/me/2fa/setup').set('X-Requested-With', 'XMLHttpRequest').set('Cookie', sesion);
  assert.equal(res.status, 409);
  assert.equal(user.twoFactorSecret, 'activo');
  assert.equal(user.twoFactorPendingSecret, null);
});

test('setup con un pendiente caducado genera un secreto nuevo', async () => {
  const viejo = pendiente(-1);
  const res = await request(app).post('/me/2fa/setup').set('X-Requested-With', 'XMLHttpRequest').set('Cookie', sesion);
  assert.equal(res.status, 200);
  assert.notEqual(res.body.data.secret, viejo);
  assert.equal(readTotpSecret(user.twoFactorPendingSecret, USER_ID), res.body.data.secret);
});

test('enable con el pendiente caducado: 400 y no se activa', async () => {
  const secret = pendiente(-1);
  const res = await request(app).post('/me/2fa/enable').set('X-Requested-With', 'XMLHttpRequest').set('Cookie', sesion).send({ token: codigo(secret) });
  assert.equal(res.status, 400);
  assert.equal(user.twoFactorEnabled, false);
  assert.equal(user.twoFactorSecret, null);
});

test('enable sin configuración previa: 400', async () => {
  const res = await request(app).post('/me/2fa/enable').set('X-Requested-With', 'XMLHttpRequest').set('Cookie', sesion).send({ token: '123456' });
  assert.equal(res.status, 400);
});

test('enable con código incorrecto: 401, sigue pendiente y no se activa', async () => {
  pendiente();
  const res = await request(app).post('/me/2fa/enable').set('X-Requested-With', 'XMLHttpRequest').set('Cookie', sesion).send({ token: '000000' });
  assert.equal(res.status, 401);
  assert.equal(user.twoFactorEnabled, false);
  assert.notEqual(user.twoFactorPendingSecret, null);
});

test('enable: si el pendiente cambia entre la verificación y la activación, 409 y no se activa', async () => {
  const secret = pendiente();
  antesDeActualizar = () => { user.twoFactorPendingSecret = encryptTotpSecret(speakeasy.generateSecret().base32, USER_ID); };
  const res = await request(app).post('/me/2fa/enable').set('X-Requested-With', 'XMLHttpRequest').set('Cookie', sesion).send({ token: codigo(secret) });
  assert.equal(res.status, 409);
  assert.equal(user.twoFactorEnabled, false);
  assert.equal(user.twoFactorSecret, null);
});

test('enable correcto: el pendiente pasa a activo y se vacía', async () => {
  const secret = pendiente();
  const cifrado = user.twoFactorPendingSecret;
  const res = await request(app).post('/me/2fa/enable').set('X-Requested-With', 'XMLHttpRequest').set('Cookie', sesion).send({ token: codigo(secret) });
  assert.equal(res.status, 200);
  assert.equal(user.twoFactorEnabled, true);
  assert.equal(user.twoFactorSecret, cifrado);
  assert.equal(user.twoFactorPendingSecret, null);
  assert.equal(user.twoFactorPendingExpiresAt, null);
});

test('disable también borra un secreto pendiente', async () => {
  const activo = speakeasy.generateSecret({ length: 20 }).base32;
  user.twoFactorEnabled = true;
  user.twoFactorSecret = encryptTotpSecret(activo, USER_ID);
  pendiente();
  const res = await request(app).post('/me/2fa/disable').set('X-Requested-With', 'XMLHttpRequest').set('Cookie', sesion).send({ token: codigo(activo) });
  assert.equal(res.status, 200);
  assert.equal(user.twoFactorEnabled, false);
  assert.equal(user.twoFactorPendingSecret, null);
});
