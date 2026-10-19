'use strict';
// HTTP routes + real crypto, in-memory model/SMTP doubles. No external services.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const bcrypt = require('bcryptjs');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://10.77.77.1:8443';
process.env.CORS_ORIGIN = process.env.APP_URL;
process.env.NC_MAIL_MODE = 'disabled';
const Usuario = require('../models/Usuario');
const mailer = require('../utils/mailer');
let state, mails, mode, errors, writes, duplicate, beforeRollback;
async function deliver(mail) {
  mails.push(mail);
  if (mode === 'throw') throw Object.assign(new Error('PASSWORD_SECRET token=PRIVATE_TOKEN'), { code: 'EAUTH' });
  return { enviado: mode === 'ok' };
}
mailer.enviarEmail = deliver;
mailer.enviarEmailRecuperacion = (to, url) => deliver({ to, url });
const router = require('../routes/auth');
const { createApp } = require('../app');
const app = express();
app.locals.politicaSesiones = 'legado_pruebas';
app.use(express.json(), cookieParser());
app.use('/auth', router);
const hash = raw => crypto.createHash('sha256').update(raw).digest('hex');
const id = '507f1f77bcf86cd799439011';
const plain = 'SyntheticOnly123';
const passwordHash = bcrypt.hashSync(plain, 12);
const signup = { nombre: 'Ana', email: '  ANA@example.test  ', password: plain };
const req = (route, body, target = app) => request(target).post(`/auth/${route}`)
  .set('Origin', process.env.APP_URL).send(body);
