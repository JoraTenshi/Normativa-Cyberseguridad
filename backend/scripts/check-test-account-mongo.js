'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = process.env.CORS_ORIGIN = 'https://127.0.0.2:9443';
const mongoose = require('mongoose');
const request = require('supertest');
const { instancia } = require('./run-gestion-unidades-mongo');
const { provision, EMAIL } = require('./integration/create-test-workspace');
const Usuario = require('../models/Usuario');
const Organizacion = require('../models/Organizacion');
const Membresia = require('../models/Membresia');
const { createApp } = require('../app');
const models = { mongoose, Usuario, Organizacion, Membresia };

async function check({ uri, nombreBD }) {
  const parsed = new URL(uri);
  if (parsed.hostname !== '127.0.0.1' || parsed.port === '27017' ||
      !/^nc_org03_[a-f0-9]{24}$/.test(nombreBD)) throw Error('Solo Mongo temporal del runner');
  const results = [];
  const pass = name => { results.push(name); console.log('OK ' + name); };
  try {
    await mongoose.connect(uri, { dbName: nombreBD });
    for (const model of Object.values(mongoose.models)) await model.init();
    const first = await provision(models);
    assert.equal(first.status, 'created');
    assert.equal(first.password.length, 36);
    const user = await Usuario.findOne({ email: EMAIL });
    assert.equal(user.rol, 'usuario');
    assert.ok(user.emailVerifiedAt);
    assert.notEqual(user.password, first.password);
    assert.ok(await user.verificarPassword(first.password));
    assert.equal(await Organizacion.countDocuments(), 1);
    assert.equal(await Membresia.countDocuments({ usuario: user._id, rol: 'administrador', estado: 'activa' }), 1);
    const receipt = mongoose.connection.db.collection('_integration_setup');
    assert.equal(await receipt.countDocuments(), 1);
    pass('alta atómica, bcrypt y administrador organizativo sin rol global');
    const again = await provision(models);
    assert.equal(again.status, 'exists');
    assert.equal(again.password, undefined);
    assert.equal((await Usuario.findById(user._id)).password, user.password);
    assert.equal(await Usuario.countDocuments(), 1);
    pass('segunda ejecución no duplica, no revela ni resetea contraseña');
    const app = createApp(); // Límites y autenticación persistente normales.
    const call = (method, url) => request(app)[method](url)
      .set('Origin', process.env.APP_URL).set('X-Requested-With', 'XMLHttpRequest');
    const login = await call('post', '/auth/login').send({ email: EMAIL, password: first.password });
    assert.equal(login.status, 200);
    const cookie = login.headers['set-cookie'].find(c => c.startsWith('cyberaudit_token='));
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Strict/);
    const me = await call('get', '/me/organizaciones').set('Cookie', cookie.split(';')[0]);
    assert.equal(me.status, 200);
    assert.match(JSON.stringify(me.body), /Empresa de prueba - NormativaCheck/);
    assert.equal((await call('post', '/auth/login').send({ email: EMAIL, password: 'Incorrecta9!' })).status, 401);
    pass('login y selector HTTP reales; cookies protegidas; clave incorrecta rechazada');
    await Membresia.updateOne({ usuario: user._id }, { $set: { estado: 'revocada' } });
    await assert.rejects(provision(models), { code: 'TEST_STATE_CHANGED' });
    assert.equal((await Membresia.findOne({ usuario: user._id })).estado, 'revocada');
    pass('repetir no reactiva membresía revocada');
    // Siguientes casos cambian únicamente de BD aleatoria de ESTE mongod temporal.
    await mongoose.disconnect();
    await mongoose.connect(uri, { dbName: nombreBD + '_rollback' });
    for (const model of [Usuario, Organizacion, Membresia]) await model.createCollection();
    const save = Membresia.prototype.save;
    Membresia.prototype.save = async function () { throw Error('synthetic membership failure'); };
    try { await assert.rejects(provision(models), /synthetic membership failure/); }
    finally { Membresia.prototype.save = save; }
    assert.equal(await Usuario.countDocuments(), 0);
    assert.equal(await Organizacion.countDocuments(), 0);
    assert.equal(await mongoose.connection.db.collection('_integration_setup').countDocuments(), 0);
    pass('fallo de membresía revierte usuario, empresa y recibo');
    await Usuario.create({ nombre: 'Existente sintético', email: 'existing@example.invalid', password: 'Existing9!' });
    await assert.rejects(provision(models), { code: 'DATABASE_NOT_EMPTY' });
    assert.equal(await Usuario.countDocuments(), 1);
    assert.equal(await Organizacion.countDocuments(), 0);
    pass('no adopta ni altera una base que ya tiene cuentas');
    return results;
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) instancia(process.env.MONGOD_TEST_BINARY, false, check)
  .then(n => console.log('COMPLETADO: ' + n + ' grupos. Mongo/HTTP sintéticos; no E2E HTTPS de Windows.'))
  .catch(error => { console.error(error.stack); process.exitCode = 1; });
