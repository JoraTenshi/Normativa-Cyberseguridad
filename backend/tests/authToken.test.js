const crypto = require('node:crypto');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');

const Usuario = require('../models/Usuario');
const RevokedToken = require('../models/RevokedToken');
const { requireAuth, optionalAuth, generateJti } = require('../middleware/auth');
const authRouter = require('../routes/auth');
const { encryptTotpSecret } = require('../utils/totpEncryption');

const SECRET = process.env.JWT_SECRET;
const ACCESS_COOKIE = 'cyberaudit_token';
const PENDING_COOKIE = 'cyberaudit_2fa_pending';

// ── In-memory stand-ins for Mongo ─────────────────────────────────────────────
const totpSecret = speakeasy.generateSecret({ length: 20 }).base32;
const usuario = {
  _id: '64b000000000000000000001',
  nombre: 'Ana',
  email: 'ana@example.com',
  emailVerifiedAt: new Date(),
  sessionVersion: 0,
  twoFactorEnabled: true,
  isLocked: () => false,
  verificarPassword: async pw => pw === 'Password1',
  recordFailedLogin: async () => {},
  resetLoginAttempts: async () => {},
};
usuario.twoFactorSecret = encryptTotpSecret(totpSecret, usuario._id);

const revocados = new Set();
let mongoCaido = false;
let retrasoExistsMs = 0;

function caidaSiProcede() {
  if (mongoCaido) throw new Error('MongoServerSelectionError: connection refused');
}

RevokedToken.exists = async ({ jti }) => {
  caidaSiProcede();
  const encontrado = revocados.has(jti);
  if (retrasoExistsMs) await new Promise(r => setTimeout(r, retrasoExistsMs));
  return encontrado ? { _id: jti } : null;
};
RevokedToken.create = async ({ jti }) => {
  caidaSiProcede();
  if (revocados.has(jti)) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
  revocados.add(jti);
};
Usuario.findOne = async ({ email }) => (email === usuario.email ? usuario : null);
Usuario.findById = id => ({
  select: async () => { caidaSiProcede(); return String(id) === usuario._id ? usuario : null; }
});

// ── Test app ──────────────────────────────────────────────────────────────────
const app = express();
app.use(cookieParser());
app.use(express.json());
app.use('/auth', authRouter);
app.get('/privado', requireAuth, (req, res) => res.json({ ok: true, id: req.user.id }));
app.get('/opcional', optionalAuth, (req, res) => res.json({ ok: true, id: req.user?.id ?? null }));

let server;
let base;

test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());
test.beforeEach(() => { revocados.clear(); mongoCaido = false; retrasoExistsMs = 0; });

// ── Helpers ───────────────────────────────────────────────────────────────────
function cookieDe(res, nombre) {
  const linea = res.headers.getSetCookie().find(c => c.startsWith(`${nombre}=`));
  return linea ? linea.split(';')[0].slice(nombre.length + 1) : null;
}

function pedir(ruta, { cookies = {}, body } = {}) {
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  return fetch(base + ruta, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(cookie && { cookie }) },
    body: body && JSON.stringify(body),
  });
}

