const crypto = require('node:crypto');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const Usuario = require('../models/Usuario');
const Normativa = require('../models/Normativa');
const { createApp } = require('../app');
const caida = async () => { throw Object.assign(new Error('fallo simulado'), { name: 'MongoNetworkError' }); };
Usuario.findOne = caida;
Normativa.find = caida;
Normativa.findOne = caida;
const app = createApp({ rateLimits:false, politicaSesiones:'legado_pruebas' });
test('login devuelve 503 cuando Mongo no está disponible', async () => {
  const res = await request(app).post('/auth/login').set('X-Requested-With', 'XMLHttpRequest')
    .send({ email: 'persona@example.test', password: 'Prueba123!' });
  assert.equal(res.status, 503);
  assert.equal(res.headers['set-cookie'], undefined);
});
for (const ruta of ['/normativas', '/normativas/lssi_ce']) {
  test(ruta + ' devuelve 503 cuando Mongo no está disponible', async () => {
    assert.equal((await request(app).get(ruta)).status, 503);
  });
}
