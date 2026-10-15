const test = require('node:test');
const assert = require('node:assert/strict');
const Resultado = require('../models/Resultado');
const { cargarNormativas } = require('../seed/seed');
const { crearSnapshotNormativa } = require('../utils/normativaSnapshot');
const { construirRemediaciones } = require('../utils/scoring');

test('el modelo conserva el índice exacto y el desglose de un resultado v2', () => {
  const resultado = new Resultado({
    normativa: 'fixture',
    normativa_nombre: 'Normativa original',
    normativa_snapshot: {
      version: 1, id: 'fixture', nombre: 'Normativa original',
      bloques: [{ id: 'A', nombre: 'Bloque A', peso_bloque: 80, temas: [],
        preguntas: [{ id: 'a1', texto: 'Pregunta original', peso: 1,
          remediacion: 'Mejorar A', fase_pds: 1 }] }]
    },
    remediaciones_snapshot: [{
      pregunta_id: 'a1', bloque_id: 'A', bloque: 'Bloque A', pregunta: 'Pregunta original',
      remediacion: 'Mejorar A', fase_pds: 1, valor_actual: 0.5, prioridad: 0.5
    }],
    respuestas: [{ pregunta_id: 'a1', valor: 0.5 }],
    algoritmo_version: '2',
    sin_base_evaluable: false,
    porcentaje_exacto: 47.5,
    porcentaje: 48,
    bloques: [{
      bloque_id: 'A', nombre: 'Bloque A', peso_bloque: 80,
      puntuacion: 0.5, max_puntuacion: 1, evaluable: true,
      porcentaje_exacto: 50
    }]
  });

  assert.equal(resultado.validateSync(), undefined);
  const guardable = resultado.toObject();
  assert.equal(guardable.algoritmo_version, '2');
  assert.equal(guardable.porcentaje_exacto, 47.5);
  assert.equal(guardable.bloques[0].peso_bloque, 80);
  assert.equal(guardable.bloques[0].porcentaje_exacto, 50);
  assert.equal(guardable.normativa_snapshot.bloques[0].preguntas[0].texto, 'Pregunta original');
  assert.equal(guardable.remediaciones_snapshot[0].remediacion, 'Mejorar A');
});

test('el modelo no asigna v2 a los resultados anteriores', () => {
  const antiguo = new Resultado({
    normativa: 'fixture',
    puntuacion_total: 1,
    puntuacion_maxima: 5,
    porcentaje: 20,
    puntuaciones_bloques: [{
      bloque_id: 'A', nombre: 'Bloque A', porcentaje: 100,
      puntuacion: 1, max_puntuacion: 1
    }]
  }).toObject();

  assert.equal(antiguo.algoritmo_version, undefined);
  assert.equal(antiguo.bloques, undefined);
  assert.equal(antiguo.normativa_snapshot, undefined);
  assert.equal(antiguo.remediaciones_snapshot, undefined);
  assert.equal(antiguo.porcentaje, 20);
  assert.equal(antiguo.puntuaciones_bloques[0].porcentaje, 100);
});

test('las instantáneas de los once catálogos reales son guardables', () => {
  for (const normativa of cargarNormativas()) {
    const respuestas = normativa.bloques.flatMap(bloque =>
      bloque.preguntas.map(pregunta => ({ pregunta_id: pregunta.id, valor: 0 }))
    );
    const resultado = new Resultado({
      normativa: normativa.id,
      normativa_nombre: normativa.nombre,
      respuestas,
      normativa_snapshot: crearSnapshotNormativa(normativa),
      remediaciones_snapshot: construirRemediaciones(normativa, respuestas)
    });

    assert.equal(resultado.validateSync(), undefined, normativa.id);
    assert.equal(resultado.normativa_snapshot.bloques.length, normativa.bloques.length, normativa.id);
  }
});
test('el snapshot conserva referencias y una huella estable que cambia con el contenido', () => {
  const norma = cargarNormativas()[0];
  const a = crearSnapshotNormativa(norma);
  const b = crearSnapshotNormativa(norma);
  assert.equal(a.huella_sha256, b.huella_sha256);
  assert.match(a.huella_sha256, /^[0-9a-f]{64}$/);
  const doc = new Resultado({ normativa: norma.id, normativa_snapshot: a }).toObject();
  assert.equal(doc.normativa_snapshot.referencia_oficial, a.referencia_oficial);
  assert.equal(doc.normativa_snapshot.bloques[0].preguntas[0].referencia_articulo, a.bloques[0].preguntas[0].referencia_articulo);
  const modificada = structuredClone(norma);
  modificada.bloques[0].preguntas[0].texto += ' modificado';
  assert.notEqual(crearSnapshotNormativa(modificada).huella_sha256, a.huella_sha256);
});
