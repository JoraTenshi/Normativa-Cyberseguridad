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
  return NIVELES.find((n) => porcentajeExacto >= n.min).nivel;
}

function comprobarCatalogo(normativa) {
  for (const b of normativa.bloques) {
    if (typeof b.peso_bloque !== 'number' || !Number.isFinite(b.peso_bloque) || b.peso_bloque < 0) {
      throw new Error(`CATALOGO_INVALIDO: peso_bloque de ${b.id}`);
    }
    for (const p of b.preguntas) {
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
  const mapa = {};
  respuestas.forEach(r => { mapa[r.pregunta_id] = r.valor; });

  const items = [];
  normativa.bloques.forEach(bloque => {
    bloque.preguntas.forEach(pregunta => {
      const valor = mapa[pregunta.id] ?? 0;
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

function calcularCoberturaEstimada(normativaActual, puntuacionesBloques, otrasNormativas) {
  const mapaBloquesActual = new Map(
    normativaActual.bloques.map(b => [b.id, b])
  );

  const perfilAcumulado = {};
  for (const pb of puntuacionesBloques) {
    const bloqueDef = mapaBloquesActual.get(pb.bloque_id);
    if (!bloqueDef || !bloqueDef.temas || bloqueDef.temas.length === 0) continue;
    for (const tema of bloqueDef.temas) {
      if (!perfilAcumulado[tema]) perfilAcumulado[tema] = { suma: 0, peso: 0 };
      perfilAcumulado[tema].suma += pb.porcentaje * pb.max_puntuacion;
      perfilAcumulado[tema].peso += pb.max_puntuacion;
    }
  }

  const perfilTematico = {};
  for (const [tema, { suma, peso }] of Object.entries(perfilAcumulado)) {
    perfilTematico[tema] = peso > 0 ? suma / peso : null;
  }

  if (Object.keys(perfilTematico).length === 0) return [];

  return otrasNormativas.map(norm => {
    const bloquesEstimados = norm.bloques.map(bloque => {
      const temasBloque = bloque.temas ?? [];
      const valores = temasBloque
        .map(t => perfilTematico[t])
        .filter(v => v !== undefined && v !== null);

      if (valores.length === 0) {
        return {
          bloque_id:           bloque.id,
          nombre:              bloque.nombre,
          porcentaje_estimado: null
        };
      }

      const media = valores.reduce((s, v) => s + v, 0) / valores.length;
      return {
        bloque_id:           bloque.id,
        nombre:              bloque.nombre,
        porcentaje_estimado: Math.round(media)
      };
    });

    let sumaPond = 0;
    let pesoTotal = 0;
    let bloquesConDato = 0;
    for (const be of bloquesEstimados) {
      if (be.porcentaje_estimado === null) continue;
      const bloqueDef = norm.bloques.find(b => b.id === be.bloque_id);
      const pesoBloque = bloqueDef.preguntas.reduce((s, p) => s + p.peso, 0);
      sumaPond += be.porcentaje_estimado * pesoBloque;
      pesoTotal += pesoBloque;
      bloquesConDato++;
    }

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
  calcularIndice, getNivel, ALGORITMO_VERSION, NIVELES,
  construirRemediaciones, calcularCoberturaEstimada
};
