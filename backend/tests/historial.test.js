const crypto = require('node:crypto');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const Normativa = require('../models/Normativa');
const Resultado = require('../models/Resultado');
const Usuario = require('../models/Usuario');
const RevokedToken = require('../models/RevokedToken');
const { createApp } = require('../app');
const { generateJti } = require('../middleware/auth');

const USER_ID = '64b000000000000000000001';
const RESULTADO_ID = '64b0000000000000000000aa';
const app = createApp({ rateLimits: false });

// Resultado guardado en el límite (se muestra 30 % pero el nivel exacto es Crítico), con su copia
// de cuestionario, remediaciones y cobertura tal como estaban al enviarlo.
const guardado = {
  _id: RESULTADO_ID, usuario: USER_ID, normativa: 'lssi_ce', normativa_nombre: 'LSSI-CE (en el envío)',
  cuestionario: [{ id: 'B1', nombre: 'Bloque al enviar', preguntas: [{ id: 'q1', texto: 'Texto al enviar', peso: 10 }] }],
  respuestas: [{ pregunta_id: 'q1', valor: 0.5 }],
  algoritmo_version: '2', porcentaje_exacto: 29.73, porcentaje: 30, nivel: 'Crítico',
  puntuaciones_bloques: [],
  remediaciones: [
    { pregunta_id: 'q1', bloque_id: 'B1', bloque: 'Bloque al enviar', pregunta: 'Texto al enviar',
      nivel: 'alto', fase_pds: 3, remediacion: 'Acción guardada', valor_actual: 0.5, prioridad: 5 }
  ],
  cobertura_estimada: [{ normativa_id: 'nis2', porcentaje_estimado: 41, tipo: 'estimado' }],
  createdAt: new Date('2026-10-04T10:00:00Z')
};

Resultado.find = () => ({ sort: async () => [guardado] });
Resultado.findOne = async () => guardado;
// Si el historial o el PDS consultaran el catálogo actual, estas pruebas fallarían.
const prohibido = () => { throw new Error('el historial y el PDS no deben leer el catálogo actual'); };
Normativa.find = prohibido;
Normativa.findOne = prohibido;
RevokedToken.exists = async () => null;
Usuario.findById = () => ({ select: async () => ({ emailVerifiedAt: new Date(), sessionVersion: 0 }) });

const sesion = `cyberaudit_token=${jwt.sign(
  { id: USER_ID, sessionVersion: 0, jti: generateJti() }, process.env.JWT_SECRET, { expiresIn: '1h' }
)}`;

test('GET /me/historial devuelve el nivel y el nombre guardados, sin puntos brutos', async () => {
  const res = await request(app).get('/me/historial').set('Cookie', sesion);
  assert.equal(res.status, 200);
  const [item] = res.body.data;
  assert.equal(item.normativa_nombre, 'LSSI-CE (en el envío)');
  assert.equal(item.porcentaje, 30);
  assert.equal(item.nivel, 'Crítico');
  assert.equal(item.algoritmo_version, '2');
  assert.equal('puntuacion_total' in item, false);
});

test('GET /me/historial/:id devuelve la copia guardada (cuestionario, remediaciones, cobertura)', async () => {
  const res = await request(app).get(`/me/historial/${RESULTADO_ID}`).set('Cookie', sesion);
  assert.equal(res.status, 200);
  const d = res.body.data;
  assert.equal(d.nivel, 'Crítico');
  assert.equal(d.porcentaje_exacto, 29.73);
  assert.equal(d.normativa_nombre, 'LSSI-CE (en el envío)');
  assert.deepEqual(d.bloques, guardado.cuestionario);
  assert.deepEqual(d.remediaciones, guardado.remediaciones);
  assert.deepEqual(d.cobertura_estimada, guardado.cobertura_estimada);
  assert.equal('puntuacion_total' in d, false);
  assert.equal('puntuacion_maxima' in d, false);
});

test('GET /me/pds/:id construye el plan con las remediaciones guardadas', async () => {
  const res = await request(app).get(`/me/pds/${RESULTADO_ID}`).set('Cookie', sesion);
  assert.equal(res.status, 200);
  const d = res.body.data;
  assert.equal(d.normativa_nombre, 'LSSI-CE (en el envío)');
  assert.equal(d.nivel, 'Crítico');
  assert.equal(d.total_acciones, 1);
  assert.equal(d.plan[0].fase, 3);
  assert.equal(d.plan[0].acciones[0].accion, 'Acción guardada');
  assert.equal(d.plan[0].acciones[0].descripcion, 'Texto al enviar');
});
