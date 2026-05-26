const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Usuario = require('../models/Usuario');
const Resultado = require('../models/Resultado');
const Normativa = require('../models/Normativa');
const { construirRemediaciones, getNivel, calcularCoberturaEstimada } = require('../utils/scoring');

const SECTORES_VALIDOS = ['publica', 'sanitaria', 'energia', 'transporte', 'financiero', 'educacion', 'privada', 'otro'];
const TAMANOS_VALIDOS  = ['micro', 'pequena', 'mediana', 'grande'];

router.get('/', requireAuth, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id, { password: 0, __v: 0, loginAttempts: 0, lockUntil: 0 });
    if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    res.json({ ok: true, data: usuario });
  } catch (err) {
    console.error('Error al obtener perfil:', err.message);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.put('/organizacion', requireAuth, async (req, res) => {
  try {
    const { sector, tamano, tipo_actividad } = req.body;

    if (sector !== undefined && !SECTORES_VALIDOS.includes(sector))
      return res.status(400).json({ ok: false, error: `Sector no válido. Valores aceptados: ${SECTORES_VALIDOS.join(', ')}` });
    if (tamano !== undefined && !TAMANOS_VALIDOS.includes(tamano))
      return res.status(400).json({ ok: false, error: `Tamaño no válido. Valores aceptados: ${TAMANOS_VALIDOS.join(', ')}` });

    const update = {};
    if (sector !== undefined)         update['organizacion.sector']        = sector;
    if (tamano !== undefined)         update['organizacion.tamano']        = tamano;
    if (tipo_actividad !== undefined) update['organizacion.tipo_actividad'] =
      typeof tipo_actividad === 'string' ? tipo_actividad.trim().slice(0, 200) || null : null;

    const usuario = await Usuario.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, projection: { password: 0, __v: 0, loginAttempts: 0, lockUntil: 0 } }
    );
    if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    res.json({ ok: true, data: usuario });
  } catch (err) {
    console.error('Error al actualizar perfil de organización:', err.message);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.get('/historial', requireAuth, async (req, res) => {
  try {
    const resultados = await Resultado
      .find({ usuario: req.user.id }, { respuestas: 0, __v: 0 })
      .sort({ createdAt: -1 });

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
    const remediaciones = norm ? construirRemediaciones(norm, resultado.respuestas) : [];

    const otrasNormativas = norm
      ? await Normativa.find({ id: { $ne: resultado.normativa } })
      : [];
    const cobertura_estimada = norm
      ? calcularCoberturaEstimada(norm, resultado.puntuaciones_bloques ?? [], otrasNormativas)
      : [];

    res.json({
      ok: true,
      data: {
        id:                   resultado._id,
        normativa:            resultado.normativa,
        normativa_nombre:     norm?.nombre ?? resultado.normativa,
        porcentaje:           resultado.porcentaje,
        puntuacion_total:     resultado.puntuacion_total,
        puntuacion_maxima:    resultado.puntuacion_maxima,
        nivel:                getNivel(resultado.porcentaje),
        puntuaciones_bloques: resultado.puntuaciones_bloques ?? [],
        respuestas:           resultado.respuestas ?? [],
        bloques:              norm?.bloques ?? [],
        remediaciones,
        cobertura_estimada,
        createdAt:            resultado.createdAt
      }
    });
  } catch (err) {
    console.error('Error al obtener detalle de evaluación:', err.message);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

module.exports = router;
