'use strict';
// Prueba HTTP + persistencia real. Solo acepta un Mongo de pruebas en loopback.
// Crea una base aleatoria propia, no utiliza la base indicada en la URI y borra SOLO esa base al acabar.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

async function comprobar(uri) {
  const direccion = new URL(uri);
  if (direccion.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost', '[::1]'].includes(direccion.hostname)) {
    throw new Error('Utiliza un MongoDB de pruebas aislado en loopback');
  }
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.APP_URL = 'https://localhost';
  const mongoose = require('mongoose');
  const request = require('supertest');
  const speakeasy = require('speakeasy');
  const Usuario = require('../models/Usuario');
  const Resultado = require('../models/Resultado');
  const Normativa = require('../models/Normativa');
  const RevokedToken = require('../models/RevokedToken');
  const { cargarNormativas, sembrarNormativas } = require('../seed/seed');
  const { createApp } = require('../app');
  const nombreBD = 'nc_integration_' + crypto.randomBytes(12).toString('hex');
  const comprobaciones = [];
  const ok = nombre => { comprobaciones.push(nombre); console.log('OK ' + nombre); };
  try {
    await mongoose.connect(uri, { dbName: nombreBD, serverSelectionTimeoutMS: 5000 });
    await Promise.all([Usuario.init(), Resultado.init(), Normativa.init(), RevokedToken.init()]);
    await sembrarNormativas(Normativa, cargarNormativas());
    assert.equal(await Normativa.countDocuments(), 11);
    await assert.rejects(sembrarNormativas(Normativa, cargarNormativas()), /ya contiene/);
    assert.equal(await Normativa.countDocuments(), 11);
    ok('seed inicial y segunda ejecución no destructiva');
    const password = 'Integracion-Prueba-2026!';
    const [a, b] = await Usuario.create([
      { nombre: 'Prueba A', email: 'a@example.test', password, emailVerifiedAt: new Date() },
      { nombre: 'Prueba B', email: 'b@example.test', password, emailVerifiedAt: new Date() }
    ]);
    const app = createApp({ rateLimits:false, politicaSesiones:'legado_pruebas' });
    const post = (url, cookie, body) => request(app).post(url).set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', cookie || '').send(body);
    const get = (url, cookie) => request(app).get(url).set('Cookie', cookie);
    const cookieDe = (res, nombre) => res.headers['set-cookie']?.find(c => c.startsWith(nombre + '='))?.split(';')[0];
    const loginA = await post('/auth/login', '', { email: a.email, password });
    const loginB = await post('/auth/login', '', { email: b.email, password });
    assert.equal(loginA.status, 200);
    assert.equal(loginB.status, 200);
    const cookieA = cookieDe(loginA, 'cyberaudit_token');
    const cookieB = cookieDe(loginB, 'cyberaudit_token');
    assert.match(loginA.headers['set-cookie'].join(';'), /HttpOnly/);
    assert.match(loginA.headers['set-cookie'].join(';'), /Secure/);
    assert.match(loginA.headers['set-cookie'].join(';'), /SameSite=Strict/);
    ok('login real, bcrypt y atributos de cookie');
    const norma = await Normativa.findOne({ id: 'lssi_ce' });
    const respuestas = norma.bloques.flatMap(bloque => bloque.preguntas.map(p => ({
      pregunta_id: p.id, valor: bloque.id === 'LSSI-COM' ? 1 : 0
    })));
    for (const invalidas of [[null], [respuestas[0]], [...respuestas, respuestas[0]]]) {
      assert.equal((await post('/resultado', cookieA, { normativa: norma.id, respuestas: invalidas })).status, 400);
    }
    assert.equal(await Resultado.countDocuments(), 0);
    assert.equal((await post('/resultado', 'cyberaudit_token=incorrecta', { normativa: norma.id, respuestas })).status, 401);
    assert.equal(await Resultado.countDocuments(), 0);
    ok('validación y sesión inválida sin persistencia accidental');
    const envio = await post('/resultado', cookieA, { normativa: norma.id, respuestas });
    assert.equal(envio.status, 201);
    assert.equal(envio.body.data.porcentaje_exacto, 26);
    const rid = envio.body.data.id;
    const guardado = await Resultado.findById(rid).lean();
    assert.equal(guardado.normativa_snapshot.bloques[0].preguntas[0].referencia_articulo, norma.bloques[0].preguntas[0].referencia_articulo);
    assert.match(guardado.normativa_snapshot.huella_sha256, /^[a-f0-9]{64}$/);
    assert.equal(guardado.cobertura_estimada.length, 10);
    ok('resultado ponderado y snapshot completo persistidos');
    const antes = await get('/me/historial/' + rid, cookieA);
    const planAntes = await get('/me/pds/' + rid, cookieA);
    assert.equal(antes.status, 200);
    assert.equal(planAntes.status, 200);
    await Normativa.updateOne({ id: norma.id }, { $set: { nombre: 'Catálogo posterior', 'bloques.0.preguntas.0.texto': 'Texto posterior' } });
    assert.deepEqual((await get('/me/historial/' + rid, cookieA)).body, antes.body);
    assert.deepEqual((await get('/me/pds/' + rid, cookieA)).body, planAntes.body);
    for (const url of ['/me/historial/', '/me/pds/']) assert.equal((await get(url + rid, cookieB)).status, 404);
    ok('histórico inmutable y aislamiento entre dos cuentas');
    const jose = { ...guardado, _id: new mongoose.Types.ObjectId(), bloques: guardado.puntuaciones_bloques,
      remediaciones_snapshot: guardado.remediaciones };
    jose.puntuaciones_bloques = []; // default del esquema previo de Kali, aunque el índice estuviera en bloques
    delete jose.remediaciones; delete jose.cobertura_estimada;
    const jorge = { ...guardado, _id: new mongoose.Types.ObjectId(), cuestionario: guardado.normativa_snapshot.bloques };
    delete jorge.normativa_snapshot;
    const legacy = { _id: new mongoose.Types.ObjectId(), usuario: a._id, normativa: norma.id,
      respuestas: [respuestas[0]], porcentaje: 30, puntuacion_total: 1.5, puntuacion_maxima: 5, createdAt: new Date() };
    await Resultado.collection.insertMany([jose, jorge, legacy]);
    for (const doc of [jose, jorge, legacy]) {
      const detalle = await get('/me/historial/' + doc._id, cookieA);
      const pds = await get('/me/pds/' + doc._id, cookieA);
      assert.equal(detalle.status, 200);
      assert.equal(pds.status, 200);
      assert.equal(detalle.body.data.porcentaje, doc.porcentaje);
      if (doc === legacy) {
        assert.equal(detalle.body.data.algoritmo_version, '1');
        assert.equal(detalle.body.data.origen_catalogo, 'catalogo_actual');
      } else {
        assert.equal(detalle.body.data.origen_catalogo, 'instantanea');
        assert.equal(detalle.body.data.remediaciones.length, guardado.remediaciones.length);
        assert.equal(detalle.body.data.indice_bloques.length, guardado.puntuaciones_bloques.length);
      }
    }
    ok('lectura Mongo de las dos variantes v2 y del histórico v1');
    const antesAnonimo = await Resultado.countDocuments();
    assert.equal((await post('/resultado', '', { normativa: norma.id, respuestas })).body.data.id, null);
    assert.equal(await Resultado.countDocuments(), antesAnonimo);
    ok('invitado explícito sin guardar histórico');
    const setups = await Promise.all([post('/me/2fa/setup', cookieA), post('/me/2fa/setup', cookieA)]);
    const buenos = setups.filter(r => r.status === 200);
    assert.ok(buenos.length >= 1);
    assert.ok(setups.every(r => [200, 409].includes(r.status)));
    if (buenos.length === 2) assert.equal(buenos[0].body.data.secret, buenos[1].body.data.secret);
    // Cada código TOTP vale una vez: se activa con el del intervalo anterior y se entra con el actual.
    const codigo = (desplazamiento = 0) => speakeasy.totp({
      secret: buenos[0].body.data.secret, encoding: 'base32', time: Math.floor(Date.now() / 1000) + desplazamiento
    });
    assert.equal((await post('/me/2fa/enable', cookieA, { token: codigo(-30) })).status, 200);
    assert.equal((await post('/me/2fa/setup', cookieA)).status, 409);
    const pendiente = await post('/auth/login', '', { email: a.email, password });
    const cookiePendiente = cookieDe(pendiente, 'cyberaudit_2fa_pending');
    assert.ok(cookiePendiente);
    const incorrecta = cookiePendiente.replace('cyberaudit_2fa_pending=', 'cyberaudit_token=');
    assert.equal((await get('/me', incorrecta)).status, 401);
    const consumos = await Promise.all([post('/auth/2fa/verify', cookiePendiente, { token: codigo() }), post('/auth/2fa/verify', cookiePendiente, { token: codigo() })]);
    assert.deepEqual(consumos.map(r => r.status).sort(), [200, 401]);
    ok('2FA: setup concurrente, activación y desafío de un solo uso');
    assert.equal((await request(app).post('/auth/logout').set('Cookie', cookieB).set('Origin', 'https://otro.example')).status, 403);
    assert.equal((await get('/me', cookieB)).status, 200);
    assert.equal((await post('/licitaciones/sync', cookieB, { anio: 2026, mes: 1 })).status, 403);
    ok('origen ajeno y sincronización sin rol bloqueados');
    console.log('COMPLETADO: ' + comprobaciones.length + ' grupos de comprobaciones con MongoDB real; no es una prueba de navegador ni de Docker.');
  } finally {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === nombreBD) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  if (!process.env.TEST_MONGODB_URI) throw new Error('Falta TEST_MONGODB_URI de un Mongo aislado en loopback');
  comprobar(process.env.TEST_MONGODB_URI).catch(err => { console.error(err.message); process.exitCode = 1; });
}
module.exports = { comprobar };
