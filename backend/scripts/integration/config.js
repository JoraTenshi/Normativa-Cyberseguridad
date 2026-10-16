'use strict';
const fs = require('node:fs');
function loadConfig(read = name => fs.readFileSync('/run/secrets/' + name, 'utf8').trim()) {
  const password = read('mongo_app_password'), jwt = read('jwt_secret'), totp = read('totp_key');
  for (const value of [password, jwt, totp]) if (!/^[a-f0-9]{64}$/.test(value)) throw Error('Formato de secreto inválido');
  if (new Set([password, jwt, totp]).size !== 3) throw Error('Los secretos deben ser distintos');
  // Explicit, closed local teaching profile; never accept an arbitrary origin.
  if (process.env.NC_LOCAL_DEMO !== undefined && process.env.NC_LOCAL_DEMO !== '1') throw Error('Perfil local inválido');
  const origin = process.env.NC_LOCAL_DEMO === '1' ? 'https://127.0.0.2:9445' : 'https://127.0.0.2:9443';
  if (process.env.APP_URL !== origin || process.env.CORS_ORIGIN !== origin) throw Error('Origen de integración inválido');
  return { jwt, totp, origin, uri: 'mongodb://nc_app:' + password +
    '@mongodb:27017/nc_integracion?authSource=nc_integracion&replicaSet=nc-integration-rs&w=majority&retryWrites=true' };
}
module.exports = { loadConfig };
