const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const RevokedToken = require('../models/RevokedToken');
const Usuario      = require('../models/Usuario');

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_EXPIRES = '1d';

function generateJti() {
  return crypto.randomBytes(32).toString('hex');
}

async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ ok: false, error: 'Autenticación requerida' });

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
  } catch (err) {
    return next(err);
  }

  req.user  = payload;
  req.token = token;
  next();
}

async function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      if (await isCurrentSession(payload)) {
        req.user = payload; req.token = token;
      }
    } catch { }
  }
  next();
}

async function isCurrentSession(payload) {
  if (!payload.id || payload.pending2fa) return false;
  const usuario = await Usuario.findById(payload.id).select('sessionVersion emailVerifiedAt');
  if (!usuario?.emailVerifiedAt || (payload.sessionVersion ?? 0) !== (usuario.sessionVersion ?? 0)) return false;
  if (payload.jti && await RevokedToken.exists({ jti: payload.jti })) return false;
  return true;
}

function extractToken(req) {
  return req.cookies?.cyberaudit_token ?? null;
}

module.exports = { requireAuth, optionalAuth, generateJti, JWT_SECRET, JWT_EXPIRES };
