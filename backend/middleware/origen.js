// Defensa CSRF complementaria a las cookies SameSite=Strict, para peticiones que cambian datos.
//  - Si llega un Origin real, debe ser el del frontend (CORS_ORIGIN).
//  - Si no llega Origin o vale "null" (p. ej. por Referrer-Policy: no-referrer, iframes con
//    sandbox o clientes sin navegador), se exige X-Requested-With: XMLHttpRequest. Otra web no
//    puede añadir esa cabecera sin una petición previa CORS, y CORS solo admite CORS_ORIGIN.
// El frontend envía siempre esa cabecera (frontend/src/services/api.js).

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

function rechazar(res) {
  return res.status(403).json({ ok: false, code: 'ORIGEN_NO_PERMITIDO', error: 'Origen de la petición no permitido' });
}

function comprobarOrigen(origenPermitido) {
  return (req, res, next) => {
    if (METODOS_SEGUROS.has(req.method)) return next();

    const origin = req.get('Origin');
    if (origin && origin !== 'null') {
      return origin === origenPermitido ? next() : rechazar(res);
    }

    return req.get('X-Requested-With') === 'XMLHttpRequest' ? next() : rechazar(res);
  };
}

module.exports = { comprobarOrigen };
