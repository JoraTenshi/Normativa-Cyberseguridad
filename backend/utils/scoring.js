'use strict';

// Cálculo del índice de autoevaluación (algoritmo v2, ver docs/contrato-evaluacion.md),
// remediaciones y cobertura estimada. Funciones puras: sin Express ni Mongo.
// calcularIndice supone respuestas ya validadas con validarRespuestas().

const ALGORITMO_VERSION = '2';

// Umbrales sobre el valor EXACTO (sin redondear).
const NIVELES = [
  { min: 85, nivel: 'Alto' },
  { min: 60, nivel: 'Medio' },
  { min: 30, nivel: 'Bajo' },
  { min: 0,  nivel: 'Crítico' },
];

function getNivel(porcentajeExacto) {
  if (typeof porcentajeExacto !== 'number' || !Number.isFinite(porcentajeExacto)) return null;
  return NIVELES.find((n) => porcentajeExacto >= n.min)?.nivel ?? null;
}

function getNivelResultado(resultado) {
  const valor = resultado.algoritmo_version === '2'
    ? resultado.porcentaje_exacto
    : resultado.porcentaje;
  return getNivel(valor);
}

function comprobarCatalogo(normativa) {
  const idsBloque = new Set();
  const idsPregunta = new Set();
  for (const b of normativa.bloques) {
    if (typeof b.id !== 'string' || !b.id || idsBloque.has(b.id)) {
      throw new Error(`CATALOGO_INVALIDO: id de bloque duplicado o ausente: ${b.id}`);
    }
    idsBloque.add(b.id);
    if (typeof b.peso_bloque !== 'number' || !Number.isFinite(b.peso_bloque) || b.peso_bloque < 0) {
      throw new Error(`CATALOGO_INVALIDO: peso_bloque de ${b.id}`);
    }
    for (const p of b.preguntas) {
      if (typeof p.id !== 'string' || !p.id || idsPregunta.has(p.id)) {
        throw new Error(`CATALOGO_INVALIDO: id de pregunta duplicado o ausente: ${p.id}`);
      }
      idsPregunta.add(p.id);
      if (typeof p.peso !== 'number' || !Number.isFinite(p.peso) || p.peso <= 0) {
        throw new Error(`CATALOGO_INVALIDO: peso de ${p.id}`);
      }
    }
  }
}

function calcularIndice(normativa, respuestas) {
  comprobarCatalogo(normativa);
  const valores = new Map(respuestas.map((r) => [r.pregunta_id, r.valor]));

  const bloques = normativa.bloques.map((b) => {
    const maximo = b.preguntas.reduce((s, p) => s + p.peso, 0);
    const obtenido = b.preguntas.reduce((s, p) => s + (valores.get(p.id) ?? 0) * p.peso, 0);
    const evaluable = maximo > 0 && b.peso_bloque > 0;
    return {
      bloque_id: b.id,
      nombre: b.nombre,
      peso_bloque: b.peso_bloque,
      puntuacion: obtenido,
      max_puntuacion: maximo,
      evaluable,
      porcentaje_exacto: maximo > 0 ? (100 * obtenido) / maximo : null,
    };
  });

  const activos = bloques.filter((b) => b.evaluable);
  const sumaPesos = activos.reduce((s, b) => s + b.peso_bloque, 0);

  if (sumaPesos === 0) {
    return {
      algoritmo_version: ALGORITMO_VERSION,
      sin_base_evaluable: true,
      porcentaje_exacto: null,
      porcentaje: null,
      nivel: null,
      bloques,
    };
  }

  const exacto = activos.reduce((s, b) => s + b.porcentaje_exacto * b.peso_bloque, 0) / sumaPesos;
  return {
    algoritmo_version: ALGORITMO_VERSION,
    sin_base_evaluable: false,
    porcentaje_exacto: exacto,
    porcentaje: Math.round(exacto),
    nivel: getNivel(exacto),
    bloques,
  };
}

