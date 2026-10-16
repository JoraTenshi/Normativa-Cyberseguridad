'use strict';
const router = require('express').Router({ mergeParams: true });
const servicio = require('../services/registrosNormativos');
const { campos } = require('../services/datosOrganizacion');
const { INMUTABLES } = require('../validation/categorizacionEns');
const {INMUTABLES: INMUTABLES_RAT}=require('../validation/registroRAT');
const entrada = req => ({ usuarioId: req.user.id, organizacionId: req.params.organizacionId, registroId: req.params.registroId });
const get = fn => async (req, res, next) => { try { res.json({ ok: true, data: await fn(req) }); } catch (e) { next(e); } };
router.get('/catalogo', get(req => { campos(req.query, []); return servicio.fichas(entrada(req)); }));
router.get('/catalogo/:fichaId', get(req => { campos(req.query, []); return servicio.fichas({ ...entrada(req), fichaId: req.params.fichaId }); }));
router.get('/responsables', get(req => servicio.responsables({ ...entrada(req), filtros: req.query })));
router.get('/categorizacion-ens/contrato', get(req => { campos(req.query, []); return servicio.contratoCategorizacion(entrada(req)); }));
router.get('/rat/contrato',get(req=>{campos(req.query,[]);return servicio.contratoRegistroRAT(entrada(req));}));
router.get('/unidades-dp/contrato',get(req=>{campos(req.query,[]);return servicio.contratoUnidadesDP(entrada(req));}));
router.get('/derechos/contrato',get(req=>{campos(req.query,[]);return servicio.contratoSolicitudesDerechos(entrada(req));}));
router.get('/detecciones-eipd/contrato',get(req=>{campos(req.query,[]);return servicio.contratoDeteccionesEIPD(entrada(req));}));
for (const [ruta, tipo] of Object.entries({ sistemas: 'sistema', requisitos: 'requisito', actuaciones: 'actuacion', evidencias: 'evidencia', revisiones: 'revision',
  'sujetos-funcionales': 'sujeto_funcional', designaciones: 'designacion',
  'categorizaciones-ens':'categorizacion_ens','determinaciones-ens':'determinacion_ens','revisiones-categorizacion-ens':'revision_categorizacion_ens',
  'registros-rat':'registro_rat','revisiones-rat':'revision_rat','actuaciones-rat':'actuacion_rat','unidades-dp':'unidad_dp',
  'solicitudes-derechos':'solicitud_derechos','pretensiones-derechos':'pretension_derecho','detecciones-eipd':'deteccion_eipd' })) {
  router.get('/' + ruta, get(req => servicio.listar({ ...entrada(req), filtros: req.query }, tipo)));
  router.get('/' + ruta + '/:registroId', get(req => { campos(req.query, []); return servicio.obtener(entrada(req), tipo); }));
  router.get('/' + ruta + '/:registroId/versiones', get(req => servicio.versiones({ ...entrada(req), filtros: req.query }, tipo)));
  router.get('/' + ruta + '/:registroId/versiones/:numero', get(req => {
    campos(req.query, []); return servicio.obtener({ ...entrada(req), numero: req.params.numero }, tipo);
  }));
  for (const [metodo, path, editar] of [['post', '/' + ruta, false], ...(tipo === 'revision' || INMUTABLES.includes(tipo) || INMUTABLES_RAT.includes(tipo) ? [] : [['patch', '/' + ruta + '/:registroId', true]])]) {
    router[metodo](path, async (req, res, next) => {
      try {
        campos(req.query, []);
        const data = await servicio.guardar({ ...entrada(req), datos: req.body, clave: req.get('Idempotency-Key') }, tipo, editar);
        res.status(editar || data.repetida ? 200 : 201).json({ ok: true, data });
      } catch (e) { next(e); }
    });
  }
}
module.exports = router;
