const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';

const Normativa = require('../models/Normativa');
const Resultado = require('../models/Resultado');
const Usuario = require('../models/Usuario');
const RevokedToken = require('../models/RevokedToken');
const { createApp } = require('../app');
const { generateJti } = require('../middleware/auth');

const USER_ID = '64b000000000000000000001';
const normativa = {
  id: 'fixture', nombre: 'Normativa de prueba',
  bloques: [
    { id: 'A', nombre: 'Bloque A', peso_bloque: 80, preguntas: [{
      id: 'a1', texto: 'Pregunta A', peso: 1, remediacion: 'Revisar A', fase_pds: 1
    }] },
    { id: 'B', nombre: 'Bloque B', peso_bloque: 20,
      preguntas: [
        { id: 'b1', texto: 'Pregunta B1', peso: 1 },
        { id: 'b2', texto: 'Pregunta B2', peso: 1 },
        { id: 'b3', texto: 'Pregunta B3', peso: 2 }
      ] }
  ]
};

let consultasPosteriores = 0;
let resultadosCreados = 0;
let ultimoResultadoGuardado = null;
Normativa.findOne = async ({ id }) => id === 'sin-base'
  ? { ...normativa, id, bloques: normativa.bloques.map(b => ({ ...b, peso_bloque: 0 })) }
  : normativa;
Normativa.find = async () => { consultasPosteriores++; return []; };
Resultado.create = async (datos) => {
  resultadosCreados++;
  ultimoResultadoGuardado = datos;
  return { _id: 'resultado-prueba' };
};
Usuario.findById = () => ({ select: async () => ({ emailVerifiedAt: new Date(), sessionVersion: 0 }) });
RevokedToken.exists = async () => null;

const app = createApp({ rateLimits:false, politicaSesiones:'legado_pruebas' });
const cookie = `cyberaudit_token=${jwt.sign(
  { id: USER_ID, sessionVersion: 0, jti: generateJti() },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
)}`;
const enviar = (respuestas, normativaId = 'fixture') => request(app).post('/resultado').set('X-Requested-With', 'XMLHttpRequest').set('Cookie', cookie)
  .send({ normativa: normativaId, respuestas });

test('POST /resultado rechaza respuestas inválidas antes de consultar más datos o guardar', async () => {
  const base = [
    { pregunta_id: 'a1', valor: 1 }, { pregunta_id: 'b1', valor: 0 },
    { pregunta_id: 'b2', valor: 0 }, { pregunta_id: 'b3', valor: 0 }
  ];
  const casos = [
    { respuestas: [null, ...base.slice(1)], error: 'RESPUESTA_INVALIDA' },
    { respuestas: [...base, base[0]], error: 'RESPUESTA_DUPLICADA' },
    { respuestas: [base[0]], error: 'CUESTIONARIO_INCOMPLETO' },
    { respuestas: [...base.slice(0, 3), { pregunta_id: 'ajena', valor: 0 }], error: 'RESPUESTA_INVALIDA' }
  ];

  for (const caso of casos) {
    const res = await enviar(caso.respuestas);
    assert.equal(res.status, 400);
    assert.equal(res.body.code, caso.error);
  }
  assert.equal(consultasPosteriores, 0);
  assert.equal(resultadosCreados, 0);

  const incompleta = await enviar([base[0]]);
  assert.deepEqual(incompleta.body.faltan, ['b1', 'b2', 'b3']);
});

test('POST /resultado rechaza un cuerpo JSON nulo', async () => {
  const res = await request(app).post('/resultado').set('X-Requested-With', 'XMLHttpRequest').set('Cookie', cookie)
    .set('Content-Type', 'application/json').send('null');
  assert.equal(res.status, 400);
  assert.equal(resultadosCreados, 0);
});

test('POST /resultado calcula 80 % por pesos de bloque y guarda la versión 2', async () => {
  const res = await enviar([
    { pregunta_id: 'a1', valor: 1 }, { pregunta_id: 'b1', valor: 0 },
    { pregunta_id: 'b2', valor: 0 }, { pregunta_id: 'b3', valor: 0 }
  ]);
  assert.equal(res.status, 201);
  assert.equal(res.body.data.id, 'resultado-prueba');
  assert.equal(res.body.data.algoritmo_version, '2');
  assert.equal(res.body.data.porcentaje_exacto, 80);
  assert.equal(res.body.data.porcentaje, 80);
  assert.equal(res.body.data.puntuaciones_bloques[0].peso_bloque, 80);
  assert.equal(res.body.data.puntuacion_total, undefined);
  assert.equal(ultimoResultadoGuardado.algoritmo_version, '2');
  assert.equal(ultimoResultadoGuardado.porcentaje_exacto, 80);
  assert.equal(ultimoResultadoGuardado.normativa_nombre, 'Normativa de prueba');
  assert.equal(ultimoResultadoGuardado.normativa_snapshot.version, 1);
  assert.equal(ultimoResultadoGuardado.normativa_snapshot.bloques[0].preguntas[0].texto, 'Pregunta A');
  assert.equal(ultimoResultadoGuardado.remediaciones.length, 3);
  assert.equal(ultimoResultadoGuardado.puntuacion_total, undefined);
  assert.equal(resultadosCreados, 1);
});

test('POST /resultado no inventa un 0 % cuando todos los bloques pesan cero', async () => {
  const res = await enviar([
    { pregunta_id: 'a1', valor: 1 }, { pregunta_id: 'b1', valor: 0 },
    { pregunta_id: 'b2', valor: 0 }, { pregunta_id: 'b3', valor: 0 }
  ], 'sin-base');
  assert.equal(res.status, 201);
  assert.equal(res.body.data.sin_base_evaluable, true);
  assert.equal(res.body.data.porcentaje, null);
  assert.equal(res.body.data.nivel, null);
  assert.match(res.body.data.mensaje, /No hay bloques evaluables/);
  assert.equal(ultimoResultadoGuardado.porcentaje_exacto, null);
});
test('una cookie inválida no calcula ni guarda una evaluación anónima sin avisar', async () => {
  const guardadosAntes = resultadosCreados;
  const consultasAntes = consultasPosteriores;
  const res = await request(app).post('/resultado')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', 'cyberaudit_token=no-valido')
    .send({ normativa: 'fixture', respuestas: [{ pregunta_id: 'a1', valor: 1 }] });
  assert.equal(res.status, 401);
  assert.equal(resultadosCreados, guardadosAntes);
  assert.equal(consultasPosteriores, consultasAntes);
});
