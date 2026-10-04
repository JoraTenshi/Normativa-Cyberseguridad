'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularIndice, getNivel } = require('../utils/scoring');
const { validarRespuestas } = require('../validation/validarRespuestas');
const { cargarNormativas } = require('../seed/seed');

// Fixture del contrato: bloque A (peso 80, 1 pregunta), bloque B (peso 20, 3 preguntas).
const norma = {
  id: 'fixture',
  bloques: [
    { id: 'A', nombre: 'Bloque A', peso_bloque: 80, preguntas: [{ id: 'a1', peso: 1 }] },
    {
      id: 'B', nombre: 'Bloque B', peso_bloque: 20,
      preguntas: [{ id: 'b1', peso: 1 }, { id: 'b2', peso: 1 }, { id: 'b3', peso: 2 }],
    },
  ],
};
const resp = (a1, b1, b2, b3) => [
  { pregunta_id: 'a1', valor: a1 }, { pregunta_id: 'b1', valor: b1 },
  { pregunta_id: 'b2', valor: b2 }, { pregunta_id: 'b3', valor: b3 },
];

test('A al 100 % y B al 0 % da 80 aunque B tenga más preguntas', () => {
  const r = calcularIndice(norma, resp(1, 0, 0, 0));
  assert.equal(r.porcentaje_exacto, 80);
  assert.equal(r.porcentaje, 80);
});

test('todo Sí da 100 y todo No da 0', () => {
  assert.equal(calcularIndice(norma, resp(1, 1, 1, 1)).porcentaje_exacto, 100);
  assert.equal(calcularIndice(norma, resp(0, 0, 0, 0)).porcentaje_exacto, 0);
});

test('valores 0,5 y pesos de pregunta dentro del bloque', () => {
  // A = 50 %; B = (0.5*1 + 1*1 + 0*2) / 4 = 37.5 %; índice = 0.8*50 + 0.2*37.5 = 47.5
  const r = calcularIndice(norma, resp(0.5, 0.5, 1, 0));
  assert.equal(r.bloques[1].porcentaje_exacto, 37.5);
  assert.equal(r.porcentaje_exacto, 47.5);
  assert.equal(r.porcentaje, 48);
});

test('bloque con peso 0 no cuenta y se renormaliza', () => {
  const n = structuredClone(norma);
  n.bloques[1].peso_bloque = 0;
  assert.equal(calcularIndice(n, resp(1, 0, 0, 0)).porcentaje_exacto, 100);
});

test('bloque sin preguntas se excluye y se renormaliza', () => {
  const n = structuredClone(norma);
  n.bloques.push({ id: 'C', nombre: 'Vacío', peso_bloque: 50, preguntas: [] });
  const r = calcularIndice(n, resp(1, 0, 0, 0));
  assert.equal(r.porcentaje_exacto, 80);
  assert.equal(r.bloques[2].evaluable, false);
});

test('sin nada evaluable no inventa un 0 %', () => {
  const n = { bloques: [{ id: 'X', nombre: 'X', peso_bloque: 100, preguntas: [] }] };
  const r = calcularIndice(n, []);
  assert.equal(r.sin_base_evaluable, true);
  assert.equal(r.porcentaje, null);
});

test('catálogo con pesos inválidos se rechaza', () => {
  const n = structuredClone(norma);
  n.bloques[0].peso_bloque = -5;
  assert.throws(() => calcularIndice(n, resp(1, 1, 1, 1)), /CATALOGO_INVALIDO/);
});

test('umbrales de nivel usan el valor exacto', () => {
  const casos = [[29.5, 'Crítico'], [30, 'Bajo'], [59.5, 'Bajo'], [60, 'Medio'], [84.5, 'Medio'], [85, 'Alto']];
  for (const [v, esperado] of casos) assert.equal(getNivel(v), esperado, `valor ${v}`);
});

test('validación: acepta un cuestionario completo', () => {
  assert.deepEqual(validarRespuestas(norma, resp(1, 0.5, 0, 1)), { ok: true });
});

test('validación: rechaza null, ID ajeno, duplicado, valor raro e incompleto', () => {
  const base = resp(1, 1, 1, 1);
  assert.equal(validarRespuestas(norma, [null, ...base.slice(1)]).code, 'RESPUESTA_INVALIDA');
  assert.equal(validarRespuestas(norma, [...base.slice(0, 3), { pregunta_id: 'zz', valor: 1 }]).code, 'RESPUESTA_INVALIDA');
  assert.equal(validarRespuestas(norma, [...base, base[0]]).code, 'RESPUESTA_DUPLICADA');
  assert.equal(validarRespuestas(norma, [...base.slice(0, 3), { pregunta_id: 'b3', valor: 0.7 }]).code, 'RESPUESTA_INVALIDA');
  assert.equal(validarRespuestas(norma, [...base.slice(0, 3), { pregunta_id: 'b3', valor: '1' }]).code, 'RESPUESTA_INVALIDA');
  const inc = validarRespuestas(norma, base.slice(0, 3));
  assert.equal(inc.code, 'CUESTIONARIO_INCOMPLETO');
  assert.deepEqual(inc.faltan, ['b3']);
  assert.equal(validarRespuestas(norma, 'no-array').code, 'RESPUESTA_INVALIDA');
});

