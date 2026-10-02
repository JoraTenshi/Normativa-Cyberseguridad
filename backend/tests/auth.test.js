const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('node:crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';

const Usuario = require('../models/Usuario');
const RevokedToken = require('../models/RevokedToken');
const mailer = require('../utils/mailer');

let sendEmail;
mailer.enviarEmail = (...args) => sendEmail(...args);
mailer.enviarEmailRecuperacion = (...args) => sendEmail(...args);

const authRouter = require('../routes/auth');
const { requireAuth } = require('../middleware/auth');

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/auth', authRouter);
  app.get('/protected', requireAuth, (req, res) => res.json({ ok: true }));
  const server = await new Promise(resolve => {
    const running = app.listen(0, '127.0.0.1', () => resolve(running));
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(resolve => server.close(resolve))
  };
}

async function post(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

test('registro pendiente, enlace de correo y verificación de un solo uso', async () => {
  const originalFindOne = Usuario.findOne;
  const originalCreate = Usuario.create;
  const originalFindOneAndUpdate = Usuario.findOneAndUpdate;
  let saved;
  let sent;
  let verified = false;
  const server = await startServer();
  try {
    Usuario.findOne = async () => null;
    Usuario.create = async data => {
      saved = { _id: '507f1f77bcf86cd799439011', ...data };
      return saved;
    };
    Usuario.findOneAndUpdate = async filter => {
      if (verified || filter.emailVerificationTokenHash !== saved.emailVerificationTokenHash) return null;
      verified = true;
      return saved;
    };
    sendEmail = async mail => { sent = mail; return { enviado: true }; };

    const created = await post(`${server.url}/auth/register`, {
      nombre: 'Ana', email: 'ANA@example.test', password: 'Prueba123'
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.data.pendingVerification, true);
    assert.equal(created.body.data.emailSent, true);
    assert.equal(created.response.headers.get('set-cookie'), null);
    assert.equal(saved.email, 'ana@example.test');

    const link = sent.text.match(/https:\/\/localhost\/verify-email#token=[a-f0-9]{64}/)?.[0];
    assert.ok(link, 'el correo debe incluir el enlace de la página web');
    const token = new URLSearchParams(new URL(link).hash.slice(1)).get('token');
    assert.equal(saved.emailVerificationTokenHash, crypto.createHash('sha256').update(token).digest('hex'));

    const first = await post(`${server.url}/auth/verify-email`, { token });
    assert.equal(first.response.status, 200);
    const repeated = await post(`${server.url}/auth/verify-email`, { token });
    assert.equal(repeated.response.status, 400);
  } finally {
    Usuario.findOne = originalFindOne;
    Usuario.create = originalCreate;
    Usuario.findOneAndUpdate = originalFindOneAndUpdate;
    await server.close();
  }
});

test('restablecer contraseña invalida una sesión anterior', async () => {
  const originalUpdateOne = Usuario.updateOne;
  const originalFindById = Usuario.findById;
  const originalExists = RevokedToken.exists;
  let used = false;
  const server = await startServer();
  try {
    Usuario.updateOne = async (filter, update) => {
      assert.equal(filter.resetPasswordToken, crypto.createHash('sha256').update('token-de-prueba').digest('hex'));
      assert.equal(await bcrypt.compare('NuevaClave123', update.$set.password), true);
      assert.equal(update.$inc.sessionVersion, 1);
      if (used) return { matchedCount: 0 };
      used = true;
      return { matchedCount: 1 };
    };

    const reset = await post(`${server.url}/auth/reset-password`, {
      token: 'token-de-prueba', password: 'NuevaClave123'
    });
    assert.equal(reset.response.status, 200);
    const repeated = await post(`${server.url}/auth/reset-password`, {
      token: 'token-de-prueba', password: 'NuevaClave123'
    });
    assert.equal(repeated.response.status, 400);

    let emailVerified = true;
    Usuario.findById = () => ({
      select: async () => ({ sessionVersion: 1, emailVerifiedAt: emailVerified ? new Date() : null })
    });
    RevokedToken.exists = async () => false;
    const oldToken = jwt.sign({ id: '507f1f77bcf86cd799439011', sessionVersion: 0, jti: 'jti-sesion-anterior' }, process.env.JWT_SECRET);
    const oldSession = await fetch(`${server.url}/protected`, {
      headers: { Cookie: `cyberaudit_token=${oldToken}` }
    });
    assert.equal(oldSession.status, 401);

    const newToken = jwt.sign({ id: '507f1f77bcf86cd799439011', sessionVersion: 1, jti: 'jti-sesion-nueva' }, process.env.JWT_SECRET);
    const newSession = await fetch(`${server.url}/protected`, {
      headers: { Cookie: `cyberaudit_token=${newToken}` }
    });
    assert.equal(newSession.status, 200);

    emailVerified = false;
    const unverifiedSession = await fetch(`${server.url}/protected`, {
      headers: { Cookie: `cyberaudit_token=${newToken}` }
    });
    assert.equal(unverifiedSession.status, 401);
  } finally {
    Usuario.updateOne = originalUpdateOne;
    Usuario.findById = originalFindById;
    RevokedToken.exists = originalExists;
    await server.close();
  }
});

test('un fallo de correo conserva los enlaces anteriores', async () => {
  const originalFindOneAndUpdate = Usuario.findOneAndUpdate;
  const originalUpdateOne = Usuario.updateOne;
  const oldVerificationHash = 'hash-verificacion-anterior';
  const oldResetHash = 'hash-recuperacion-anterior';
  const oldExpiry = new Date(Date.now() + 60_000);
  const oldUser = {
    _id: '507f1f77bcf86cd799439011',
    nombre: 'Ana',
    email: 'ana@example.test',
    emailVerificationTokenHash: oldVerificationHash,
    emailVerificationExpiresAt: oldExpiry,
    emailVerificationLastSentAt: null,
    resetPasswordToken: oldResetHash,
    resetPasswordExpires: oldExpiry
  };
  const restorations = [];
  const server = await startServer();
  try {
    Usuario.findOneAndUpdate = () => ({ select: async () => oldUser });
    Usuario.updateOne = async (filter, update) => {
      restorations.push({ filter, update });
      return { matchedCount: 1 };
    };
    sendEmail = async (...args) => {
      if (typeof args[1] === 'string') {
        assert.match(args[1], /^https:\/\/localhost\/reset-password#token=[a-f0-9]{64}$/);
      }
      return { enviado: false };
    };

    const resend = await post(`${server.url}/auth/resend-verification`, { email: oldUser.email });
    assert.equal(resend.response.status, 200);
    assert.equal(restorations[0].update.$set.emailVerificationTokenHash, oldVerificationHash);
    assert.equal(restorations[0].update.$set.emailVerificationExpiresAt, oldExpiry);

    const forgot = await post(`${server.url}/auth/forgot-password`, { email: oldUser.email });
    assert.equal(forgot.response.status, 200);
    assert.equal(restorations[1].update.$set.resetPasswordToken, oldResetHash);
    assert.equal(restorations[1].update.$set.resetPasswordExpires, oldExpiry);
  } finally {
    Usuario.findOneAndUpdate = originalFindOneAndUpdate;
    Usuario.updateOne = originalUpdateOne;
    await server.close();
  }
});