async function loginHasta2fa() {
  const res = await pedir('/auth/login', { body: { email: usuario.email, password: 'Password1' } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.requires2fa, true);
  assert.equal(cookieDe(res, ACCESS_COOKIE), null, 'no debe emitir token de acceso antes del 2FA');
  return cookieDe(res, PENDING_COOKIE);
}

function codigoTotp() {
  return speakeasy.totp({ secret: totpSecret, encoding: 'base32' });
}

function firmar(payload, opciones = {}) {
  return jwt.sign(payload, SECRET, { expiresIn: '1h', ...opciones });
}

const accesoValido = (extra = {}) =>
  firmar({ id: usuario._id, sessionVersion: 0, jti: generateJti(), ...extra });

// ── 2FA flow ──────────────────────────────────────────────────────────────────
test('flujo normal: login → 2FA → token de acceso que abre rutas protegidas', async () => {
  const pendiente = await loginHasta2fa();

  const res = await pedir('/auth/2fa/verify', { cookies: { [PENDING_COOKIE]: pendiente }, body: { token: codigoTotp() } });
  assert.equal(res.status, 200);

  const privado = await pedir('/privado', { cookies: { [ACCESS_COOKIE]: cookieDe(res, ACCESS_COOKIE) } });
  assert.equal(privado.status, 200);
  assert.equal((await privado.json()).id, usuario._id);
});

test('bypass: el token pendiente de 2FA puesto en la cookie de acceso se rechaza', async () => {
  const pendiente = await loginHasta2fa();

  const privado = await pedir('/privado', { cookies: { [ACCESS_COOKIE]: pendiente } });
  assert.equal(privado.status, 401);

  const opcional = await pedir('/opcional', { cookies: { [ACCESS_COOKIE]: pendiente } });
  assert.equal(opcional.status, 200);
  assert.equal((await opcional.json()).id, null, 'optionalAuth debe tratarlo como anónimo');
});

test('/2fa/verify rechaza un token de acceso en la cookie de verificación', async () => {
  const res = await pedir('/auth/2fa/verify', { cookies: { [PENDING_COOKIE]: accesoValido() }, body: { token: codigoTotp() } });
  assert.equal(res.status, 401);
});

test('/2fa/verify rechaza un token pendiente sin jti', async () => {
  const sinJti = firmar({ pending2fa: true, id: usuario._id, sessionVersion: 0 }, { expiresIn: '5m' });
  const res = await pedir('/auth/2fa/verify', { cookies: { [PENDING_COOKIE]: sinJti }, body: { token: codigoTotp() } });
  assert.equal(res.status, 401);
});

test('/2fa/verify rechaza un token pendiente ya utilizado', async () => {
  const pendiente = await loginHasta2fa();
  const opts = { cookies: { [PENDING_COOKIE]: pendiente }, body: { token: codigoTotp() } };

  assert.equal((await pedir('/auth/2fa/verify', opts)).status, 200);
  assert.equal((await pedir('/auth/2fa/verify', opts)).status, 401);
});

test('/2fa/verify: dos verificaciones simultáneas con el mismo token solo emiten una sesión', async () => {
  const pendiente = await loginHasta2fa();
  const opts = { cookies: { [PENDING_COOKIE]: pendiente }, body: { token: codigoTotp() } };
  retrasoExistsMs = 50; // both requests pass the "already used?" check before either consumes the token

  const estados = (await Promise.all([pedir('/auth/2fa/verify', opts), pedir('/auth/2fa/verify', opts)]))
    .map(r => r.status).sort();
  assert.deepEqual(estados, [200, 401]);
});

test('/2fa/verify rechaza un token pendiente caducado', async () => {
  const caducado = firmar({ pending2fa: true, id: usuario._id, sessionVersion: 0, jti: generateJti() }, { expiresIn: -10 });
  const res = await pedir('/auth/2fa/verify', { cookies: { [PENDING_COOKIE]: caducado }, body: { token: codigoTotp() } });
  assert.equal(res.status, 401);
});

// ── Access token checks ──────────────────────────────────────────────────────
for (const [caso, token] of [
  ['caducado',                 () => firmar({ id: usuario._id, sessionVersion: 0, jti: generateJti() }, { expiresIn: -10 })],
  ['sin jti',                  () => firmar({ id: usuario._id, sessionVersion: 0 })],
  ['sin id',                   () => firmar({ sessionVersion: 0, jti: generateJti() })],
  ['con id mal formado',       () => firmar({ id: 'no-es-un-objectid', sessionVersion: 0, jti: generateJti() })],
  ['de una sesión anterior',   () => accesoValido({ sessionVersion: 1 })],
  ['firmado con otro secreto', () => jwt.sign({ id: usuario._id, sessionVersion: 0, jti: generateJti() }, 'otro-secreto')],
  ['alg none',                 () => jwt.sign({ id: usuario._id, sessionVersion: 0, jti: generateJti() }, '', { algorithm: 'none' })],
]) {
  test(`requireAuth rechaza un token ${caso}`, async () => {
    const res = await pedir('/privado', { cookies: { [ACCESS_COOKIE]: token() } });
    assert.equal(res.status, 401);
  });
}

test('requireAuth rechaza un token revocado', async () => {
  const token = accesoValido();
  revocados.add(jwt.decode(token).jti);

  const res = await pedir('/privado', { cookies: { [ACCESS_COOKIE]: token } });
  assert.equal(res.status, 401);
});

test('logout revoca el token y deja de servir', async () => {
  const token = accesoValido();
  assert.equal((await pedir('/auth/logout', { cookies: { [ACCESS_COOKIE]: token }, body: {} })).status, 200);
  assert.equal((await pedir('/privado', { cookies: { [ACCESS_COOKIE]: token } })).status, 401);
});

test('Mongo caído: requireAuth y optionalAuth responden 503 (no 500 ni anónimo)', async () => {
  mongoCaido = true;
  const cookies = { [ACCESS_COOKIE]: accesoValido() };

  assert.equal((await pedir('/privado', { cookies })).status, 503);
  assert.equal((await pedir('/opcional', { cookies })).status, 503);
});

test('optionalAuth sin cookie o con token inválido sigue siendo anónimo aunque Mongo esté caído', async () => {
  mongoCaido = true;
  for (const cookies of [{}, { [ACCESS_COOKIE]: 'no-es-un-jwt' }]) {
    const res = await pedir('/opcional', { cookies });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).id, null);
  }
});
