'use strict';
const { createHash } = require('node:crypto');

// Copia solo los datos que historial y propuesta de acciones necesitan reproducir.
function crearSnapshotNormativa(normativa) {
  const snapshot = {
    version: 1,
    id: normativa.id,
    nombre: normativa.nombre,
    referencia_oficial: normativa.referencia_oficial ?? null,
    fecha_aplicabilidad_general: normativa.fecha_aplicabilidad_general ?? null,
    bloques: normativa.bloques.map(bloque => ({
      id: bloque.id,
      nombre: bloque.nombre,
      descripcion: bloque.descripcion ?? null,
      fecha_aplicabilidad: bloque.fecha_aplicabilidad ?? null,
      seccion_normativa: bloque.seccion_normativa ?? null,
      peso_bloque: bloque.peso_bloque ?? null,
      temas: [...(bloque.temas ?? [])],
      preguntas: bloque.preguntas.map(pregunta => ({
        id: pregunta.id,
        texto: pregunta.texto,
        peso: pregunta.peso,
        nivel: pregunta.nivel ?? null,
        fase_pds: pregunta.fase_pds ?? null,
        remediacion: pregunta.remediacion ?? null,
        ayuda: pregunta.ayuda ?? null,
        requisito_original: pregunta.requisito_original ?? null,
        referencia_articulo: pregunta.referencia_articulo ?? null,
        tipo: pregunta.tipo ?? null,
        aplicabilidad: [...(pregunta.aplicabilidad ?? [])]
      }))
    }))
  };
  // Identifica exactamente esta copia; no equivale a una publicación aprobada del catálogo.
  snapshot.huella_sha256 = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  return snapshot;
}

module.exports = { crearSnapshotNormativa };
