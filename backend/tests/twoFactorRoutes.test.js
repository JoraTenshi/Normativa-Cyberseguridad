const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('node:crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';

const Usuario = require('../models/Usuario');
const RevokedToken = require('../models/RevokedToken');
const authRouter = require('../routes/auth');
const twoFactorRouter = require('../routes/twoFactor');

const userId = '507f1f77bcf86cd799439011';

async function request(url, method, cookie, body) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { response, body: await response.json() };
}

test('2FA usa el secreto cifrado en configuración, activación, acceso y desactivación', async () => {
  const originalFindById = Usuario.findById;
  const originalFindOne = Usuario.findOne;
  const originalFindOneAndUpdate = Usuario.findOneAndUpdate;
  const originalRevokedExists = RevokedToken.exists;
  const originalRevokedCreate = RevokedToken.create;

  const user = {
    _id: userId,
    email: 'ana@example.test',
    nombre: 'Ana',
    emailVerifiedAt: new Date(),
    sessionVersion: 0,
    twoFactorSecret: null,
    twoFactorEnabled: false,
    twoFactorPendingSecret: null,
    twoFactorPendingExpiresAt: null,
    isLocked: () => false,
    verificarPassword: async password => password === 'Prueba123',
    resetLoginAttempts: async () => {},
    updateOne: async update => { Object.assign(user, update); }
  };

  Usuario.findById = () => ({ select: async () => user });
  Usuario.findOne = async ({ email }) => email === user.email ? user : null;
  // Igual que MongoDB: aplica $set solo si el documento cumple el filtro; se puede encadenar .select().
  Usuario.findOneAndUpdate = (filter, update) => {
    assert.equal(filter._id.toString(), userId);
    const cumple = Object.entries(filter).every(([k, v]) => k === '_id' || user[k] === v);
    if (cumple) Object.assign(user, update.$set);
    const resultado = Promise.resolve(cumple ? user : null);
    return { select: () => resultado, then: (ok, ko) => resultado.then(ok, ko) };
  };
  RevokedToken.exists = async () => false;
  RevokedToken.create = async () => ({});

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/auth', authRouter);
  app.use('/me/2fa', twoFactorRouter);
  const server = await new Promise(resolve => {
    const running = app.listen(0, '127.0.0.1', () => resolve(running));
  });

  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const fullToken = jwt.sign({
      id: userId,
      email: user.email,
      sessionVersion: 0,
      jti: crypto.randomBytes(16).toString('hex')
    }, process.env.JWT_SECRET);
    const fullCookie = `cyberaudit_token=${fullToken}`;

    const setup = await request(`${base}/me/2fa/setup`, 'POST', fullCookie);
    assert.equal(setup.response.status, 200);
    assert.match(user.twoFactorPendingSecret, /^v1:/);
    assert.equal(user.twoFactorPendingSecret.includes(setup.body.data.secret), false);
    assert.equal(user.twoFactorSecret, null, 'la configuración no toca el secreto activo');
    assert.ok(user.twoFactorPendingExpiresAt > new Date());
    assert.match(setup.body.data.qr, /^data:image\/png;base64,/);

    const refresh = await request(`${base}/me/2fa/setup`, 'POST', fullCookie);
    assert.equal(refresh.response.status, 200);
    assert.equal(refresh.body.data.secret, setup.body.data.secret);

    const stored = user.twoFactorPendingSecret;
    const altered = stored.split(':');
    altered[2] = `${altered[2][0] === '0' ? '1' : '0'}${altered[2].slice(1)}`;
    user.twoFactorPendingSecret = altered.join(':');
    const badSetup = await request(`${base}/me/2fa/setup`, 'POST', fullCookie);
    assert.equal(badSetup.response.status, 500);
    user.twoFactorPendingSecret = stored;

    const code = speakeasy.totp({ secret: setup.body.data.secret, encoding: 'base32' });
    const enabled = await request(`${base}/me/2fa/enable`, 'POST', fullCookie, { token: code });
    assert.equal(enabled.response.status, 200);
    assert.equal(user.twoFactorEnabled, true);
    assert.equal(user.twoFactorSecret, stored, 'el secreto verificado pasa a ser el activo');
    assert.equal(user.twoFactorPendingSecret, null);

    const login = await request(`${base}/auth/login`, 'POST', null, {
      email: user.email,
      password: 'Prueba123'
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.body.data.requires2fa, true);
    const pendingCookie = login.response.headers.get('set-cookie')?.split(';')[0];
    assert.match(pendingCookie, /^cyberaudit_2fa_pending=/);

    const verified = await request(`${base}/auth/2fa/verify`, 'POST', pendingCookie, { token: code });
    assert.equal(verified.response.status, 200);
    assert.equal(verified.body.data.usuario.email, user.email);
    const clearedPending = verified.response.headers.getSetCookie()
      .find(cookie => cookie.startsWith('cyberaudit_2fa_pending='));
    assert.match(clearedPending, /Expires=/);
    assert.doesNotMatch(clearedPending, /Max-Age=/i);

    const disabled = await request(`${base}/me/2fa/disable`, 'POST', fullCookie, { token: code });
    assert.equal(disabled.response.status, 200);
    assert.equal(user.twoFactorEnabled, false);
    assert.equal(user.twoFactorSecret, null);

    const oldSecret = speakeasy.generateSecret({ length: 20 }).base32;
    user.twoFactorSecret = oldSecret;
    user.twoFactorEnabled = true;
    const oldLogin = await request(`${base}/auth/login`, 'POST', null, {
      email: user.email,
      password: 'Prueba123'
    });
    const oldPendingCookie = oldLogin.response.headers.get('set-cookie')?.split(';')[0];
    const oldCode = speakeasy.totp({ secret: oldSecret, encoding: 'base32' });
    const oldVerified = await request(`${base}/auth/2fa/verify`, 'POST', oldPendingCookie, { token: oldCode });
    assert.equal(oldVerified.response.status, 500);
    assert.equal(oldVerified.response.headers.getSetCookie()
      .some(cookie => cookie.startsWith('cyberaudit_token=')), false);

    const logout = await request(`${base}/auth/logout`, 'POST', fullCookie);
    assert.equal(logout.response.status, 200);
    const clearedSession = logout.response.headers.getSetCookie()
      .find(cookie => cookie.startsWith('cyberaudit_token='));
    assert.match(clearedSession, /Expires=/);
    assert.doesNotMatch(clearedSession, /Max-Age=/i);
  } finally {
    Usuario.findById = originalFindById;
    Usuario.findOne = originalFindOne;
    Usuario.findOneAndUpdate = originalFindOneAndUpdate;
    RevokedToken.exists = originalRevokedExists;
    RevokedToken.create = originalRevokedCreate;
    await new Promise(resolve => server.close(resolve));
  }
});
