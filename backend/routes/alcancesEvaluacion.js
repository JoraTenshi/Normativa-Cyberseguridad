'use strict';
const router = require('express').Router({ mergeParams: true });
const s = require('../services/alcancesEvaluacion');
const { campos } = require('../services/datosOrganizacion');
const entrada = req => ({ usuarioId: req.user.id, organizacionId: req.params.organizacionId, alcanceId: req.params.alcanceId });
const ejecutar = fn => async (req, res, next) => { try { await fn(req, res); } catch(e) { next(e); } };
// requireAuth, no-store y CSRF heredados de organizaciones/app.
router.get('/contexto/propuestas', ejecutar(async (req, res) => {
  campos(req.query, []); res.json({ ok: true, data: await s.obtenerPropuestas(entrada(req)) });
}));
router.post('/contexto/materializaciones', ejecutar(async (req, res) => {
  campos(req.query, []);
  const data = await s.materializar({ ...entrada(req), datos: req.body, clave: req.get('Idempotency-Key') });
  res.status(data.repetida ? 200 : 201).json({ ok: true, data });
}));
router.get('/alcances', ejecutar(async (req, res) => res.json({ ok: true, data: await s.listar({ ...entrada(req), filtros: req.query }) })));
router.get('/alcances/:alcanceId/versiones', ejecutar(async (req, res) => res.json({ ok: true, data: await s.listarVersiones({ ...entrada(req), filtros: req.query }) })));
for (const ruta of ['/alcances/:alcanceId', '/alcances/:alcanceId/versiones/:numero']) {
  router.get(ruta, ejecutar(async (req, res) => {
    campos(req.query, []); res.json({ ok: true, data: await s.obtener({ ...entrada(req), numero: req.params.numero }) });
  }));
}
router.patch('/alcances/:alcanceId', ejecutar(async (req, res) => {
  campos(req.query, []);
  res.json({ ok: true, data: await s.modificar({ ...entrada(req), datos: req.body, clave: req.get('Idempotency-Key') }) });
}));
module.exports = router;
