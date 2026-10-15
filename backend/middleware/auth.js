const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const mongoose     = require('mongoose');
const RevokedToken = require('../models/RevokedToken');
const Usuario      = require('../models/Usuario');
const accesoSesion = require('../services/accesoSesion');

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_EXPIRES = '1d';

function generateJti() {
  return crypto.randomBytes(32).toString('hex');
}

async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ ok: false, error: 'Autenticación requerida' });

  if (accesoSesion.esPersistente(req)) {
    try {
      const acceso = await accesoSesion.comprobar(token);
      if (!acceso) return res.status(401).json({ ok:false, codigo:'SESION_NO_VALIDA', error:'Sesión caducada o no válida. Inicia sesión de nuevo.' });
      const esperado = req.get('X-Session-User');
      if (esperado && esperado !== acceso.usuario.id) return res.status(409).json({
        ok:false, codigo:'CUENTA_CAMBIADA', error:'La cuenta cambió en otra pestaña. Revisa la sesión antes de continuar.'
      });
      req.usuarioActual = acceso.usuario;
      req.user = acceso.payload;
      req.token = token;
      req.estadoSesion = acceso.estado;
      req.claveSesion = acceso.clave;
      res.set('Cache-Control','no-store');
      return next();
    } catch { return serviceUnavailable(res); }
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }

  try {
    if (!(await isCurrentSession(payload))) {
      return res.status(401).json({ ok: false, error: 'Sesión no válida. Inicia sesión de nuevo.' });
    }
  } catch {
    return serviceUnavailable(res);
  }

  req.user  = payload;
  req.token = token;
  next();
}

async function optionalAuth(req, res, next) {
  // Solo la ausencia de cookie permite un envío anónimo. Una sesión inválida
  // debe avisar: de lo contrario el usuario cree que se guardó su evaluación.
  if (extractToken(req) === null) return next();
  return requireAuth(req, res, next);
}

async function isCurrentSession(payload) {
  if (payload.pending2fa || !mongoose.isValidObjectId(payload.id)) return false;
  if (typeof payload.jti !== 'string' || payload.jti === '') return false;
  const usuario = await Usuario.findById(payload.id).select('sessionVersion emailVerifiedAt');
  if (!usuario?.emailVerifiedAt || (payload.sessionVersion ?? 0) !== (usuario.sessionVersion ?? 0)) return false;
  if (await RevokedToken.exists({ jti: payload.jti })) return false;
  return true;
}

// Tras requireAuth. El rol se lee de la base de datos en cada petición (no del JWT), para que
// retirar el rol surta efecto inmediatamente.
async function requireAdmin(req, res, next) {
  let usuario;
  try {
    usuario = await Usuario.findById(req.user.id).select('rol');
  } catch {
    return serviceUnavailable(res);
  }
  if (usuario?.rol !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Se requiere rol de administrador' });
  }
  next();
}

function serviceUnavailable(res) {
  return res.status(503).json({ ok: false, error: 'Servicio no disponible temporalmente' });
}

function extractToken(req) {
  return req.cookies?.cyberaudit_token ?? null;
}

module.exports = { requireAuth, requireAdmin, optionalAuth, generateJti, JWT_SECRET, JWT_EXPIRES };
