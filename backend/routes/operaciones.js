'use strict';
const router = require('express').Router({ mergeParams: true });
const servicio = require('../services/operaciones');
const { campos } = require('../services/datosOrganizacion');
const entrada = req => ({ usuarioId: req.user.id, organizacionId: req.params.organizacionId,
  operacionId: req.params.operacionId });
const ejecutar = fn => async (req, res, next) => {
  try { res.json({ ok: true, data: await fn(req) }); } catch (e) { next(e); }
};
// Autenticación/no-store heredados del router de organizaciones; CSRF en app.
router.get('/', ejecutar(req => servicio.listarOperaciones({ ...entrada(req), filtros: req.query })));
router.get('/:operacionId', ejecutar(req => {
  campos(req.query, []); return servicio.obtenerOperacion(entrada(req));
}));
router.get('/:operacionId/versiones', ejecutar(req =>
  servicio.listarVersiones({ ...entrada(req), filtros: req.query })));
router.get('/:operacionId/versiones/:numero', ejecutar(req => {
  campos(req.query, []); return servicio.obtenerOperacion({ ...entrada(req), numero: req.params.numero });
}));
for (const [metodo, ruta, actualizar] of [['post', '/', false], ['patch', '/:operacionId', true]]) {
  router[metodo](ruta, async (req, res, next) => {
    try {
      campos(req.query, []);
      const data = await servicio.guardarOperacion({ ...entrada(req), datos: req.body,
        clave: req.get('Idempotency-Key') }, actualizar);
      res.status(!actualizar && !data.repetida ? 201 : 200).json({ ok: true, data });
    } catch (e) { next(e); }
  });
}
router.get('/:operacionId/propuestas/rgpd28', ejecutar(req => {
  campos(req.query, ['version']);
  return require('../services/propuestasOperacion').consultarPropuestaRGPD28({
    ...entrada(req), version: req.query.version
  });
}));
router.use('/:operacionId', require('./decisionesOperacion'));
module.exports = router;
