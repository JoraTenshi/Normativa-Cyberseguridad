'use strict';

const crypto = require('node:crypto');
// Clave efimera solo para este proceso de prueba. No se carga .env ni se envia correo.
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const RevokedToken = require('../models/RevokedToken');
const Membresia = require('../models/Membresia');
const Organizacion = require('../models/Organizacion');
const { requireAuth } = require('../middleware/auth');
const {
  requireOrganizacionActiva, crearMiddlewareOrganizacion
} = require('../middleware/organizacion');

const U = '100000000000000000000001';
const V = '100000000000000000000002';
const A = '200000000000000000000001';
const B = '200000000000000000000002';
const C = '200000000000000000000003';
const M = '300000000000000000000001';
let datos;

function consulta(tipo, resultado) {
  datos.consultas.push(tipo);
  return {
    select() { return this; }, read() { return this; },
    limit(valor) { this.limite = valor; return this; },
    async lean() {
      if (datos.fallo === tipo) throw new Error('detalle interno sintetico de ' + tipo);
      const valor = resultado();
      return Array.isArray(valor) ? valor.slice(0, this.limite).map(v => ({ ...v })) : valor && { ...valor };
    }
  };
}

test.beforeEach(t => {
  datos = {
    usuarios: {
      [U]: { _id: U, emailVerifiedAt: new Date('2026-01-01'), sessionVersion: 0, rol: 'usuario' },
      [V]: { _id: V, emailVerifiedAt: new Date('2026-01-01'), sessionVersion: 0, rol: 'usuario' }
    },
    empresas: [{ _id: A, estado: 'activa' }, { _id: B, estado: 'activa' }],
    relaciones: [
      { _id: M, usuario: U, organizacion: A, rol: 'colaborador', estado: 'activa' },
      { _id: '300000000000000000000002', usuario: V, organizacion: B, rol: 'consulta', estado: 'activa' }
    ],
    consultas: [], revocados: new Set(), fallo: null, atendidas: 0
  };
  t.mock.method(Usuario, 'findById', id => ({
    async select() {
      if (datos.fallo === 'sesion') throw new Error('fallo sintetico de sesion');
      return datos.usuarios[String(id)] ?? null;
    }
  }));
  t.mock.method(RevokedToken, 'exists', async ({ jti }) => datos.revocados.has(jti) ? { jti } : null);
  t.mock.method(Membresia, 'find', filtro => consulta('membresia', () => datos.relaciones.filter(m =>
    String(m.usuario) === filtro.usuario && String(m.organizacion) === filtro.organizacion)));
  t.mock.method(Organizacion, 'findById', id =>
    consulta('empresa', () => datos.empresas.find(e => String(e._id) === id)));
});

function aplicacion(middleware = requireOrganizacionActiva) {
  const app = express();
  app.locals.politicaSesiones = 'legado_pruebas';
  app.use(cookieParser());
  app.use(express.json());
  // Simula un contexto previo obsoleto: nunca debe llegar al controlador final.
  app.use((req, _res, next) => {
    req.contextoOrganizacion = { usuarioId: V, organizacionId: B, rol: 'administrador' };
    next();
  });
  function atender(req, res) {
    datos.atendidas++;
    res.json({ ok: true, data: req.contextoOrganizacion });
  }
  // Rutas SOLO de la prueba: no existen en app.js ni se publica un contrato.
  app.all('/prueba/organizaciones/:organizacionId/contexto', middleware, atender);
  app.get('/prueba/sin-parametro', middleware, atender);
  app.use((error, _req, res, _next) => {
    app.locals.errorObservado = error;
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  });
  return app;
}

const app = aplicacion();
const ruta = (organizacion = A) => '/prueba/organizaciones/' + organizacion + '/contexto';
const token = (extra = {}, opciones = {}) => jwt.sign({
  id: U, jti: crypto.randomUUID(), sessionVersion: 0, ...extra
}, process.env.JWT_SECRET, { expiresIn: '5m', ...opciones });
const cookie = valor => 'cyberaudit_token=' + valor;
const get = (organizacion = A, valor = token()) => request(app).get(ruta(organizacion)).set('Cookie', cookie(valor));

