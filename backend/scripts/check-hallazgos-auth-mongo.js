'use strict';
// Tres hallazgos de autenticación de la evaluación (23/10/2026) sobre Mongo temporal del runner:
// contraseñas de más de 72 bytes (bcrypt trunca), contador de bloqueo con accesos concurrentes y
// reutilización de un código TOTP entre retos. Solo cuentas sintéticas; sin .env, correo ni navegador.
const crypto = require('node:crypto');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';
process.env.CORS_ORIGIN = 'https://localhost';
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const speakeasy = require('speakeasy');
const { createApp } = require('../app');
const Usuario = require('../models/Usuario');
const { encryptTotpSecret } = require('../utils/totpEncryption');

async function comprobar({ uri, nombreBD }) {
  const url = new URL(uri);
  if (url.hostname !== '127.0.0.1' || !url.port || url.port === '27017' || url.username || url.password ||
    !/^nc_org03_[a-f0-9]{24}$/.test(nombreBD)) throw Error('Solo base temporal del runner');
  const resultados = [], fallos = [];
  const caso = async (n, fn) => {
    try { await fn(); resultados.push(n); console.log('OK ' + n); }
    catch (e) { fallos.push(n); console.log('FALLO ' + n + ' — ' + e.message.split('\n')[0]); }
  };
  let numero = 0;
  const clave = 'Solo-Prueba-91a';
  const cuenta = async (datos = {}) => Usuario.create({
    nombre: 'Cuenta sintética', email: 'hallazgo' + (++numero) + '@example.invalid',
    password: clave, emailVerifiedAt: new Date(), ...datos
  });
  const app = createApp({ rateLimits: false });
  const call = (method, path, cookie) => {
    const req = request(app)[method](path).set('X-Requested-With', 'XMLHttpRequest').set('Origin', 'https://localhost');
    return cookie ? req.set('Cookie', cookie) : req;
  };
  const cookie = (r, n) => (r.headers['set-cookie'] ?? []).find(c => c.startsWith(n + '=') && !c.startsWith(n + '=;'))?.split(';')[0];
  const login = (email, password) => call('post', '/auth/login').send({ email, password });
  const pendiente = r => cookie(r, 'cyberaudit_2fa_pending');
  const sesion = r => cookie(r, 'cyberaudit_token');
  const codigo = (secret, desplazamiento = 0) =>
    speakeasy.totp({ secret, encoding: 'base32', time: Math.floor(Date.now() / 1000) + desplazamiento });
  const conMfa = async () => {
    const u = await cuenta();
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    await Usuario.updateOne({ _id: u._id }, { $set: { twoFactorEnabled: true, twoFactorSecret: encryptTotpSecret(secret, u._id) } });
    return { u, secret };
  };
  const conSesionMfa = async (u, secret) => {
    const p = pendiente(await login(u.email, clave));
    const r = await call('post', '/auth/2fa/verify', p).send({ token: codigo(secret) });
    assert.equal(r.status, 200, 'verify inicial');
    return sesion(r);
  };
  try {
    await mongoose.connect(uri, { dbName: nombreBD, serverSelectionTimeoutMS: 2500 });
    for (const modelo of Object.values(mongoose.models)) await modelo.init();

    // ── A. bcrypt solo usa los primeros 72 bytes ────────────────────────────
    const de72 = 'Aa1' + 'x'.repeat(69);
    assert.equal(Buffer.byteLength(de72), 72);
    await caso('A1 registro con contraseña de 73 bytes: 400', async () => {
      const r = await call('post', '/auth/register').send({ nombre: 'Larga', email: 'larga@example.invalid', password: de72 + 'y' });
      assert.equal(r.status, 400);
      assert.equal(await Usuario.countDocuments({ email: 'larga@example.invalid' }), 0);
    });
    await caso('A2 se cuentan bytes, no caracteres (40 "ñ" = 80 bytes): 400', async () => {
      const r = await call('post', '/auth/register').send({ nombre: 'Eñe', email: 'enye@example.invalid', password: 'Aa1' + 'ñ'.repeat(40) });
      assert.equal(r.status, 400);
    });
    await caso('A3 el modelo tampoco guarda una contraseña de más de 72 bytes', async () => {
      await assert.rejects(cuenta({ password: de72 + 'y' }), e => e.name === 'ValidationError');
    });
    await caso('A4 cuenta con 72 bytes exactos: entra con su contraseña y no con una más larga que empiece igual', async () => {
      const u = await cuenta({ password: de72 });
      assert.equal((await login(u.email, de72)).status, 200);
      assert.equal((await login(u.email, de72 + 'cualquier-sufijo')).status, 401);
    });
    await caso('A5 reset-password con 73 bytes: 400 y el enlace sigue sin usar', async () => {
      const u = await cuenta(), token = crypto.randomBytes(32).toString('hex');
      await Usuario.updateOne({ _id: u._id }, { $set: {
        resetPasswordToken: crypto.createHash('sha256').update(token).digest('hex'),
        resetPasswordExpires: new Date(Date.now() + 600000) } });
      assert.equal((await call('post', '/auth/reset-password').send({ token, password: de72 + 'y' })).status, 400);
      const tras = await Usuario.findById(u._id).select('+resetPasswordToken');
      assert.ok(tras.resetPasswordToken, 'el enlace no debe consumirse');
      assert.equal((await login(u.email, clave)).status, 200);
    });

    // ── B. contador de intentos fallidos con peticiones simultáneas ─────────
    await caso('B1 cinco fallos simultáneos cuentan cinco y bloquean la cuenta', async () => {
      const u = await cuenta();
      const estados = (await Promise.all(Array.from({ length: 5 }, () => login(u.email, 'Incorrecta-1')))).map(r => r.status);
      assert.deepEqual(estados, [401, 401, 401, 401, 401]);
      const tras = await Usuario.findById(u._id);
      assert.equal(tras.loginAttempts, 5, 'intentos registrados: ' + tras.loginAttempts);
      assert.ok(tras.lockUntil > new Date(), 'la cuenta debe quedar bloqueada');
      assert.equal((await login(u.email, clave)).status, 429);
    });
    await caso('B2 diez fallos simultáneos tras cuatro previos no se pierden', async () => {
      const u = await cuenta({ loginAttempts: 4 });
      await Promise.all(Array.from({ length: 10 }, () => login(u.email, 'Incorrecta-2')));
      const tras = await Usuario.findById(u._id);
      assert.ok(tras.loginAttempts >= 5 && tras.lockUntil > new Date(), 'intentos: ' + tras.loginAttempts);
    });
    await caso('B3 un acceso correcto reinicia el contador', async () => {
      const u = await cuenta({ loginAttempts: 3 });
      assert.equal((await login(u.email, clave)).status, 200);
      assert.equal((await Usuario.findById(u._id)).loginAttempts, 0);
    });
  } finally { await mongoose.disconnect(); }
  if (fallos.length) throw new Error(fallos.length + ' caso(s) fallidos: ' + fallos.join(' | '));
  return resultados;
}
module.exports = { comprobar };
