'use strict';
const router = require('express').Router({ mergeParams: true });
const servicio = require('../services/decisionesOperacion');
const { campos } = require('../services/datosOrganizacion');
const entrada = req => ({ usuarioId: req.user.id, organizacionId: req.params.organizacionId, operacionId: req.params.operacionId });
const ejecutar = fn => async (req, res, next) => {
  try { res.json({ ok: true, data: await fn(req) }); } catch (e) { next(e); }
};
router.get('/reglas', ejecutar(req => {
  campos(req.query, []); return servicio.listarReglas(entrada(req));
}));
router.get('/decisiones', ejecutar(req => servicio.listarDecisiones({ ...entrada(req), filtros: req.query })));
router.get('/decisiones/:decisionId', ejecutar(req => {
  campos(req.query, []);
  return servicio.obtenerDecision({ ...entrada(req), decisionId: req.params.decisionId });
}));
router.post('/decisiones', async (req, res, next) => {
  try {
    campos(req.query, []);
    const data = await servicio.guardarDecision({ ...entrada(req), datos: req.body, clave: req.get('Idempotency-Key') });
    res.status(data.repetida ? 200 : 201).json({ ok: true, data });
  } catch (e) { next(e); }
});
module.exports = router;
