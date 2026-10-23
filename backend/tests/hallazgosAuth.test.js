const crypto = require('node:crypto');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';

// Tres hallazgos de autenticación de la evaluación (23/10/2026). Estas pruebas no usan MongoDB; la
// concurrencia real se comprueba con scripts/run-hallazgos-auth-mongo.js sobre un Mongo temporal.
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const speakeasy = require('speakeasy');

const Usuario = require('../models/Usuario');
const { createApp } = require('../app');
const { MAX_PASSWORD_BYTES, excedeLimiteBcrypt } = require('../utils/password');
const { pasoDelCodigo, consumirPaso, PERIODO_S } = require('../utils/totpPaso');

const app = createApp({ rateLimits: false });
const post = (ruta, cuerpo) => request(app).post(ruta).set('X-Requested-With', 'XMLHttpRequest').send(cuerpo);
const de72 = 'Aa1' + 'x'.repeat(69);

// ── A. bcrypt trunca a 72 bytes ─────────────────────────────────────────────
test('A: el límite se mide en bytes UTF-8, no en caracteres', () => {
  assert.equal(MAX_PASSWORD_BYTES, 72);
  assert.equal(excedeLimiteBcrypt(de72), false);
  assert.equal(excedeLimiteBcrypt(de72 + 'y'), true);
  assert.equal(excedeLimiteBcrypt('Aa1' + 'ñ'.repeat(35)), true, '38 caracteres pero 73 bytes');
  assert.equal(excedeLimiteBcrypt('Aa1' + 'ñ'.repeat(34)), false, '71 bytes');
});

test('A: el modelo rechaza guardar una contraseña de más de 72 bytes, pero no un hash existente', () => {
  const base = { nombre: 'Ana', email: 'ana@example.invalid' };
  assert.ok(new Usuario({ ...base, password: de72 + 'y' }).validateSync().errors.password);
  assert.equal(new Usuario({ ...base, password: de72 }).validateSync(), undefined);
  assert.equal(new Usuario({ ...base, password: '$2a$12$' + 'x'.repeat(53) }).validateSync(), undefined);
});

test('A: registro y restablecimiento con más de 72 bytes responden 400', async (t) => {
  t.mock.method(Usuario, 'findOne', async () => { throw new Error('no debe consultar la base de datos'); });
  t.mock.method(Usuario, 'updateOne', async () => { throw new Error('no debe consultar la base de datos'); });
  const r1 = await post('/auth/register', { nombre: 'Ana', email: 'ana@example.invalid', password: de72 + 'y' });
  assert.equal(r1.status, 400);
  assert.match(r1.body.error, /72 bytes/);
  const r2 = await post('/auth/reset-password', { token: 'a'.repeat(64), password: 'Aa1' + 'ñ'.repeat(40) });
  assert.equal(r2.status, 400);
  assert.match(r2.body.error, /72 bytes/);
});

test('A: el login con más de 72 bytes falla sin comparar contra la cuenta (no hay equivalencia por truncado)', async (t) => {
  const consulta = t.mock.method(Usuario, 'findOne', async () => { throw new Error('no debe buscar la cuenta'); });
  const r = await post('/auth/login', { email: 'ana@example.invalid', password: de72 + 'cualquier-sufijo' });
  assert.equal(r.status, 401);
  assert.equal(r.body.error, 'Credenciales incorrectas');
  assert.equal(consulta.mock.callCount(), 0);
});

// ── B. contador de bloqueo atómico ──────────────────────────────────────────
test('B: recordFailedLogin es una sola actualización atómica (sin leer y reescribir el contador)', async (t) => {
  const llamadas = [];
  t.mock.method(Usuario, 'updateOne', async (...args) => { llamadas.push(args); return { matchedCount: 1 }; });
  const u = new Usuario({ nombre: 'Ana', email: 'ana@example.invalid', password: 'x', loginAttempts: 2 });
  await u.recordFailedLogin();

  assert.equal(llamadas.length, 1);
  const [filtro, pipeline] = llamadas[0];
  assert.deepEqual(filtro, { _id: u._id });
  assert.ok(Array.isArray(pipeline), 'debe ser un pipeline de actualización');
  assert.deepEqual(pipeline[0].$set.loginAttempts, { $add: [{ $ifNull: ['$loginAttempts', 0] }, 1] });
  const cond = pipeline[1].$set.lockUntil.$cond;
  assert.deepEqual(cond[0], { $gte: ['$loginAttempts', 5] });
  assert.ok(cond[1] instanceof Date && cond[1] > new Date());
  assert.equal(cond[2], '$lockUntil');
  assert.equal(JSON.stringify(pipeline).includes('"loginAttempts":3'), false, 'no debe escribir un valor calculado en Node');
});

// ── C. un código TOTP vale una vez ──────────────────────────────────────────
const secret = speakeasy.generateSecret({ length: 20 }).base32;
const ahora = 1_800_000_000_000;
const codigoEn = s => speakeasy.totp({ secret, encoding: 'base32', time: Math.floor(ahora / 1000) + s });
const pasoActual = Math.floor(ahora / 1000 / PERIODO_S);

test('C: pasoDelCodigo identifica el intervalo del código dentro de la ventana de ±1', () => {
  assert.equal(pasoDelCodigo(secret, codigoEn(-30), ahora), pasoActual - 1);
  assert.equal(pasoDelCodigo(secret, codigoEn(0), ahora), pasoActual);
  assert.equal(pasoDelCodigo(secret, codigoEn(30), ahora), pasoActual + 1);
  assert.equal(pasoDelCodigo(secret, codigoEn(90), ahora), null);
  assert.equal(pasoDelCodigo(secret, '000000x', ahora), null);
  assert.equal(pasoDelCodigo(secret, 123456, ahora), null);
});

test('C: consumirPaso solo acepta un paso posterior al último y lo registra en la misma operación', async () => {
  const doc = { _id: 'u1', twoFactorEnabled: true, twoFactorLastStep: null };
  const cumple = (f) => Object.entries(f).every(([k, v]) =>
    k === '$or' ? v.some(a => cumple(a)) : v && typeof v === 'object' && '$lt' in v ? doc[k] != null && doc[k] < v.$lt
      : v === null ? doc[k] == null : doc[k] === v);
  const Modelo = { updateOne: async (filtro, update) => {
    if (!cumple(filtro)) return { matchedCount: 0 };
    Object.assign(doc, update.$set); return { matchedCount: 1 };
  } };
  const filtro = { _id: 'u1', twoFactorEnabled: true };

  assert.equal(await consumirPaso(Modelo, filtro, pasoActual), true);
  assert.equal(doc.twoFactorLastStep, pasoActual);
  assert.equal(await consumirPaso(Modelo, filtro, pasoActual), false, 'mismo código, otro reto');
  assert.equal(await consumirPaso(Modelo, filtro, pasoActual - 1), false, 'código anterior');
  assert.equal(await consumirPaso(Modelo, filtro, pasoActual + 1), true, 'código siguiente');
});
