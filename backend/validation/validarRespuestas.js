'use strict';

// Valida las respuestas de POST /resultado contra la normativa cargada,
// antes de calcular nada o crear un Resultado.
// Contrato actual: cuestionario completo, valores 0, 0.5 o 1.
// Si se aprueban preguntas condicionales, `idsElegibles` debe ser el
// conjunto efectivo calculado por el servidor, no todas las del JSON.

const VALORES_PERMITIDOS = new Set([0, 0.5, 1]);

function idsDeNormativa(normativa) {
  return new Set(normativa.bloques.flatMap((b) => b.preguntas.map((p) => p.id)));
}

function validarRespuestas(normativa, respuestas, idsElegibles = idsDeNormativa(normativa)) {
  if (!Array.isArray(respuestas)) {
    return { ok: false, code: 'RESPUESTA_INVALIDA', detalle: 'respuestas debe ser un array' };
  }

  const vistos = new Set();
  for (let i = 0; i < respuestas.length; i++) {
    const r = respuestas[i];
    if (!r || typeof r !== 'object' || Array.isArray(r)) {
      return { ok: false, code: 'RESPUESTA_INVALIDA', indice: i, detalle: 'no es un objeto' };
    }
    if (typeof r.pregunta_id !== 'string' || !idsElegibles.has(r.pregunta_id)) {
      return { ok: false, code: 'RESPUESTA_INVALIDA', indice: i, detalle: 'pregunta desconocida' };
    }
    if (vistos.has(r.pregunta_id)) {
      return { ok: false, code: 'RESPUESTA_DUPLICADA', indice: i, pregunta_id: r.pregunta_id };
    }
    if (!VALORES_PERMITIDOS.has(r.valor)) {
      return { ok: false, code: 'RESPUESTA_INVALIDA', indice: i, detalle: 'valor no permitido' };
    }
    vistos.add(r.pregunta_id);
  }

  if (vistos.size !== idsElegibles.size) {
    const faltan = [...idsElegibles].filter((id) => !vistos.has(id));
    return { ok: false, code: 'CUESTIONARIO_INCOMPLETO', faltan };
  }
  return { ok: true };
}

module.exports = { validarRespuestas, idsDeNormativa, VALORES_PERMITIDOS };