function construirRemediaciones(normativa, respuestas) {
  const valores = new Map(respuestas.map(r => [r.pregunta_id, r.valor]));

  const items = [];
  normativa.bloques.forEach(bloque => {
    bloque.preguntas.forEach(pregunta => {
      // Un catálogo posterior puede contener preguntas ausentes en un resultado histórico.
      if (!valores.has(pregunta.id)) return;
      const valor = valores.get(pregunta.id);
      if (valor < 1) {
        const gap = pregunta.peso * (1 - valor);
        items.push({
          pregunta_id:  pregunta.id,
          bloque_id:    bloque.id,
          bloque:       bloque.nombre,
          pregunta:     pregunta.texto,
          nivel:        pregunta.nivel ?? null,
          fase_pds:     pregunta.fase_pds ?? null,
          remediacion:  pregunta.remediacion ?? null,
          valor_actual: valor,
          prioridad:    Math.round(gap * 100) / 100
        });
      }
    });
  });

  return items.sort((a, b) => b.prioridad - a.prioridad);
}

// Proyección temática: estima el índice en otras normativas a partir de los temas de los bloques
// contestados. Igual que calcularIndice, pondera los bloques por peso_bloque (no por la suma de
// pesos de sus preguntas) y redondea solo al final.
function calcularCoberturaEstimada(normativaActual, puntuacionesBloques, otrasNormativas) {
  const mapaBloquesActual = new Map(
    normativaActual.bloques.map(b => [b.id, b])
  );

  const perfilAcumulado = {};
  for (const pb of puntuacionesBloques) {
    const bloqueDef = mapaBloquesActual.get(pb.bloque_id);
    const porcentajeBloque = pb.porcentaje_exacto ?? pb.porcentaje;
    if (!bloqueDef || !bloqueDef.temas || bloqueDef.temas.length === 0 ||
        pb.evaluable === false || !Number.isFinite(porcentajeBloque) ||
        !Number.isFinite(bloqueDef.peso_bloque) || bloqueDef.peso_bloque <= 0) continue;
    for (const tema of bloqueDef.temas) {
      if (!perfilAcumulado[tema]) perfilAcumulado[tema] = { suma: 0, peso: 0 };
      perfilAcumulado[tema].suma += porcentajeBloque * bloqueDef.peso_bloque;
      perfilAcumulado[tema].peso += bloqueDef.peso_bloque;
    }
  }

  const perfilTematico = {};
  for (const [tema, { suma, peso }] of Object.entries(perfilAcumulado)) {
    perfilTematico[tema] = suma / peso;
  }

  if (Object.keys(perfilTematico).length === 0) return [];

  return otrasNormativas.map(norm => {
    let sumaPond = 0;
    let pesoTotal = 0;
    let bloquesConDato = 0;

    const bloquesEstimados = norm.bloques.map(bloque => {
      const valores = (bloque.temas ?? [])
        .map(t => perfilTematico[t])
        .filter(v => v !== undefined);

      if (valores.length === 0) {
        return { bloque_id: bloque.id, nombre: bloque.nombre, porcentaje_estimado: null };
      }

      const media = valores.reduce((s, v) => s + v, 0) / valores.length;
      bloquesConDato++;
      if (Number.isFinite(bloque.peso_bloque) && bloque.peso_bloque > 0) {
        sumaPond  += media * bloque.peso_bloque;
        pesoTotal += bloque.peso_bloque;
      }
      return { bloque_id: bloque.id, nombre: bloque.nombre, porcentaje_estimado: Math.round(media) };
    });

    const porcentajeEstimado = pesoTotal > 0 ? Math.round(sumaPond / pesoTotal) : null;
    const coberturaTematica = norm.bloques.length > 0
      ? Math.round((bloquesConDato / norm.bloques.length) * 100) / 100
      : 0;

    return {
      normativa_id:        norm.id,
      normativa_nombre:    norm.nombre,
      porcentaje_estimado: porcentajeEstimado,
      cobertura_tematica:  coberturaTematica,
      bloques_estimados:   bloquesEstimados,
      tipo:                'estimado'
    };
  });
}

module.exports = {
  calcularIndice, getNivel, getNivelResultado, ALGORITMO_VERSION, NIVELES,
  construirRemediaciones, calcularCoberturaEstimada
};
