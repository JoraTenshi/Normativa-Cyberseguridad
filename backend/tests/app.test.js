const crypto = require('node:crypto');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const Usuario = require('../models/Usuario');
const RevokedToken = require('../models/RevokedToken');
const { createApp } = require('../app');
const { generateJti } = require('../middleware/auth');

const USER_ID = '64b000000000000000000001';
const usuario = { _id: USER_ID, nombre: 'Ana', email: 'ana@example.com', emailVerifiedAt: new Date(), sessionVersion: 0 };
const app = createApp({ rateLimits: false });

RevokedToken.exists = async () => null;
// middleware/auth.js usa findById(...).select(...); routes/me.js hace await findById(...) directamente
Usuario.findById = id => (String(id) === USER_ID ? { ...usuario, select: async () => usuario } : { select: async () => null });

const cookie = payload =>
  `cyberaudit_token=${jwt.sign({ id: USER_ID, sessionVersion: 0, jti: generateJti(), ...payload }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;

test('GET / responde sin necesidad de base de datos', async () => {
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('GET /health devuelve 503 si Mongo no está conectado', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 503);
  assert.equal(res.body.db, 'disconnected');
});

test('JSON malformado llega al errorHandler y da 400', async () => {
  const res = await request(app).post('/resultado').set('X-Requested-With', 'XMLHttpRequest').set('content-type', 'application/json').send('{"normativa":');
  assert.equal(res.status, 400);
});

test('GET /me sin cookie da 401', async () => {
  assert.equal((await request(app).get('/me')).status, 401);
});

test('GET /me con token pendiente de 2FA da 401', async () => {
  const res = await request(app).get('/me').set('Cookie', cookie({ pending2fa: true }));
  assert.equal(res.status, 401);
});

test('GET /me con token de acceso válido da 200', async () => {
  const res = await request(app).get('/me').set('Cookie', cookie());
  assert.equal(res.status, 200);
  assert.equal(res.body.data.email, 'ana@example.com');
});

test('los límites de peticiones siguen activos por defecto (2FA: 10 fallos y luego 429)', async () => {
  const conLimites = createApp();
  const estados = [];
  for (let i = 0; i < 11; i++) estados.push((await request(conLimites).post('/auth/2fa/verify').set('X-Requested-With', 'XMLHttpRequest')).status);

  assert.deepEqual(estados.slice(0, 10), Array(10).fill(401));
  assert.equal(estados[10], 429);
});

test('server.js no arranca sin claves y lo dice (sin generarlas ni tocar Mongo)', () => {
  const env = { ...process.env, MONGODB_URI: 'mongodb://127.0.0.1:1/nunca' };
  delete env.JWT_SECRET;
  delete env.TOTP_ENCRYPTION_KEY;

  // cwd fuera del repo para que dotenv no cargue ningún backend/.env local
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env, cwd: os.tmpdir(), encoding: 'utf8', timeout: 10000
  });

  assert.equal(r.status, 1);
  assert.match(r.stderr, /Configuración de claves: JWT_SECRET/);
});
