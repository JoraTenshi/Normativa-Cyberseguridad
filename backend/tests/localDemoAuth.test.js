'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const cookieParser = require('cookie-parser');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://127.0.0.2:9445';
process.env.NC_LOCAL_DEMO = '1';

const Usuario = require('../models/Usuario');
const mailer = require('../utils/mailer');
const authRouter = require('../routes/auth');

test('la demo rechaza todo el circuito de correo antes de crear cuentas, tokens o mensajes; el login sigue disponible', async () => {
  const original = {
    findOne: Usuario.findOne,
    create: Usuario.create,
    findOneAndUpdate: Usuario.findOneAndUpdate,
    updateOne: Usuario.updateOne,
    send: mailer.enviarEmail,
    reset: mailer.enviarEmailRecuperacion
  };
  let dataAccess = 0;
  for (const key of ['findOne', 'create', 'findOneAndUpdate', 'updateOne']) {
    Usuario[key] = () => { dataAccess++; throw Error('DB_NOT_EXPECTED'); };
  }
  mailer.enviarEmail = mailer.enviarEmailRecuperacion = () => { throw Error('MAIL_NOT_EXPECTED'); };

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/auth', authRouter);
  const server = await new Promise(resolve => {
    const running = app.listen(0, '127.0.0.1', () => resolve(running));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const route of ['register', 'verify-email', 'resend-verification', 'forgot-password', 'reset-password', 'Register', 'register/']) {
      const response = await fetch(`${base}/auth/${route}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
      });
      assert.equal(response.status, 403, route);
      assert.equal((await response.json()).code, 'LOCAL_DEMO_EMAIL_DISABLED', route);
    }
    assert.equal(dataAccess, 0);
    // Un login inexistente sigue alcanzando la ruta normal; no se elimina el acceso docente.
    Usuario.findOne = async () => null;
    const login = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sin-cuenta@example.invalid', password: 'ClaveFicticia123' })
    });
    assert.equal(login.status, 401);
    assert.equal((await login.json()).error, 'Credenciales incorrectas');
  } finally {
    Usuario.findOne = original.findOne;
    Usuario.create = original.create;
    Usuario.findOneAndUpdate = original.findOneAndUpdate;
    Usuario.updateOne = original.updateOne;
    mailer.enviarEmail = original.send;
    mailer.enviarEmailRecuperacion = original.reset;
    await new Promise(resolve => server.close(resolve));
  }
});