test('el middleware exportado incorpora requireAuth antes de la comprobacion', () => {
  assert.ok(Array.isArray(requireOrganizacionActiva));
  assert.equal(requireOrganizacionActiva.length, 2);
  assert.equal(requireOrganizacionActiva[0], requireAuth);
});

test('sin cookie no admite identidad ni rol enviados en cuerpo o cabeceras', async () => {
  const res = await request(app).post(ruta()).set('X-User-Id', U).set('X-Role', 'administrador')
    .send({ usuarioId: U, rol: 'administrador', estado: 'activa' });
  assert.equal(res.status, 401);
  assert.equal(datos.consultas.length, 0);
  assert.equal(datos.atendidas, 0);
});

for (const [nombre, crearToken] of [
  ['malformada', () => 'no-es-un-token'],
  ['caducada', () => token({}, { expiresIn: -1 })],
  ['pendiente de 2FA', () => token({ pending2fa: true })],
  ['version anterior', () => token({ sessionVersion: 1 })],
  ['sin jti', () => token({ jti: '' })],
  ['firma ajena', () => jwt.sign({ id: U, jti: 'test' }, crypto.randomBytes(32).toString('hex'))]
]) {
  test('autenticacion real rechaza sesion ' + nombre + ' antes de consultar pertenencia', async () => {
    assert.equal((await get(A, crearToken())).status, 401);
    assert.equal(datos.consultas.length, 0);
    assert.equal(datos.atendidas, 0);
  });
}

test('rechaza una sesion revocada', async () => {
  const valor = token();
  datos.revocados.add(jwt.decode(valor).jti);
  assert.equal((await get(A, valor)).status, 401);
  assert.equal(datos.atendidas, 0);
});

test('rechaza una cuenta eliminada o sin correo verificado', async () => {
  datos.usuarios[U].emailVerifiedAt = null;
  assert.equal((await get()).status, 401);
  delete datos.usuarios[U];
  assert.equal((await get()).status, 401);
  assert.equal(datos.consultas.length, 0);
});

test('sesion y membresia vigentes llegan al controlador con contexto minimo', async () => {
  const res = await get();
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, data: {
    usuarioId: U, organizacionId: A, membresiaId: M, rol: 'colaborador'
  } });
  assert.equal(datos.atendidas, 1);
  assert.equal(mongoose.connection.readyState, 0);
});

test('el JWT, cuerpo, query y cabeceras no sustituyen identidad, organizacion ni rol de BD', async () => {
  datos.relaciones[0].rol = 'consulta';
  const res = await request(app).post(ruta() + '?usuarioId=' + V + '&organizacionId=' + B + '&rol=administrador')
    .set('Cookie', cookie(token({ rol: 'admin', organizacionId: B })))
    .set('X-User-Id', V).set('X-Organizacion-Id', B).set('X-Role', 'administrador')
    .send({ usuarioId: V, organizacionId: B, rol: 'administrador',
      contextoOrganizacion: { usuarioId: V, organizacionId: B, rol: 'administrador' } });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, { usuarioId: U, organizacionId: A, membresiaId: M, rol: 'consulta' });
});

test('cambiar el ID de la URL no abre otra empresa aunque exista', async () => {
  assert.equal((await get(B)).status, 403);
  assert.equal(datos.atendidas, 0);
});

test('dos cuentas quedan separadas por la pareja usuario y organizacion', async () => {
  const otraSesion = token({ id: V });
  const propia = await get(B, otraSesion);
  assert.equal(propia.status, 200);
  assert.equal(propia.body.data.usuarioId, V);
  assert.equal(propia.body.data.rol, 'consulta');
  assert.equal((await get(A, otraSesion)).status, 403);
  assert.equal((await get(B)).status, 403);
});

test('admin global no obtiene contexto de una empresa sin pertenencia', async () => {
  datos.usuarios[U].rol = 'admin';
  assert.equal((await get(B, token({ rol: 'admin' }))).status, 403);
  assert.equal(datos.atendidas, 0);
});

