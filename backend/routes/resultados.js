const express = require('express');
const router = express.Router();
const Normativa = require('../models/Normativa');
const Resultado = require('../models/Resultado');
const { optionalAuth } = require('../middleware/auth');
const { calcularIndice, construirRemediaciones, calcularCoberturaEstimada } = require('../utils/scoring');
const { crearSnapshotNormativa } = require('../utils/normativaSnapshot');
const { validarRespuestas } = require('../validation/validarRespuestas');
const { esBDNoDisponible } = require('../utils/bd');

const MAX_RESPUESTAS = 500;
const MENSAJES_NIVEL = {
  Alto: 'Índice de autoevaluación alto. Mantén y revisa las medidas existentes.',
  Medio: 'Índice de autoevaluación medio. Hay áreas que conviene mejorar.',
  Bajo: 'Índice de autoevaluación bajo. Prioriza las mejoras pendientes.',
  Crítico: 'Índice de autoevaluación crítico. Revisa con urgencia las medidas pendientes.'
};
const MENSAJES_VALIDACION = {
  RESPUESTA_INVALIDA: 'Respuesta inválida: cada respuesta debe ser un objeto con una pregunta de esta normativa y un valor 0, 0.5 o 1',
  RESPUESTA_DUPLICADA: 'Hay más de una respuesta para la misma pregunta',
  CUESTIONARIO_INCOMPLETO: 'Faltan preguntas por responder'
};

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { normativa: normativaId, respuestas } = req.body ?? {};
    if (typeof normativaId !== 'string' || normativaId.trim() === '') {
      return res.status(400).json({ ok: false, error: 'El campo "normativa" debe ser un string no vacío' });
    }
    if (!Array.isArray(respuestas) || respuestas.length === 0) {
      return res.status(400).json({ ok: false, error: 'El campo "respuestas" debe ser un array no vacío' });
    }
    if (respuestas.length > MAX_RESPUESTAS) {
      return res.status(400).json({ ok: false, error: `El número de respuestas no puede superar ${MAX_RESPUESTAS}` });
    }

    const normativaIdClean = normativaId.trim();
    const normativa = await Normativa.findOne({ id: normativaIdClean });
    if (!normativa) return res.status(404).json({ ok: false, error: 'Normativa no encontrada' });
    const validacion = validarRespuestas(normativa, respuestas);
    if (!validacion.ok) {
      const { ok: _ok, code, ...detalle } = validacion;
      return res.status(400).json({ ok: false, code, error: MENSAJES_VALIDACION[code] ?? code, ...detalle });
    }

    const indice = calcularIndice(normativa, respuestas);
    const puntuaciones_bloques = indice.bloques.map(b => ({
      ...b,
      porcentaje: b.porcentaje_exacto == null ? null : Math.round(b.porcentaje_exacto)
    }));
    const remediaciones = construirRemediaciones(normativa, respuestas);
    const otrasNormativas = await Normativa.find({ id: { $ne: normativaIdClean } });
    const cobertura_estimada = calcularCoberturaEstimada(normativa, puntuaciones_bloques, otrasNormativas);
    let resultadoId = null;
    if (req.user) {
      const resultado = await Resultado.create({
        usuario: req.user.id,
        normativa: normativaIdClean,
        normativa_nombre: normativa.nombre,
        normativa_snapshot: crearSnapshotNormativa(normativa),
        respuestas,
        algoritmo_version: indice.algoritmo_version,
        sin_base_evaluable: indice.sin_base_evaluable,
        porcentaje_exacto: indice.porcentaje_exacto,
        porcentaje: indice.porcentaje,
        nivel: indice.nivel,
        puntuaciones_bloques,
        remediaciones,
        cobertura_estimada
      });
      resultadoId = resultado._id;
    }

    res.status(201).json({
      ok: true,
      data: {
        id: resultadoId,
        normativa: normativaIdClean,
        normativa_nombre: normativa.nombre,
        algoritmo_version: indice.algoritmo_version,
        sin_base_evaluable: indice.sin_base_evaluable,
        porcentaje_exacto: indice.porcentaje_exacto,
        porcentaje: indice.porcentaje,
        nivel: indice.nivel,
        mensaje: MENSAJES_NIVEL[indice.nivel] ?? 'No hay bloques evaluables para calcular un índice.',
        puntuaciones_bloques,
        remediaciones,
        cobertura_estimada
      }
    });
  } catch (err) {
    if (esBDNoDisponible(err)) {
      return res.status(503).json({ ok: false, error: 'Servicio no disponible temporalmente' });
    }
    res.status(500).json({ ok: false, error: 'Error interno al procesar el resultado' });
  }
});

module.exports = router;
