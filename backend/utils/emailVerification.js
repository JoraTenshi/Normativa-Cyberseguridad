const crypto = require('crypto');

const TOKEN_BYTES = 32;

function hashTokenVerificacionEmail(tokenPlano) {
  if (typeof tokenPlano !== 'string' || tokenPlano.length === 0) {
    throw new Error('El token de verificación es obligatorio');
  }

  return crypto
    .createHash('sha256')
    .update(tokenPlano)
    .digest('hex');
}

function crearTokenVerificacionEmail(ttlMs) {
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
    throw new Error('La duración del token debe ser un número entero positivo');
  }

  const tokenPlano = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = hashTokenVerificacionEmail(tokenPlano);
  const expiresAt = new Date(Date.now() + ttlMs);

  return {
    tokenPlano,
    tokenHash,
    expiresAt
  };
}

module.exports = {
  crearTokenVerificacionEmail,
  hashTokenVerificacionEmail
};
