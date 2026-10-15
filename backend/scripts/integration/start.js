'use strict';
// Entrada exclusiva de integración: no lee .env ni permite sesiones de laboratorio.
const { loadConfig } = require('./config');
const { diagnostic } = require('./diagnostic');
let stage = 'secretos';
async function start() {
  stage = 'secretos';
  const config = loadConfig();
  process.env.JWT_SECRET = config.jwt;
  process.env.TOTP_ENCRYPTION_KEY = config.totp;
  // SMTP queda sin configurar: no se envían correos ni se muestran enlaces de recuperación.
  for (const key of ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS']) delete process.env[key];
  require('../../utils/initSecrets');
  stage = 'carga_aplicacion';
  const mongoose = require('mongoose');
  const { createApp } = require('../../app');
  stage = 'conexion_mongodb';
  await mongoose.connect(config.uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 15 });
  stage = 'replica';
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (hello.setName !== 'nc-integration-rs' || !hello.isWritablePrimary) throw Error('Replica no disponible');
  // init crea índices declarados, no elimina índices ni transforma datos existentes.
  stage = 'indices';
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  const app = createApp(); // Límites, permisos, MFA y política persistente activados.
  stage = 'http';
  const server = app.listen(5000, '0.0.0.0', () => console.log('Integración lista: backend + réplica + índices.'));
  server.once('error', () => { console.error('No se pudo abrir el puerto interno.'); process.exit(1); });
  let stopping = false;
  function stop() {
    if (stopping) return; stopping = true;
    const timer = setTimeout(() => process.exit(1), 30000); timer.unref();
    server.close(async () => { await mongoose.disconnect(); clearTimeout(timer); process.exit(0); });
  }
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
if (require.main === module) start().catch(error => {
  // No imprimir URI, contraseña ni stack de conexión.
  console.error('Arranque de integración fallido: ' + diagnostic(stage, error) + '. No se han borrado datos.');
  process.exit(1);
});
module.exports = { start };
