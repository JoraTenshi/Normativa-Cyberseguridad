const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Decisión del contrato (docs/contrato-evaluacion.md §6): el resultado es un "índice de autoevaluación",
// no un "cumplimiento". Los textos legales (banner de cookies) pueden seguir usando la palabra.
const leer = rel => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', rel), 'utf8');

for (const pagina of ['pages/Resultado.jsx', 'pages/HistorialDetalle.jsx', 'pages/PlanDirector.jsx']) {
  test(`${pagina} no presenta el resultado como "cumplimiento"`, () => {
    assert.doesNotMatch(leer(pagina), /cumplimiento/i);
  });
}

test('el informe se titula "Informe de autoevaluación"', () => {
  assert.match(leer('pages/Resultado.jsx'), />Informe de autoevaluación</);
});

test('la API describe el nivel como índice de autoevaluación', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'resultados.js'), 'utf8');
  const mensajes = src.match(/const MENSAJES_NIVEL = \{([\s\S]*?)\};/)[1];
  assert.equal((mensajes.match(/Índice de autoevaluación/g) ?? []).length, 4);
  assert.doesNotMatch(mensajes, /cumplimiento/i);
});