test('las 11 normativas reales pasan el catálogo y dan 100 con todo Sí y 0 con todo No', () => {
  for (const n of cargarNormativas()) {
    const ids = [...new Set(n.bloques.flatMap((b) => b.preguntas.map((p) => p.id)))];
    const todas = (valor) => ids.map((pregunta_id) => ({ pregunta_id, valor }));

    assert.deepEqual(validarRespuestas(n, todas(1)), { ok: true }, n.id);
    assert.equal(calcularIndice(n, todas(1)).porcentaje_exacto, 100, n.id);
    assert.equal(calcularIndice(n, todas(0)).porcentaje_exacto, 0, n.id);
  }
});

// ── Cobertura estimada ponderada por peso_bloque (tarea 11) ──────────────────
const { calcularCoberturaEstimada } = require('../utils/scoring');

// Perfil: tema "x" al 100 % (bloque A) y tema "z" al 0 % (bloque B).
const actual = {
  bloques: [
    { id: 'A', peso_bloque: 80, temas: ['x'], preguntas: [{ id: 'a1', peso: 1 }] },
    { id: 'B', peso_bloque: 20, temas: ['z'], preguntas: [{ id: 'b1', peso: 9 }] },
  ],
};
const pbs = [
  { bloque_id: 'A', porcentaje_exacto: 100 },
  { bloque_id: 'B', porcentaje_exacto: 0 },
];
// Destino: E (tema x) pesa poco por bloque pero mucho por puntos; F (tema z) al revés.
const destino = {
  id: 'destino', nombre: 'Destino',
  bloques: [
    { id: 'E', nombre: 'E', peso_bloque: 10, temas: ['x'], preguntas: [{ id: 'e1', peso: 100 }] },
    { id: 'F', nombre: 'F', peso_bloque: 90, temas: ['z'], preguntas: [{ id: 'f1', peso: 1 }] },
    { id: 'G', nombre: 'G', peso_bloque: 0,  temas: ['y'], preguntas: [{ id: 'g1', peso: 5 }] },
  ],
};

test('cobertura: la proyección pondera por peso_bloque, no por puntos de pregunta', () => {
  // (100×10 + 0×90) / 100 = 10. Con puntos de pregunta daría (100×100 + 0×1) / 101 ≈ 99.
  const [c] = calcularCoberturaEstimada(actual, pbs, [destino]);
  assert.equal(c.porcentaje_estimado, 10);
  assert.deepEqual(c.bloques_estimados.map(b => b.porcentaje_estimado), [100, 0, null]);
  assert.equal(c.cobertura_tematica, 0.67);
  assert.equal(c.tipo, 'estimado');
});

test('cobertura: el perfil temático pondera por peso_bloque', () => {
  // A y B comparten tema: (100×80 + 0×20) / 100 = 80. Con puntos daría (100×1 + 0×9) / 10 = 10.
  const mismoTema = structuredClone(actual);
  mismoTema.bloques[1].temas = ['x'];
  const [c] = calcularCoberturaEstimada(mismoTema, pbs, [destino]);
  assert.equal(c.bloques_estimados[0].porcentaje_estimado, 80);
});

test('cobertura: un bloque contestado con peso_bloque 0 no entra en el perfil', () => {
  const conCero = structuredClone(actual);
  conCero.bloques[1] = { ...conCero.bloques[1], temas: ['x'], peso_bloque: 0 };
  const [c] = calcularCoberturaEstimada(conCero, pbs, [destino]);
  assert.equal(c.bloques_estimados[0].porcentaje_estimado, 100);
});

test('cobertura con datos reales: una entrada por cada otra normativa, valores entre 0 y 100', () => {
  const todas = cargarNormativas();
  const nis2 = todas.find(n => n.id === 'nis2');
  const ids = nis2.bloques.flatMap(b => b.preguntas.map(p => p.id));
  const { bloques } = calcularIndice(nis2, ids.map((pregunta_id, i) => ({ pregunta_id, valor: i % 2 })));
  const otras = todas.filter(n => n.id !== 'nis2');

  const cobertura = calcularCoberturaEstimada(nis2, bloques, otras);
  assert.equal(cobertura.length, otras.length);
  for (const c of cobertura) {
    if (c.porcentaje_estimado !== null) assert.ok(c.porcentaje_estimado >= 0 && c.porcentaje_estimado <= 100, c.normativa_id);
  }
});
