const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Resultado = require('../models/Resultado');
const Normativa = require('../models/Normativa');

const FASES = {
  1: 'Situación Actual',
  2: 'Sistema de Gestión de Seguridad',
  3: 'Normativa y Procedimientos',
  4: 'Formación y Concienciación',
  5: 'Servicios Externos y Mejora Continua'
};

router.get('/:resultadoId', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.resultadoId))
      return res.status(404).json({ ok: false, error: 'Evaluación no encontrada' });

    const resultado = await Resultado.findOne(
      { _id: req.params.resultadoId, usuario: req.user.id }
    );
    if (!resultado) return res.status(404).json({ ok: false, error: 'Evaluación no encontrada' });

    const normativa = await Normativa.findOne({ id: resultado.normativa });
    if (!normativa) return res.status(404).json({ ok: false, error: 'Normativa no encontrada' });

    const mapa = {};
    resultado.respuestas.forEach(r => { mapa[r.pregunta_id] = r.valor; });

    const acciones = [];
    normativa.bloques.forEach(bloque => {
      bloque.preguntas.forEach(pregunta => {
        const valor = mapa[pregunta.id] ?? 0;
        if (valor < 1) {
          acciones.push({
            pregunta_id:  pregunta.id,
            bloque_id:    bloque.id,
            bloque:       bloque.nombre,
            accion:       pregunta.remediacion ?? `Revisar y mejorar: ${pregunta.texto}`,
            descripcion:  pregunta.texto,
            nivel:        pregunta.nivel ?? null,
            fase_pds:     pregunta.fase_pds ?? null,
            valor_actual: valor,
            prioridad:    Math.round(pregunta.peso * (1 - valor) * 100) / 100
          });
        }
      });
    });

    acciones.sort((a, b) => b.prioridad - a.prioridad);

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
        resultado_id:    resultado._id,
        normativa:       resultado.normativa,
        normativa_nombre: normativa.nombre,
        porcentaje:      resultado.porcentaje,
        nivel:           getNivel(resultado.porcentaje),
        total_acciones:  acciones.length,
        usa_fases_incibe: usaFases,
        plan
      }
    });
  } catch (err) {
    console.error('Error al generar PDS:', err.message);
    res.status(500).json({ ok: false, error: 'Error interno al generar el PDS' });
  }
});

function getNivel(porcentaje) {
  if (porcentaje >= 85) return 'Alto';
  if (porcentaje >= 60) return 'Medio';
  if (porcentaje >= 30) return 'Bajo';
  return 'Crítico';
}

module.exports = router;
