// Centralised error handler — must be registered last in server.js

function errorHandler(err, req, res, _next) {
  // ── Malformed JSON body ──────────────────────────────────────────────────────
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'JSON malformado en el cuerpo de la petición' });
  }

  // ── Mongoose: validation failed (schema constraints) ────────────────────────
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ ok: false, error: messages.join('. ') });
  }

  // ── Mongoose: invalid value for a field type (e.g. bad ObjectId format) ─────
  if (err.name === 'CastError') {
    return res.status(400).json({
      ok: false,
      error: `Valor inválido para el campo "${err.path}"`
    });
  }

  // ── MongoDB: duplicate unique key ────────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'campo';
    return res.status(409).json({
      ok: false,
      error: `El valor del campo "${field}" ya está en uso`
    });
  }

  // ── Payload too large (express.json limit) ───────────────────────────────────
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, error: 'El cuerpo de la petición es demasiado grande' });
  }

  // ── Anything else is an unexpected server error ──────────────────────────────
  console.error('Unhandled error:', err.message, err.stack);
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
}

module.exports = errorHandler;
