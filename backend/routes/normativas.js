const express = require('express');
const router = express.Router();
const Normativa = require('../models/Normativa');
const Usuario = require('../models/Usuario');
const { requireAuth } = require('../middleware/auth');

router.get('/aplicables', requireAuth, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id, { organizacion: 1 });
    if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

    const sector = usuario.organizacion?.sector ?? null;

    const normativas = await Normativa.find({}, { id: 1, nombre: 1, descripcion: 1, sectores_aplicables: 1, _id: 0 });

    const aplicables = normativas.filter(n => {
      if (!n.sectores_aplicables || n.sectores_aplicables.length === 0) return true;
      if (!sector) return false;
      return n.sectores_aplicables.includes(sector);
    });

    res.json({ ok: true, data: aplicables, perfil_completo: !!sector });
  } catch (err) {
    console.error('Error al obtener normativas aplicables:', err.message);
    res.status(500).json({ ok: false, error: 'Error al obtener las normativas' });
  }
});

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
