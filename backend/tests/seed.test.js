const test = require('node:test');
const assert = require('node:assert/strict');

const { sembrarNormativas, cargarNormativas, ColeccionNoVaciaError } = require('../seed/seed');

function modeloFalso(documentosIniciales = []) {
  const docs = [...documentosIniciales];
  const llamadas = { insertMany: 0, deleteMany: 0 };
  return {
    docs,
    llamadas,
    async countDocuments() { return docs.length; },
    async insertMany(nuevos) { llamadas.insertMany++; docs.push(...nuevos); },
    async deleteMany() { llamadas.deleteMany++; docs.length = 0; },
  };
}

test('siembra una colección vacía', async () => {
  const modelo = modeloFalso();
  const insertadas = await sembrarNormativas(modelo, [{ id: 'a' }, { id: 'b' }]);

  assert.equal(insertadas, 2);
  assert.deepEqual(modelo.docs.map(d => d.id), ['a', 'b']);
});

test('se niega a sembrar si la colección ya tiene datos', async () => {
  const modelo = modeloFalso([{ id: 'existente' }]);

  await assert.rejects(
    sembrarNormativas(modelo, [{ id: 'nueva' }]),
    err => err instanceof ColeccionNoVaciaError && err.total === 1
  );
  assert.equal(modelo.llamadas.insertMany, 0);
  assert.equal(modelo.llamadas.deleteMany, 0);
  assert.deepEqual(modelo.docs, [{ id: 'existente' }]);
});

test('un segundo seed sobre la misma colección se rechaza', async () => {
  const modelo = modeloFalso();
  const normativas = cargarNormativas();

  await sembrarNormativas(modelo, normativas);
  await assert.rejects(sembrarNormativas(modelo, normativas), ColeccionNoVaciaError);
  assert.equal(modelo.docs.length, normativas.length);
});

test('carga las normativas del directorio de seed sin el esquema', () => {
  const normativas = cargarNormativas();
  const ids = normativas.map(n => n.id);

  assert.equal(normativas.length, 11);
  assert.equal(new Set(ids).size, ids.length, 'ids de normativa duplicados');
  assert.ok(normativas.every(n => typeof n.id === 'string' && Array.isArray(n.bloques)));
});
