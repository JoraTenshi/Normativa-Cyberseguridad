const express = require('express');
const router = express.Router();
const Normativa = require('../models/Normativa');

router.get('/', async (req, res) => {
  try {
    const normativas = await Normativa.find({}, { id: 1, nombre: 1, descripcion: 1, _id: 0 });
    res.json({ ok: true, data: normativas });
  } catch (err) {
    console.error('Error al obtener normativas:', err.message);
    res.status(500).json({ ok: false, error: 'Error al obtener las normativas' });
  }
});

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
