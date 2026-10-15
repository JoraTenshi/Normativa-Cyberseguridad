const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Usuario = require('../models/Usuario');
const Membresia = require('../models/Membresia');
const Organizacion = require('../models/Organizacion');
const Resultado = require('../models/Resultado');
const { resumenResultado, detalleResultado } = require('../services/resultadoLectura');
const { esBDNoDisponible } = require('../utils/bd');

const SECTORES_VALIDOS = ['publica', 'sanitaria', 'energia', 'transporte', 'financiero', 'educacion', 'privada', 'otro'];
const TAMANOS_VALIDOS  = ['micro', 'pequena', 'mediana', 'grande'];

router.get('/', requireAuth, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id, { password: 0, __v: 0, loginAttempts: 0, lockUntil: 0 });
    if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    res.json({ ok: true, data: usuario });
  } catch (err) {
    if (esBDNoDisponible(err)) return res.status(503).json({ ok: false, error: 'Servicio no disponible temporalmente' });
    console.error('Error al obtener perfil:', err.message);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

// Selector de empresas: no acepta identidad del cliente ni concede membresías.
router.get('/organizaciones', requireAuth, async (req, res) => {
  const { despues, limite = '50' } = req.query;
  if (Object.keys(req.query).some(k => !['despues','limite'].includes(k)) ||
      typeof limite !== 'string' || !/^[1-9][0-9]?$/.test(limite) || Number(limite) > 50 ||
      (despues !== undefined && (typeof despues !== 'string' || !/^[a-f0-9]{24}$/i.test(despues)))) {
    return res.status(400).json({ ok:false, error:'Filtros de organizaciones inválidos' });
  }
  try {
    // Agrupar antes de filtrar estado: no elegir una membresía entre duplicados.
    const pipeline = [
      { $match:{ usuario:new mongoose.Types.ObjectId(req.user.id) } },
      { $group:{ _id:'$organizacion', cantidad:{ $sum:1 }, estado:{ $first:'$estado' }, rol:{ $first:'$rol' } } },
      { $match:{ cantidad:1, estado:'activa', rol:{ $in:['administrador','colaborador','consulta'] },
        ...(despues ? { _id:{ $gt:new mongoose.Types.ObjectId(despues) } } : {}) } },
      { $lookup:{ from:Organizacion.collection.name, localField:'_id', foreignField:'_id', as:'empresa' } },
      { $unwind:'$empresa' }, { $match:{ 'empresa.estado':'activa' } },
      { $sort:{ _id:1 } }, { $limit:Number(limite)+1 },
      { $project:{ _id:0, id:{ $toString:'$_id' }, nombre:'$empresa.razon_social', rol:1 } }
    ];
    const rows = await Membresia.aggregate(pipeline).read('primary');
    const organizaciones = rows.slice(0, Number(limite));
    res.set('Cache-Control','private, no-store');
    return res.json({ ok:true, data:{ organizaciones,
      siguiente:rows.length > Number(limite) ? organizaciones.at(-1).id : null } });
  } catch {
    return res.status(503).json({ ok:false, error:'No se pueden consultar las organizaciones' });
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
    if (esBDNoDisponible(err)) return res.status(503).json({ ok: false, error: 'Servicio no disponible temporalmente' });
    console.error('Error al actualizar perfil de organización:', err.message);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.get('/historial', requireAuth, async (req, res) => {
  try {
    const resultados = await Resultado.find({ usuario: req.user.id }, {
      respuestas: 0, normativa_snapshot: 0, remediaciones_snapshot: 0,
      cuestionario: 0, remediaciones: 0, cobertura_estimada: 0,
      bloques: 0, puntuaciones_bloques: 0, __v: 0
    }).sort({ createdAt: -1 });
    res.json({ ok: true, data: resultados.map(resumenResultado) });
  } catch (err) {
    if (esBDNoDisponible(err)) return res.status(503).json({ ok: false, error: 'Servicio no disponible temporalmente' });
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
      { _id: req.params.resultadoId, usuario: req.user.id }, { __v: 0 }
    );
    if (!resultado) return res.status(404).json({ ok: false, error: 'Evaluación no encontrada' });
    res.json({ ok: true, data: await detalleResultado(resultado) });
  } catch (err) {
    if (esBDNoDisponible(err)) return res.status(503).json({ ok: false, error: 'Servicio no disponible temporalmente' });
    console.error('Error al obtener detalle de evaluación:', err.message);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

module.exports = router;
