const express    = require('express');
const router     = express.Router();
const Licitacion = require('../models/Licitacion');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const SCRAPER_URL = process.env.SCRAPER_URL || 'http://scraper:8001';
const MAX_TEXTO   = 100;

// Los parámetros de consulta pueden llegar como objetos (?estado[$ne]=x) o arrays; solo se
// aceptan textos, y la búsqueda se escapa para que sea literal (sin operadores ni regex del cliente).
const texto  = v => (typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, MAX_TEXTO) : null);
const entero = v => (typeof v === 'string' && /^\d{1,4}$/.test(v) ? Number(v) : null);
const escaparRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const filter = {};
    const anio   = entero(req.query.anio);
    const mes    = entero(req.query.mes);
    const estado = texto(req.query.estado);
    const q      = texto(req.query.q);
    if (anio !== null)   filter.anio   = anio;
    if (mes !== null)    filter.mes    = mes;
    if (estado !== null) filter.estado = estado;
    if (q !== null) {
      const re = { $regex: escaparRegex(q), $options: 'i' };
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

router.post('/sync', requireAuth, requireAdmin, async (req, res) => {
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
    // fetch lanza TypeError ante cualquier fallo de red (conexión rechazada, nombre sin resolver si
    // el contenedor está parado…); una respuesta que no es JSON sigue siendo un 500.
    const unreachable = err.name === 'TimeoutError' || err.name === 'TypeError';
    res.status(unreachable ? 503 : 500).json({
      ok:    false,
      error: unreachable ? 'Scraper no disponible' : 'Error al iniciar sync'
    });
  }
});

module.exports = router;
