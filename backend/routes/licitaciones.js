const express    = require('express');
const router     = express.Router();
const Licitacion = require('../models/Licitacion');
const { requireAuth } = require('../middleware/auth');

const SCRAPER_URL = process.env.SCRAPER_URL || 'http://scraper:8001';

router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.anio)   filter.anio   = parseInt(req.query.anio);
    if (req.query.mes)    filter.mes    = parseInt(req.query.mes);
    if (req.query.estado) filter.estado = req.query.estado;
    if (req.query.q) {
      const re = { $regex: req.query.q, $options: 'i' };
      filter.$or = [{ titulo: re }, { resumen: re }];
    }

    const [total, items] = await Promise.all([
      Licitacion.countDocuments(filter),
      Licitacion.find(filter, { resumen: 0, fichero_origen: 0, id: 0 })
        .sort({ scraped_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    res.json({
      ok:   true,
      data: items,
      meta: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error al obtener licitaciones' });
  }
});

router.get('/status', requireAuth, async (req, res) => {
  try {
    const resp = await fetch(`${SCRAPER_URL}/health`, {
      signal: AbortSignal.timeout(3000)
    });
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch {
    res.status(503).json({ ok: false, error: 'Scraper no disponible' });
  }
});

router.post('/sync', requireAuth, async (req, res) => {
  try {
    const anio = req.body?.anio ? parseInt(req.body.anio) : null;
    const mes  = req.body?.mes  ? parseInt(req.body.mes)  : null;

    if (anio !== null && (isNaN(anio) || anio < 2020 || anio > 2099))
      return res.status(400).json({ ok: false, error: 'anio inválido' });
    if (mes !== null && (isNaN(mes) || mes < 1 || mes > 12))
      return res.status(400).json({ ok: false, error: 'mes inválido' });

    const params = new URLSearchParams();
    if (anio) params.set('anio', anio);
    if (mes)  params.set('mes',  mes);
    const query = params.toString();

    const resp = await fetch(`${SCRAPER_URL}/sync${query ? '?' + query : ''}`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000)
    });
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err) {
    const unreachable = err.name === 'TimeoutError' || err.cause?.code === 'ECONNREFUSED';
    res.status(unreachable ? 503 : 500).json({
      ok:    false,
      error: unreachable ? 'Scraper no disponible' : 'Error al iniciar sync'
    });
  }
});

module.exports = router;
