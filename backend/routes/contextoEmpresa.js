'use strict';
const router = require('express').Router({ mergeParams: true });
const servicio = require('../services/contextoEmpresa');
const { campos } = require('../services/datosOrganizacion');
const entrada = req => ({ usuarioId: req.user.id, organizacionId: req.params.organizacionId });
const ejecutar = fn => async (req, res, next) => {
  try { res.json({ ok: true, data: await fn(req) }); } catch (e) { next(e); }
};
// requireAuth y no-store se aplican en el router padre; CSRF en app.
router.get('/', ejecutar(req => {
  campos(req.query, []);
  return servicio.obtenerContexto(entrada(req));
}));
router.get('/versiones', ejecutar(req => servicio.listarVersiones({ ...entrada(req), filtros: req.query })));
router.get('/versiones/:numero', ejecutar(req => {
  campos(req.query, []);
  return servicio.obtenerContexto({ ...entrada(req), numero: req.params.numero });
}));
for (const metodo of ['post', 'patch']) {
  router[metodo]('/', async (req, res, next) => {
    try {
      campos(req.query, []);
      const data = await servicio.guardarContexto({
        ...entrada(req), datos: req.body, clave: req.get('Idempotency-Key')
      }, metodo === 'patch');
      res.status(metodo === 'post' && !data.repetida ? 201 : 200).json({ ok: true, data });
    } catch (e) { next(e); }
  });
}
router.use(require("./decisionesAplicabilidad"));
module.exports = router;
