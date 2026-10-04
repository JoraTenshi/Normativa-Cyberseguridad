const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Resultado = require('../models/Resultado');

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

    const acciones = resultado.remediaciones.map(
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
      const porFase = new Map();
      acciones.forEach(a => {
        const fase = a.fase_pds ?? null;
        if (!porFase.has(fase)) {
          const nombre = fase === null ? 'Sin fase asignada' : (FASES[fase] ?? `Fase ${fase}`);
          porFase.set(fase, { fase, nombre, acciones: [] });
        }
        porFase.get(fase).acciones.push(a);
      });
      // Fases en orden; las acciones sin fase van al final en su propio grupo, sin inventar una.
      plan = [...porFase.values()].sort((a, b) => (a.fase ?? Infinity) - (b.fase ?? Infinity));
    } else {
      plan = [{ fase: null, nombre: 'Acciones de mejora', acciones }];
    }

    res.json({
      ok: true,
      data: {
        resultado_id:     resultado._id,
        normativa:        resultado.normativa,
        normativa_nombre: resultado.normativa_nombre,
        porcentaje:       resultado.porcentaje,
        nivel:            resultado.nivel,
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
