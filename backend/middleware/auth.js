const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const RevokedToken = require('../models/RevokedToken');

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

  if (payload.jti) {
    const revoked = await RevokedToken.exists({ jti: payload.jti });
    if (revoked) return res.status(401).json({ ok: false, error: 'Token revocado' });
  }

  req.user  = payload;
  req.token = token;
  next();
}

async function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.jti) {
        const revoked = await RevokedToken.exists({ jti: payload.jti });
        if (!revoked) { req.user = payload; req.token = token; }
      } else {
        req.user = payload; req.token = token;
      }
    } catch { }
  }
  next();
}

function extractToken(req) {
  return req.cookies?.cyberaudit_token ?? null;
}

module.exports = { requireAuth, optionalAuth, generateJti, JWT_SECRET, JWT_EXPIRES };
