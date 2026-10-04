// Errores de MongoDB que significan "base de datos no disponible" (no un fallo del código): se
// responden con 503. Con serverSelectionTimeoutMS (server.js) aparecen en unos 5 s.
const NOMBRES = new Set([
  'MongoServerSelectionError', 'MongooseServerSelectionError',
  'MongoNetworkError', 'MongoNetworkTimeoutError', 'MongoNotConnectedError'
]);

function esBDNoDisponible(err) {
  return NOMBRES.has(err?.name) || /buffering timed out/.test(err?.message ?? '');
}

module.exports = { esBDNoDisponible };
