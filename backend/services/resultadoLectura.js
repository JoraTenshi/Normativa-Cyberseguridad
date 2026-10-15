const Normativa = require('../models/Normativa');
const { construirRemediaciones, getNivelResultado } = require('../utils/scoring');

// Las dos variantes v2 desplegadas se leen sin migración destructiva.
// Ausente no equivale a []: un snapshot vacío también es un resultado guardado.
function resumenResultado(resultado) {
  const version = resultado.algoritmo_version ?? '1';
  return {
    id: resultado._id,
    normativa: resultado.normativa,
    normativa_nombre: resultado.normativa_nombre ?? resultado.normativa_snapshot?.nombre ?? resultado.normativa,
    algoritmo_version: version,
    porcentaje_exacto: resultado.porcentaje_exacto ?? null,
    sin_base_evaluable: resultado.sin_base_evaluable ?? (version === '2' && resultado.porcentaje == null),
    porcentaje: resultado.porcentaje ?? null,
    nivel: resultado.nivel ?? getNivelResultado(resultado),
    ...(version === '1' ? {
      puntuacion_total: resultado.puntuacion_total,
      puntuacion_maxima: resultado.puntuacion_maxima
    } : {}),
    createdAt: resultado.createdAt
  };
}

async function detalleResultado(resultado) {
  let normativa = resultado.normativa_snapshot;
  let origen_catalogo = 'instantanea';
  if (!normativa && resultado.cuestionario != null) {
    normativa = { nombre: resultado.normativa_nombre, bloques: resultado.cuestionario };
  }
  if (!normativa) {
    origen_catalogo = 'catalogo_actual';
    normativa = await Normativa.findOne({ id: resultado.normativa });
    if (!normativa) origen_catalogo = 'no_disponible';
  }
  const respuestas = resultado.respuestas ?? [];
  // El esquema anterior de Kali guardaba puntuaciones_bloques: [] por defecto,
  // aunque el desglose v2 real estuviera en bloques. Ese vacío no debe ocultarlo.
  const puntuaciones = resultado.puntuaciones_bloques?.length
    ? resultado.puntuaciones_bloques
    : resultado.bloques ?? resultado.puntuaciones_bloques ?? [];
  const remediacionesGuardadas = resultado.remediaciones ?? resultado.remediaciones_snapshot;
  return {
    ...resumenResultado(resultado),
    normativa_nombre: resultado.normativa_nombre ?? normativa?.nombre ?? resultado.normativa,
    puntuaciones_bloques: puntuaciones,
    indice_bloques: resultado.algoritmo_version === '2' ? puntuaciones : [],
    respuestas,
    bloques: normativa?.bloques ?? [],
    remediaciones: remediacionesGuardadas ??
      (normativa ? construirRemediaciones(normativa, respuestas) : []),
    // No recalcular una estimación histórica usando un catálogo que ha cambiado.
    cobertura_estimada: resultado.cobertura_estimada ?? [],
    cobertura_guardada: resultado.cobertura_estimada != null,
    acciones_guardadas: remediacionesGuardadas != null,
    origen_catalogo
  };
}

module.exports = { resumenResultado, detalleResultado };
