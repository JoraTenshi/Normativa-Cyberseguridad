const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';

const Usuario = require('../models/Usuario');
const RevokedToken = require('../models/RevokedToken');
const Resultado = require('../models/Resultado');
const Normativa = require('../models/Normativa');
const { createApp } = require('../app');
const { generateJti } = require('../middleware/auth');

const USER_ID = '64b000000000000000000001';
const LEGACY_ID = '64b000000000000000000011';
const V2_ID = '64b000000000000000000022';
const normativa = {
  id: 'fixture', nombre: 'Normativa de prueba',
  bloques: [{ id: 'A', nombre: 'Bloque A', temas: [],
    preguntas: [
      { id: 'a1', peso: 1, texto: 'Pregunta A' },
      { id: 'a2', peso: 1, texto: 'Pregunta añadida después' }
    ] }]
};
const legacy = {
  _id: LEGACY_ID, normativa: 'fixture', porcentaje: 30,
  puntuacion_total: 1.5, puntuacion_maxima: 5,
  puntuaciones_bloques: [{ bloque_id: 'A', nombre: 'Bloque A', porcentaje: 30,
    puntuacion: 1.5, max_puntuacion: 5 }],
  respuestas: [{ pregunta_id: 'a1', valor: 0 }], createdAt: new Date()
};
const nuevo = {
  _id: V2_ID, normativa: 'fixture', algoritmo_version: '2',
  normativa_nombre: 'Normativa al evaluar',
  normativa_snapshot: {
    version: 1, id: 'fixture', nombre: 'Normativa al evaluar',
    bloques: [{ id: 'A', nombre: 'Bloque original', peso_bloque: 100, temas: [],
      preguntas: [{ id: 'a1', peso: 1, texto: 'Pregunta original',
        remediacion: 'Acción original', fase_pds: 3 }] }]
  },
  remediaciones_snapshot: [{
    pregunta_id: 'a1', bloque_id: 'A', bloque: 'Bloque original',
    pregunta: 'Pregunta original', remediacion: 'Acción original',
    fase_pds: 3, valor_actual: 0.5, prioridad: 0.5
  }],
  porcentaje_exacto: 29.5, porcentaje: 30, sin_base_evaluable: false,
  // El esquema anterior de Kali persistía este array vacío por defecto.
  puntuaciones_bloques: [],
  bloques: [{ bloque_id: 'A', nombre: 'Bloque A', peso_bloque: 100,
    porcentaje_exacto: 29.5, puntuacion: 0.295, max_puntuacion: 1, evaluable: true }],
  respuestas: [{ pregunta_id: 'a1', valor: 0.5 }], createdAt: new Date()
};

Usuario.findById = () => ({ select: async () => ({ emailVerifiedAt: new Date(), sessionVersion: 0 }) });
RevokedToken.exists = async () => null;
Resultado.find = () => ({ sort: async () => [nuevo, legacy] });
Resultado.findOne = async ({ _id }) => String(_id) === V2_ID ? nuevo : String(_id) === LEGACY_ID ? legacy : null;
Normativa.find = async () => [normativa];
Normativa.findOne = async () => normativa;

const app = createApp({ rateLimits:false, politicaSesiones:'legado_pruebas' });
const cookie = `cyberaudit_token=${jwt.sign(
  { id: USER_ID, sessionVersion: 0, jti: generateJti() },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
)}`;
const get = (ruta) => request(app).get(ruta).set('Cookie', cookie);

test('historial distingue el nivel exacto v2 del porcentaje redondeado anterior', async () => {
  const res = await get('/me/historial');
  assert.equal(res.status, 200);
  assert.equal(res.body.data[0].algoritmo_version, '2');
  assert.equal(res.body.data[0].normativa_nombre, 'Normativa al evaluar');
  assert.equal(res.body.data[0].porcentaje, 30);
  assert.equal(res.body.data[0].porcentaje_exacto, 29.5);
  assert.equal(res.body.data[0].nivel, 'Crítico');
  assert.equal(res.body.data[1].algoritmo_version, '1');
  assert.equal(res.body.data[1].porcentaje_exacto, null);
  assert.equal(res.body.data[1].nivel, 'Bajo');
  assert.equal(res.body.data[1].puntuacion_total, 1.5);
});

test('detalle conserva las preguntas y separa el desglose v2', async () => {
  const nuevoRes = await get(`/me/historial/${V2_ID}`);
  assert.equal(nuevoRes.status, 200);
  assert.equal(nuevoRes.body.data.nivel, 'Crítico');
  assert.equal(nuevoRes.body.data.bloques[0].preguntas[0].id, 'a1');
  assert.equal(nuevoRes.body.data.bloques[0].preguntas.length, 1);
  assert.equal(nuevoRes.body.data.bloques[0].preguntas[0].texto, 'Pregunta original');
  assert.equal(nuevoRes.body.data.remediaciones[0].remediacion, 'Acción original');
  assert.equal(nuevoRes.body.data.indice_bloques[0].porcentaje_exacto, 29.5);

  const legacyRes = await get(`/me/historial/${LEGACY_ID}`);
  assert.equal(legacyRes.status, 200);
  assert.equal(legacyRes.body.data.algoritmo_version, '1');
  assert.equal(legacyRes.body.data.indice_bloques.length, 0);
  assert.equal(legacyRes.body.data.puntuacion_total, 1.5);
});

test('la propuesta de acciones usa el nivel correspondiente a la versión guardada', async () => {
  const nuevoRes = await get(`/me/pds/${V2_ID}`);
  const legacyRes = await get(`/me/pds/${LEGACY_ID}`);
  assert.equal(nuevoRes.status, 200);
  assert.equal(nuevoRes.body.data.nivel, 'Crítico');
  assert.equal(nuevoRes.body.data.algoritmo_version, '2');
  assert.equal(nuevoRes.body.data.preguntas_sin_respuesta, 0);
  assert.equal(nuevoRes.body.data.total_acciones, 1);
  assert.equal(nuevoRes.body.data.usa_etapas, true);
  assert.equal(nuevoRes.body.data.plan[0].acciones[0].pregunta_id, 'a1');
  assert.equal(nuevoRes.body.data.plan[0].acciones[0].accion, 'Acción original');
  assert.equal(legacyRes.status, 200);
  assert.equal(legacyRes.body.data.nivel, 'Bajo');
  assert.equal(legacyRes.body.data.algoritmo_version, '1');
  assert.equal(legacyRes.body.data.preguntas_sin_respuesta, 1);
  assert.equal(legacyRes.body.data.total_acciones, 1);
  assert.equal(legacyRes.body.data.usa_etapas, false);
});
