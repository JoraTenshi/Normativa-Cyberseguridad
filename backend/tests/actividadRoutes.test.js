'use strict';
const crypto = require('node:crypto');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const RevokedToken = require('../models/RevokedToken');
const Membresia = require('../models/Membresia');
const Organizacion = require('../models/Organizacion');
const Evento = require('../models/EventoOrganizacion');
const { createApp } = require('../app');
const U = '200000000000000000000001', O = '100000000000000000000001';
const M = '300000000000000000000001';
const app = createApp({ rateLimits:false, politicaSesiones:'legado_pruebas' });
const ruta = '/organizaciones/' + O + '/actividad';
let db;
const consulta = valor => ({ select() { return this; }, read() { return this; },
  maxTimeMS() { return this; }, limit() { return this; }, sort() { return this; },
  async lean() { return typeof valor === 'function' ? valor() : valor; } });
const cookie = (extra = {}) => 'cyberaudit_token=' + jwt.sign({
  id: U, jti: crypto.randomUUID(), sessionVersion: 0, ...extra
}, process.env.JWT_SECRET, { expiresIn: '5m' });
test.beforeEach(t => {
  db = { usuario: { emailVerifiedAt: new Date(), sessionVersion: 0 },
    membresia: { _id: M, usuario: U, organizacion: O, rol: 'administrador', estado: 'activa' },
    fallo: false, consultas: 0 };
  t.mock.method(Usuario, 'findById', () => ({ select: async () => db.usuario }));
  t.mock.method(RevokedToken, 'exists', async () => null);
  t.mock.method(Membresia, 'find', f => consulta(f.organizacion === O ? [db.membresia] : []));
  t.mock.method(Organizacion, 'findById', () => consulta({ _id: O, estado: 'activa' }));
  t.mock.method(Evento, 'find', f => {
    db.consultas++;
    assert.equal(f.organizacion, O);
    return consulta(() => { if (db.fallo) throw new Error('credencial interna sintetica'); return []; });
  });
});
test('ruta integrada en createApp: sin cookie da 401', async () => {
  assert.equal((await request(app).get(ruta)).status, 401);
  assert.equal(db.consultas, 0);
});
test('sesion pendiente de 2FA da 401', async () => {
  assert.equal((await request(app).get(ruta).set('Cookie', cookie({ pending2fa: true }))).status, 401);
});
test('devuelve contrato y evita cache de la respuesta autenticada', async () => {
  const r = await request(app).get(ruta).set('Cookie', cookie());
  assert.equal(r.status, 200);
  assert.equal(r.headers['cache-control'], 'private, no-store');
  assert.match(r.headers.vary, /Cookie/);
  assert.deepEqual(r.body.data.eventos, []);
  assert.equal(r.body.data.alcance.tipo, 'organizacion');
  assert.ok(Number.isFinite(Date.parse(r.body.data.horaServidor)));
});
test('admin global y rol del JWT no sustituyen membresia empresarial', async () => {
  db.membresia.rol = 'consulta';
  const r = await request(app).get(ruta).set('Cookie', cookie({ rol: 'admin' }));
  assert.equal(r.status, 403); assert.equal(db.consultas, 0);
});
test('organizacion ajena no devuelve lista vacia que simule acceso', async () => {
  const r = await request(app).get('/organizaciones/100000000000000000000002/actividad')
    .set('Cookie', cookie());
  assert.equal(r.status, 403); assert.equal(db.consultas, 0);
});
for (const query of ['actorId%5B%24ne%5D=x', 'limite=1&limite=2', 'rol=administrador', '$where=true']) {
  test('HTTP rechaza query no permitida ' + query, async () => {
    const r = await request(app).get(ruta + '?' + query).set('Cookie', cookie());
    assert.equal(r.status, 400); assert.equal(db.consultas, 0);
  });
}
test('filtro futuro no se presenta como busqueda vacia', async () => {
  const r = await request(app).get(ruta + '?clienteId=100000000000000000000003').set('Cookie', cookie());
  assert.equal(r.status, 400); assert.equal(r.body.codigo, 'FILTRO_NO_IMPLEMENTADO');
});
test('caida de Mongo devuelve 503 sin detalles', async () => {
  db.fallo = true;
  const r = await request(app).get(ruta).set('Cookie', cookie());
  assert.equal(r.status, 503);
  assert.equal(r.text.includes('credencial'), false);
});
test('no publica ninguna operacion de escritura de unidades', async () => {
  const r = await request(app).post('/organizaciones/' + O + '/unidades')
    .set('Cookie', cookie()).set('X-Requested-With', 'XMLHttpRequest').send({ nombre: 'No' });
  assert.equal(r.status, 404);
});
