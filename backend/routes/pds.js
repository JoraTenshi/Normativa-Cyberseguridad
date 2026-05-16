const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Resultado = require('../models/Resultado');
const Normativa = require('../models/Normativa');
const { construirRemediaciones, getNivel } = require('../utils/scoring');

const FASES = {
  1: 'Análisis de situación inicial',
  2: 'Análisis y evaluación de riesgos',
  3: 'Definición del Plan Director',
  4: 'Implantación de medidas',
  5: 'Monitorización y mejora continua'
};

router.get('/:resultadoId', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.resultadoId))
      return res.status(404).json({ ok: false, error: 'Evaluación no encontrada' });

    const resultado = await Resultado.findOne({ _id: req.params.resultadoId, usuario: req.user.id });
    if (!resultado) return res.status(404).json({ ok: false, error: 'Evaluación no encontrada' });

    const normativa = await Normativa.findOne({ id: resultado.normativa });
    if (!normativa) return res.status(404).json({ ok: false, error: 'Normativa no encontrada' });

    const acciones = construirRemediaciones(normativa, resultado.respuestas).map(
      ({ pregunta_id, bloque_id, bloque, pregunta, nivel, fase_pds, remediacion, valor_actual, prioridad }) => ({
        pregunta_id, bloque_id, bloque,
        accion:      remediacion ?? `Revisar y mejorar: ${pregunta}`,
        descripcion: pregunta,
        nivel, fase_pds, valor_actual, prioridad
      })
    );

    const usaFases = acciones.some(a => a.fase_pds !== null);

    let plan;
    if (usaFases) {
      const porFase = {};
      acciones.forEach(a => {
        const fase = a.fase_pds ?? 2;
        if (!porFase[fase]) porFase[fase] = { fase, nombre: FASES[fase] ?? `Fase ${fase}`, acciones: [] };
        porFase[fase].acciones.push(a);
      });
      plan = Object.values(porFase).sort((a, b) => a.fase - b.fase);
    } else {
      plan = [{ fase: null, nombre: 'Acciones de mejora', acciones }];
    }

    res.json({
      ok: true,
      data: {
        resultado_id:     resultado._id,
        normativa:        resultado.normativa,
        normativa_nombre: normativa.nombre,
        porcentaje:       resultado.porcentaje,
        nivel:            getNivel(resultado.porcentaje),
        total_acciones:   acciones.length,
        usa_fases_incibe: usaFases,
        plan
      }
    });
  } catch (err) {
    console.error('Error al generar PDS:', err.message);
    res.status(500).json({ ok: false, error: 'Error interno al generar el PDS' });
  }
});

module.exports = router;
