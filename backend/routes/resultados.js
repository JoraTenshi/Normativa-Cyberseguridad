const express = require('express');
const router = express.Router();
const Normativa = require('../models/Normativa');
const Resultado = require('../models/Resultado');
const { optionalAuth } = require('../middleware/auth');
const { construirRemediaciones, getNivel, calcularCoberturaEstimada } = require('../utils/scoring');

const MAX_RESPUESTAS  = 500;
const VALORES_VALIDOS = [0, 0.5, 1];

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { normativa: normativaId, respuestas } = req.body;

    if (typeof normativaId !== 'string' || normativaId.trim() === '') {
      return res.status(400).json({ ok: false, error: 'El campo "normativa" debe ser un string no vacío' });
    }
    if (!Array.isArray(respuestas) || respuestas.length === 0) {
      return res.status(400).json({ ok: false, error: 'El campo "respuestas" debe ser un array no vacío' });
    }
    if (respuestas.length > MAX_RESPUESTAS) {
      return res.status(400).json({ ok: false, error: `El número de respuestas no puede superar ${MAX_RESPUESTAS}` });
    }

    for (const r of respuestas) {
      if (typeof r.pregunta_id !== 'string' || r.pregunta_id.trim() === '') {
        return res.status(400).json({ ok: false, error: 'Cada respuesta debe tener "pregunta_id" como string no vacío' });
      }
      if (!VALORES_VALIDOS.includes(r.valor)) {
        return res.status(400).json({ ok: false, error: 'Los valores de respuesta solo pueden ser 0, 0.5 o 1' });
      }
    }

    const normativaIdClean = normativaId.trim();

    const normativa = await Normativa.findOne({ id: normativaIdClean });
    if (!normativa) {
      return res.status(404).json({ ok: false, error: 'Normativa no encontrada' });
    }

    const otrasNormativas = await Normativa.find({ id: { $ne: normativaIdClean } });

    const { puntuacion_total, puntuacion_maxima, porcentaje, puntuaciones_bloques } = calcularPorcentaje(normativa, respuestas);

    let resultadoId = null;
    if (req.user) {
      const resultado = await Resultado.create({
        usuario:   req.user.id,
        normativa: normativaIdClean,
        respuestas,
        puntuacion_total,
        puntuacion_maxima,
        porcentaje,
        puntuaciones_bloques
      });
      resultadoId = resultado._id;
    }

    const remediaciones = construirRemediaciones(normativa, respuestas);
    const cobertura_estimada = calcularCoberturaEstimada(normativa, puntuaciones_bloques, otrasNormativas);

    res.status(201).json({
      ok: true,
      data: {
        id:                  resultadoId,
        normativa:           normativaIdClean,
        normativa_nombre:    normativa.nombre,
        puntuacion_total,
        puntuacion_maxima,
        porcentaje,
        nivel:               getNivel(porcentaje),
        mensaje:             getMensajeNivel(porcentaje),
        puntuaciones_bloques,
        remediaciones,
        cobertura_estimada
      }
    });

  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error interno al procesar el resultado' });
  }
});

function calcularPorcentaje(normativa, respuestas) {
  const mapa = {};
  respuestas.forEach(r => { mapa[r.pregunta_id] = r.valor; });

  let puntuacion_total = 0;
  let puntuacion_maxima = 0;
  const puntuaciones_bloques = [];

  normativa.bloques.forEach(bloque => {
    let bloque_total = 0;
    let bloque_max   = 0;

    bloque.preguntas.forEach(pregunta => {
      bloque_max   += pregunta.peso;
      bloque_total += (mapa[pregunta.id] ?? 0) * pregunta.peso;
    });

    puntuacion_maxima += bloque_max;
    puntuacion_total  += bloque_total;

    puntuaciones_bloques.push({
      bloque_id:      bloque.id,
      nombre:         bloque.nombre,
      puntuacion:     bloque_total,
      max_puntuacion: bloque_max,
      porcentaje:     bloque_max > 0 ? Math.round((bloque_total / bloque_max) * 100) : 0
    });
  });

  const porcentaje = puntuacion_maxima > 0
    ? Math.round((puntuacion_total / puntuacion_maxima) * 100)
    : 0;

  return { puntuacion_total, puntuacion_maxima, porcentaje, puntuaciones_bloques };
}

function getMensajeNivel(porcentaje) {
  if (porcentaje >= 85) return 'Nivel alto de cumplimiento. Excelente postura de seguridad.';
  if (porcentaje >= 60) return 'Nivel medio de cumplimiento. Se requieren mejoras en algunas áreas.';
  if (porcentaje >= 30) return 'Nivel bajo de cumplimiento. Existen brechas significativas de seguridad.';
  return 'Nivel crítico. Se requiere una revisión urgente de las políticas de seguridad.';
}

module.exports = router;
