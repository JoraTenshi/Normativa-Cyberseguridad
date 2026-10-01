const { readFileSync } = require('node:fs');

try {
  if (process.argv.length !== 3) {
    throw new Error('Uso: node scripts/check-backend-secrets.js backend/.env');
  }

  const lines = readFileSync(process.argv[2], 'utf8').split(/\r?\n/);
  function readSecret(name) {
    const prefix = `${name}=`;
    const entries = lines.filter(line => line.startsWith(prefix));
    if (entries.length !== 1) {
      throw new Error(`${name} debe aparecer exactamente una vez en backend/.env`);
    }
    return entries[0].slice(prefix.length);
  }

  process.env.JWT_SECRET = readSecret('JWT_SECRET');
  process.env.TOTP_ENCRYPTION_KEY = readSecret('TOTP_ENCRYPTION_KEY');
  require('../backend/utils/initSecrets');
  console.log('Claves de backend/.env comprobadas; se puede iniciar Docker.');
} catch (error) {
  console.error(`Configuración de claves: ${error.message}`);
  process.exitCode = 1;
}
