/**
 * routes/normativas.js
 * Rutas de la API para gestionar las normativas de ciberseguridad
 *
 * GET /normativas       → Lista todas las normativas disponibles
 * GET /normativas/:id   → Devuelve una normativa completa con sus bloques y preguntas
 */

const express = require('express');
const router = express.Router();
const Normativa = require('../models/Normativa');

/**
 * GET /normativas
 * Devuelve un listado resumido de todas las normativas disponibles
 * (sin los bloques de preguntas, para el selector inicial)
 */
router.get('/', async (req, res) => {
  try {
    // Seleccionamos solo id, nombre y descripción para el listado inicial
    const normativas = await Normativa.find({}, { id: 1, nombre: 1, descripcion: 1, _id: 0 });
    res.json({ ok: true, data: normativas });
  } catch (err) {
    console.error('Error al obtener normativas:', err.message);
    res.status(500).json({ ok: false, error: 'Error al obtener las normativas' });
  }
});

/**
 * GET /normativas/:id
 * Devuelve una normativa completa con todos sus bloques y preguntas
 * :id → identificador de la normativa (ej: "iso27001")
 */
router.get('/:id', async (req, res) => {
  try {
    const normativa = await Normativa.findOne({ id: req.params.id }, { _id: 0, __v: 0 });

    if (!normativa) {
      return res.status(404).json({ ok: false, error: 'Normativa no encontrada' });
    }

    res.json({ ok: true, data: normativa });
  } catch (err) {
    console.error('Error al obtener normativa:', err.message);
    res.status(500).json({ ok: false, error: 'Error al obtener la normativa' });
  }
});

module.exports = router;
