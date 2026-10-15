'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { catalogoNormativo, crearCatalogoNormativo } = require('../services/catalogoNormativoC2');
const { validarPaquete } = require('../validation/paqueteNormativo');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const exactos = {
  'ENS_POLITICA_SEGURIDAD.v3.json': '218a0e45daaaf92308497d52d57fca4fb4fb9a9dc87fd369c14f86971e24993c',
  'RGPD28_FORMALIZACION_CONTENIDO.v3.json': 'e22ab228f1b34329f814c5ae226ee1094147a0985a5ef770cfae08ffd50da6aa',
  'ENS_FUNCIONES_EJERCICIO.v1.json': 'f4f05b52a0e455bf550f5842b5f57e2c899cf6478511a181643ddce355162616',
  'ENS_SEPARACION_SEGURIDAD_SISTEMA.v1.json': '32e5f29b4db0720466db2f2f580dcb57fa88af13c933abdf63aeed2b3a1121eb',
  'ENS_POC_SERVICIO_EXTERNALIZADO.v1.json': 'e94253adfe87df17700007015fd9d533c2f27de4716f7377d941f1435449d5e1'
};
test('publicación acotada conserva los dos R3 y las tres entregas editoriales exactas', () => {
  const entradas = Object.keys(exactos).map(file => {
    const bytes = fs.readFileSync(path.join(__dirname, '../catalogo/c2', file));
    assert.equal(hash(bytes), exactos[file], file);
    return JSON.parse(bytes);
  });
  assert.deepEqual(catalogoNormativo.listar().map(p => p.ficha.id).sort(), entradas.map(p => p.ficha.id).sort());
  for (const p of entradas) assert.deepEqual(catalogoNormativo.obtener(p.ficha.id), validarPaquete(p));
});
test('las siete alternativas pertenecen a tres requisitos, no a siete requisitos', () => {
  const ps = catalogoNormativo.listar().filter(p => p.ficha.schemaVersion === 2);
  assert.equal(ps.length, 3);
  assert.deepEqual(ps.map(p => p.ficha.satisfaccion.rutas.length), [1, 2, 4]);
  for (const p of ps) {
    assert.equal(p.regla.cobertura.periodo.hasta, null);
    assert.equal(p.ficha.condicionesRevision.aprobacionAutomatica, false);
    assert.equal(p.ficha.condicionesRevision.preservarHistorico, true);
    assert.equal(p.ficha.usoContenido.incluyeISOoCCNProtegido, false);
  }
});
test('consultas de catálogo no mutan el original ni admiten sustitución duplicada', () => {
  const p = catalogoNormativo.obtener('ENS_POC_SERVICIO_EXTERNALIZADO');
  p.ficha.satisfaccion.rutas.length = 0;
  assert.equal(catalogoNormativo.obtener(p.ficha.id).ficha.satisfaccion.rutas.length, 4);
  const real = catalogoNormativo.obtener(p.ficha.id);
  const entrada = { ficha: real.ficha, regla: real.regla };
  assert.throws(() => crearCatalogoNormativo([entrada, entrada]), /duplicada/);
  assert.equal(catalogoNormativo.obtener('RGPD30_RAT'), null);
});