test('empresa ajena y empresa inexistente devuelven el mismo rechazo', async () => {
  const ajena = await get(B);
  const ausente = await get(C);
  assert.equal(ajena.status, 403);
  assert.equal(ausente.status, 403);
  assert.deepEqual(ajena.body, ausente.body);
  assert.deepEqual(ausente.body, {
    ok: false, codigo: 'ACCESO_ORGANIZACION_DENEGADO', error: 'No tienes acceso a esta organización'
  });
});

test('ID mal formado se rechaza con 400 antes de consultar modelos organizativos', async () => {
  const res = await get('incorrecto');
  assert.equal(res.status, 400);
  assert.equal(res.body.codigo, 'ORGANIZACION_INVALIDA');
  assert.equal(datos.consultas.length, 0);
  assert.equal(datos.atendidas, 0);
});

test('no usa query como sustituto de un parametro de ruta ausente', async () => {
  const res = await request(app).get('/prueba/sin-parametro?organizacionId=' + A)
    .set('Cookie', cookie(token()));
  assert.equal(res.status, 400);
  assert.equal(datos.atendidas, 0);
});

for (const estado of ['pendiente', 'suspendida', 'revocada']) {
  test('HTTP deniega membresia ' + estado, async () => {
    datos.relaciones[0].estado = estado;
    assert.equal((await get()).status, 403);
    assert.equal(datos.atendidas, 0);
  });
}

for (const estado of ['en_preparacion', 'suspendida', 'cerrada']) {
  test('HTTP deniega organizacion ' + estado, async () => {
    datos.empresas[0].estado = estado;
    assert.equal((await get()).status, 403);
    assert.equal(datos.atendidas, 0);
  });
}

test('una membresia huerfana no habilita una empresa ausente', async () => {
  datos.empresas = [];
  assert.equal((await get()).status, 403);
  assert.equal(datos.atendidas, 0);
});

test('dos membresias para la pareja no se resuelven tomando el rol mas alto', async () => {
  datos.relaciones.push({ ...datos.relaciones[0], _id: '300000000000000000000003', rol: 'administrador' });
  assert.equal((await get()).status, 403);
  assert.equal(datos.atendidas, 0);
});

test('rol desconocido se deniega aunque el JWT diga administrador', async () => {
  datos.relaciones[0].rol = 'coordinador';
  assert.equal((await get(A, token({ rol: 'administrador' }))).status, 403);
  assert.equal(datos.atendidas, 0);
});

test('misma cookie refleja cambio de rol y deja de pasar tras revocar pertenencia', async () => {
  const sesion = token();
  assert.equal((await get(A, sesion)).body.data.rol, 'colaborador');
  datos.relaciones[0].rol = 'consulta';
  assert.equal((await get(A, sesion)).body.data.rol, 'consulta');
  datos.relaciones[0].estado = 'revocada';
  assert.equal((await get(A, sesion)).status, 403);
  assert.equal(datos.atendidas, 2);
});

test('misma cookie deja de pasar tras suspender la organizacion', async () => {
  const sesion = token();
  assert.equal((await get(A, sesion)).status, 200);
  datos.empresas[0].estado = 'suspendida';
  assert.equal((await get(A, sesion)).status, 403);
  assert.equal(datos.atendidas, 1);
});

for (const fallo of ['sesion', 'membresia', 'empresa']) {
  test('HTTP responde 503 sin ejecutar controlador ni filtrar error interno de ' + fallo, async () => {
    datos.fallo = fallo;
    const res = await get();
    assert.equal(res.status, 503);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.error, 'Servicio no disponible temporalmente');
    assert.equal(res.text.includes('sintetico'), false);
    assert.equal(res.text.includes('stack'), false);
    assert.equal(datos.atendidas, 0);
  });
}

test('fallo inesperado llega al manejador de errores, nunca al controlador final', async () => {
  const causa = new Error('fallo sintetico de programacion');
  const conFallo = aplicacion(crearMiddlewareOrganizacion({
    resolverContexto: async () => { throw causa; }
  }));
  const res = await request(conFallo).get(ruta()).set('Cookie', cookie(token()));
  assert.equal(res.status, 500);
  assert.equal(conFallo.locals.errorObservado, causa);
  assert.equal(res.text.includes(causa.message), false);
  assert.equal(datos.atendidas, 0);
});
