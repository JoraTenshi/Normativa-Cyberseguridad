'use strict';

const { requireAuth } = require('./auth');
const {
  obtenerContextoOrganizacion,
  ErrorContextoOrganizacion
} = require('../services/contextoOrganizacion');

// Array de middleware: incluye autenticacion, no depende de recordarla aparte.
// Requiere cookie-parser antes y :organizacionId en la ruta (o mergeParams si
// viene de un router padre). No se monta en las rutas actuales en esta unidad.
function crearMiddlewareOrganizacion({ resolverContexto = obtenerContextoOrganizacion } = {}) {
  async function comprobarOrganizacion(req, res, next) {
    // No reutilizar un contexto de otro paso ni aceptar el contexto del cliente.
    delete req.contextoOrganizacion;
    try {
      req.contextoOrganizacion = await resolverContexto({
        usuarioId: req.user.id,
        organizacionId: req.params.organizacionId
      });
    } catch (error) {
      if (error instanceof ErrorContextoOrganizacion) {
        return res.status(error.status).json({
          ok: false,
          codigo: error.codigo,
          error: error.message
        });
      }
      return next(error);
    }
    // La ruta aun debe autorizar su accion y acotar el recurso a esta empresa.
    return next();
  }

  return [requireAuth, comprobarOrganizacion];
}

const requireOrganizacionActiva = crearMiddlewareOrganizacion();

module.exports = { requireOrganizacionActiva, crearMiddlewareOrganizacion };
