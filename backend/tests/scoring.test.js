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
