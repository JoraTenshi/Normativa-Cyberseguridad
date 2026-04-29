const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Usuario = require('../models/Usuario');
const Resultado = require('../models/Resultado');
const Normativa = require('../models/Normativa');

// GET /me — profile of the authenticated user
router.get('/', requireAuth, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id, { password: 0, __v: 0 });
    if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    res.json({ ok: true, data: usuario });
  } catch (err) {
    console.error('Error al obtener perfil:', err.message);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

// GET /me/historial — full history list (no respuestas, suitable for charts)
router.get('/historial', requireAuth, async (req, res) => {
  try {
    const resultados = await Resultado
      .find({ usuario: req.user.id }, { respuestas: 0, __v: 0 })
      .sort({ createdAt: -1 });

    // Fetch normativa names in one pass (cache by id)
    const normativaIds = [...new Set(resultados.map(r => r.normativa))];
    const normativas = await Normativa.find({ id: { $in: normativaIds } }, { id: 1, nombre: 1 });
    const nombrePor = Object.fromEntries(normativas.map(n => [n.id, n.nombre]));

    const data = resultados.map(r => ({
      id:                r._id,
      normativa:         r.normativa,
      normativa_nombre:  nombrePor[r.normativa] ?? r.normativa,
      porcentaje:        r.porcentaje,
      puntuacion_total:  r.puntuacion_total,
      puntuacion_maxima: r.puntuacion_maxima,
      nivel:             getNivel(r.porcentaje),
      createdAt:         r.createdAt
    }));

    res.json({ ok: true, data });
  } catch (err) {
    console.error('Error al obtener historial:', err.message);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

// GET /me/historial/:resultadoId — single result with full respuestas detail
router.get('/historial/:resultadoId', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.resultadoId)) {
      return res.status(404).json({ ok: false, error: 'Evaluación no encontrada' });
    }

    const resultado = await Resultado.findOne(
      { _id: req.params.resultadoId, usuario: req.user.id },
      { __v: 0 }
    );
    if (!resultado) return res.status(404).json({ ok: false, error: 'Evaluación no encontrada' });

    const norm = await Normativa.findOne({ id: resultado.normativa }, { nombre: 1, bloques: 1, _id: 0 });

    res.json({
      ok: true,
      data: {
        id:                resultado._id,
        normativa:         resultado.normativa,
        normativa_nombre:  norm?.nombre ?? resultado.normativa,
        porcentaje:        resultado.porcentaje,
        puntuacion_total:  resultado.puntuacion_total,
        puntuacion_maxima: resultado.puntuacion_maxima,
        nivel:             getNivel(resultado.porcentaje),
        bloques:           norm?.bloques ?? [],
        respuestas:        resultado.respuestas,
        createdAt:         resultado.createdAt
      }
    });
  } catch (err) {
    console.error('Error al obtener detalle de evaluación:', err.message);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

function getNivel(porcentaje) {
  if (porcentaje >= 85) return 'Alto';
  if (porcentaje >= 60) return 'Medio';
  if (porcentaje >= 30) return 'Bajo';
  return 'Crítico';
}

module.exports = router;
