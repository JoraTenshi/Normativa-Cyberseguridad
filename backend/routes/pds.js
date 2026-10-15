const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Resultado = require('../models/Resultado');
const { detalleResultado } = require('../services/resultadoLectura');
const { esBDNoDisponible } = require('../utils/bd');

const ETAPAS_ORIENTATIVAS = {
  1: 'Análisis de situación inicial',
  2: 'Análisis y evaluación de riesgos',
  3: 'Planificación de mejoras',
  4: 'Implantación de medidas',
  5: 'Monitorización y mejora continua'
};

router.get('/:resultadoId', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.resultadoId))
      return res.status(404).json({ ok: false, error: 'Evaluación no encontrada' });
    const resultado = await Resultado.findOne({ _id: req.params.resultadoId, usuario: req.user.id });
    if (!resultado) return res.status(404).json({ ok: false, error: 'Evaluación no encontrada' });

    const detalle = await detalleResultado(resultado);
    const idsRespondidos = new Set(detalle.respuestas.map(r => r.pregunta_id));
    const preguntasSinRespuesta = detalle.bloques.reduce(
      (total, bloque) => total + bloque.preguntas.filter(p => !idsRespondidos.has(p.id)).length, 0
    );
    const acciones = detalle.remediaciones.map(
      ({ pregunta_id, bloque_id, bloque, pregunta, nivel, fase_pds, remediacion, valor_actual, prioridad }) => ({
        pregunta_id, bloque_id, bloque,
        accion: remediacion ?? `Revisar y mejorar: ${pregunta}`,
        descripcion: pregunta,
        nivel, fase_pds, valor_actual, prioridad
      })
    );
    const usaEtapas = acciones.some(a => a.fase_pds != null);
    let plan;
    if (usaEtapas) {
      const porEtapa = new Map();
      acciones.forEach(a => {
        const fase = a.fase_pds ?? null;
        if (!porEtapa.has(fase)) porEtapa.set(fase, {
          fase,
          nombre: fase === null ? 'Sin etapa asignada' : ETAPAS_ORIENTATIVAS[fase] ?? `Etapa ${fase}`,
          acciones: []
        });
        porEtapa.get(fase).acciones.push(a);
      });
      plan = [...porEtapa.values()].sort((a, b) => (a.fase ?? Infinity) - (b.fase ?? Infinity));
    } else {
      plan = [{ fase: null, nombre: 'Acciones de mejora', acciones }];
    }
    res.json({ ok: true, data: {
      resultado_id: resultado._id,
      normativa: detalle.normativa,
      normativa_nombre: detalle.normativa_nombre,
      algoritmo_version: detalle.algoritmo_version,
      porcentaje_exacto: detalle.porcentaje_exacto,
      sin_base_evaluable: detalle.sin_base_evaluable,
      porcentaje: detalle.porcentaje,
      nivel: detalle.nivel,
      total_acciones: acciones.length,
      preguntas_sin_respuesta: preguntasSinRespuesta,
      origen_catalogo: detalle.origen_catalogo,
      acciones_guardadas: detalle.acciones_guardadas,
      usa_etapas: usaEtapas,
      plan
    } });
  } catch (err) {
    if (esBDNoDisponible(err)) return res.status(503).json({ ok: false, error: 'Servicio no disponible temporalmente' });
    console.error('Error al preparar propuesta de acciones:', err.message);
    res.status(500).json({ ok: false, error: 'Error interno al preparar la propuesta de acciones' });
  }
});

module.exports = router;