const query = value => ({ select: async () => value, then: (ok, fail) => Promise.resolve(value).then(ok, fail) });
function matches(filter) {
  if (!state) return false;
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some(matches);
    const value = state[key];
    if (expected === null) return value == null;
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('$gt' in expected) return value > expected.$gt;
      if ('$lt' in expected) return value < expected.$lt;
      if ('$lte' in expected) return value <= expected.$lte;
    }
    return String(value) === String(expected);
  });
}
function apply(update) {
  Object.assign(state, update.$set || {});
  for (const key of Object.keys(update.$unset || {})) delete state[key];
  for (const [key, n] of Object.entries(update.$inc || {})) state[key] = (state[key] || 0) + n;
}
function doc(value) {
  if (!value) return null;
  return { ...value,
    isLocked: () => value.lockUntil > Date.now(),
    verificarPassword: password => bcrypt.compare(password, value.password),
    recordFailedLogin: async () => { state.loginAttempts += 1; },
    resetLoginAttempts: async () => { state.loginAttempts = 0; state.lockUntil = null; }
  };
}
function account(extra = {}) {
  state = { _id: id, nombre: 'Ana', email: 'ana@example.test', password: passwordHash,
    emailVerifiedAt: null, twoFactorEnabled: false, sessionVersion: 0, loginAttempts: 0, ...extra };
}
function mailToken(index = mails.length - 1) {
  const mail = mails[index];
  const url = mail.url || mail.text.match(/https:\/\/[^\s]+\/verify-email#token=[a-f0-9]{64}/)[0];
  return new URLSearchParams(new URL(url).hash.slice(1)).get('token');
}
test.beforeEach(t => {
  state = null; mails = []; mode = 'ok'; errors = []; writes = []; duplicate = false; beforeRollback = null;
  t.mock.method(console, 'error', (...args) => errors.push(args.join(' ')));
  t.mock.method(Usuario, 'findOne', async filter => doc(matches(filter) ? state : null));
  t.mock.method(Usuario, 'create', async data => {
    if (duplicate) throw Object.assign(new Error('duplicate'), { code: 11000 });
    account({ ...data, password: await bcrypt.hash(data.password, 12) });
    return doc(state);
  });
  t.mock.method(Usuario, 'findOneAndUpdate', (filter, update) => {
    const old = matches(filter) ? doc(state) : null;
    if (old) { writes.push({ filter, update }); apply(update); }
    return query(old);
  });
  t.mock.method(Usuario, 'updateOne', async (filter, update) => {
    if (beforeRollback) { beforeRollback(); beforeRollback = null; }
    writes.push({ filter, update });
    const match = matches(filter);
    if (match) apply(update);
    return { matchedCount: match ? 1 : 0 };
  });
});

test('registro nuevo/existente/duplicado y fallos SMTP comparten status/cuerpo sin cookies ni privilegios', async () => {
  const fresh = await req('register', signup);
  assert.equal(fresh.status, 202);
  assert.deepEqual(fresh.body.data, { registrationRequested: true });
  assert.equal(fresh.headers['set-cookie'], undefined);
  assert.equal(state.email, 'ana@example.test');
  assert.equal(state.emailVerifiedAt, null);
  assert.equal(state.rol, undefined);
  assert.equal(state.organizacion, undefined);
  assert.ok(state.emailVerificationLastSentAt instanceof Date);
  assert.equal(state.emailVerificationTokenHash, hash(mailToken()));
  const before = structuredClone(state);
  const existing = await req('register', signup);
  assert.equal(existing.status, fresh.status);
  assert.deepEqual(existing.body, fresh.body);
  assert.deepEqual(state, before);
  assert.equal(mails.length, 1);
  state = null; duplicate = true;
  const raced = await req('register', signup);
  assert.equal(raced.status, fresh.status);
  assert.deepEqual(raced.body, fresh.body);
  duplicate = false;
  for (const failure of ['disabled', 'throw']) {
    state = null; mode = failure;
    const result = await req('register', signup);
    assert.equal(result.status, fresh.status);
    assert.deepEqual(result.body, fresh.body);
    assert.equal(state.emailVerifiedAt, null);
    assert.equal(state.emailVerificationLastSentAt, undefined);
    assert.equal(await bcrypt.compare(plain, state.password), true);
  }
  assert.doesNotMatch(errors.join(' '), /PASSWORD_SECRET|PRIVATE_TOKEN/);
});

test('registro no acepta email inválido, contraseña débil ni nombre vacío', async () => {
  for (const change of [{ email: 'x' }, { email: {} }, { password: 'short' }, { nombre: ' ' }]) {
    assert.equal((await req('register', { ...signup, ...change })).status, 400);
  }
  assert.equal(state, null); assert.equal(mails.length, 0);
});

test('primer envío inicia cooldown; fallo SMTP permite reenvío inmediato; nuevo enlace invalida anterior', async () => {
  await req('register', signup);
  const initial = mailToken();
  await req('resend-verification', { email: signup.email });
  assert.equal(mails.length, 1, 'no segundo correo inmediato');
  state.emailVerificationLastSentAt = new Date(Date.now() - 60_001);
  await req('resend-verification', { email: signup.email });
  const current = mailToken();
  assert.notEqual(current, initial);
  assert.equal((await req('verify-email', { token: initial })).status, 400);
  assert.equal((await req('verify-email', { token: current })).status, 200);
  assert.ok(state.emailVerifiedAt instanceof Date);
  assert.equal(state.emailVerificationTokenHash, undefined);
  assert.equal((await req('verify-email', { token: current })).status, 400);
  const count = mails.length;
  await req('resend-verification', { email: signup.email });
  assert.equal(mails.length, count, 'no enviar a cuenta ya verificada');
  state = null; mode = 'disabled'; await req('register', signup);
  mode = 'ok'; await req('resend-verification', { email: signup.email });
  assert.equal(state.emailVerificationTokenHash, hash(mailToken()));
});

test('verificación rechaza token ausente, desconocido y justo en caducidad, sin verificar cuenta', async t => {
  const now = Date.UTC(2026, 9, 19, 12);
  t.mock.timers.enable({ apis: ['Date'], now });
  account({ emailVerificationTokenHash: hash('a'.repeat(64)), emailVerificationExpiresAt: new Date(now) });
  for (const token of [undefined, '', {}, 'b'.repeat(64), 'a'.repeat(64)]) {
    assert.equal((await req('verify-email', { token })).status, 400);
    assert.equal(state.emailVerifiedAt, null);
  }
});

test('reenvío desconocido, confirmado, cooldown y fallo SMTP tienen respuesta pública idéntica', async () => {
  const missing = await req('resend-verification', { email: signup.email });
  account({ emailVerifiedAt: new Date() });
  const verified = await req('resend-verification', { email: signup.email });
  account({ emailVerificationLastSentAt: new Date() });
  const cooldown = await req('resend-verification', { email: signup.email });
  account({ emailVerificationTokenHash: 'old', emailVerificationExpiresAt: new Date(Date.now() + 10000) });
  mode = 'throw';
  const failed = await req('resend-verification', { email: signup.email });
  for (const result of [missing, verified, cooldown, failed]) {
    assert.equal(result.status, 200); assert.deepEqual(result.body, missing.body);
    assert.equal(result.headers['set-cookie'], undefined);
  }
  assert.equal(state.emailVerificationTokenHash, 'old');
  assert.doesNotMatch(errors.join(' '), /PASSWORD_SECRET|PRIVATE_TOKEN/);
});

test('fallo de reenvío no pisa una verificación concurrente', async () => {
  account(); mode = 'throw';
  beforeRollback = () => { state.emailVerifiedAt = new Date(); delete state.emailVerificationTokenHash; };
  await req('resend-verification', { email: signup.email });
  assert.ok(state.emailVerifiedAt);
  assert.equal(state.emailVerificationTokenHash, undefined);
});

test('recuperación mantiene respuesta neutra, normaliza correo y no pisa un token concurrente', async () => {
  const absent = await req('forgot-password', { email: signup.email });
  account({ resetPasswordToken: 'old', resetPasswordExpires: new Date(Date.now() + 10000) });
  mode = 'throw';
  const failed = await req('forgot-password', { email: signup.email });
  assert.deepEqual(failed.body, absent.body);
  assert.equal(state.resetPasswordToken, 'old');
  assert.equal(state.emailVerifiedAt, null);
  beforeRollback = () => { state.resetPasswordToken = 'newer'; };
  await req('forgot-password', { email: signup.email });
  assert.equal(state.resetPasswordToken, 'newer');
  assert.doesNotMatch(errors.join(' '), /PASSWORD_SECRET|PRIVATE_TOKEN/);
});

test('reset cambia contraseña y versión, conserva verificación/2FA/permisos, libera bloqueo y consume token', async () => {
  account({ twoFactorEnabled: true, lockUntil: new Date(Date.now() + 10000), loginAttempts: 5 });
  await req('forgot-password', { email: signup.email });
  const token = mailToken();
  const reset = await req('reset-password', { token, password: 'AnotherSynthetic123' });
  assert.equal(reset.status, 200);
  assert.match(reset.body.message, /correo sigue pendiente/);
  assert.equal(reset.headers['set-cookie'], undefined);
  assert.equal(state.emailVerifiedAt, null); assert.equal(state.twoFactorEnabled, true);
  assert.equal(state.rol, undefined); assert.equal(state.sessionVersion, 1);
  assert.equal(state.loginAttempts, 0); assert.equal(state.lockUntil, null);
  assert.equal(await bcrypt.compare('AnotherSynthetic123', state.password), true);
  assert.equal((await req('reset-password', { token, password: 'AnotherSynthetic123' })).status, 400);
  assert.equal((await req('login', { email: signup.email, password: plain })).status, 401);
  const unverified = await req('login', { email: signup.email, password: 'AnotherSynthetic123' });
  assert.equal(unverified.status, 403); assert.equal(unverified.body.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(unverified.headers['set-cookie'], undefined);
  state.emailVerifiedAt = new Date();
  const pending = await req('login', { email: signup.email, password: 'AnotherSynthetic123' });
  assert.equal(pending.status, 200); assert.equal(pending.body.data.requires2fa, true);
  assert.ok(pending.headers['set-cookie'].some(s => s.startsWith('cyberaudit_2fa_pending=')));
  assert.ok(!pending.headers['set-cookie'].some(s => s.startsWith('cyberaudit_token=')));
});

test('cuenta bloqueada no emite cookie; contraseña equivocada no revela verificación', async () => {
  account({ lockUntil: new Date(Date.now() + 60000) });
  const blocked = await req('login', { email: signup.email, password: plain });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers['set-cookie'], undefined);
  state.lockUntil = null;
  const wrong = await req('login', { email: signup.email, password: 'Wrong123' });
  assert.equal(wrong.status, 401); assert.equal(wrong.body.code, undefined);
});

test('fallo BD es 503 genérico, nunca éxito o detalle interno', async t => {
  t.mock.method(Usuario, 'findOne', async () => { throw Object.assign(new Error('token=PRIVATE_TOKEN'), { name: 'MongoServerSelectionError' }); });
  for (const route of ['register', 'login']) {
    const result = await req(route, signup);
    assert.equal(result.status, 503); assert.doesNotMatch(JSON.stringify(result.body), /PRIVATE_TOKEN/);
  }
});

test('limitadores reales: login y recuperación independientes, recuperación/reenvío compartidos, 2FA separado', async () => {
  const limited = createApp({ politicaSesiones: 'legado_pruebas' });
  for (let i = 0; i < 10; i++) assert.equal((await req('login', {}, limited)).status, 400);
  assert.equal((await req('login', {}, limited)).status, 429);
  assert.equal((await req('forgot-password', {}, limited)).status, 400);
  for (let i = 0; i < 9; i++) assert.equal((await req('resend-verification', {}, limited)).status, 400);
  const exhausted = await req('forgot-password', {}, limited);
  assert.equal(exhausted.status, 429); assert.ok(Number(exhausted.headers['retry-after']) > 0);
  assert.equal((await req('2fa/verify', {}, limited)).status, 401);
});
