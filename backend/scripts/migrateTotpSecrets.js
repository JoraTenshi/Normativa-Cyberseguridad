const {
  decryptTotpSecret,
  encryptTotpSecret,
  isLegacyTotpSecret
} = require('../utils/totpEncryption');

async function* storedSecrets(Usuario) {
  const cursor = Usuario.find({ twoFactorSecret: { $ne: null } })
    .select('_id twoFactorSecret')
    .cursor();
  for await (const usuario of cursor) {
    yield usuario;
  }
}

async function scanUsers(Usuario) {
  const counts = { encrypted: 0, legacy: 0, invalid: 0 };
  for await (const usuario of storedSecrets(Usuario)) {
    const stored = usuario.twoFactorSecret;
    if (typeof stored === 'string' && stored.startsWith('v1:')) {
      try {
        decryptTotpSecret(stored, usuario._id);
        counts.encrypted += 1;
      } catch {
        counts.invalid += 1;
      }
    } else if (isLegacyTotpSecret(stored)) {
      counts.legacy += 1;
    } else {
      counts.invalid += 1;
    }
  }
  return counts;
}

async function migrateLegacySecrets(Usuario) {
  const before = await scanUsers(Usuario);
  if (before.invalid > 0) {
    throw new Error('Se encontraron secretos 2FA inválidos; no se ha iniciado la migración');
  }

  let migrated = 0;
  let changedConcurrently = 0;
  for await (const usuario of storedSecrets(Usuario)) {
    const oldSecret = usuario.twoFactorSecret;
    if (!isLegacyTotpSecret(oldSecret)) continue;

    const encrypted = encryptTotpSecret(oldSecret, usuario._id);
    const result = await Usuario.updateOne(
      { _id: usuario._id, twoFactorSecret: oldSecret },
      { $set: { twoFactorSecret: encrypted } }
    );
    if (result.modifiedCount === 1) migrated += 1;
    else changedConcurrently += 1;
  }

  return { before, migrated, changedConcurrently, after: await scanUsers(Usuario) };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] && !['--dry-run', '--apply'].includes(args[0]))) {
    throw new Error('Uso: node scripts/migrateTotpSecrets.js [--dry-run|--apply]');
  }

  require('dotenv').config();
  require('../utils/initSecrets');
  const mongoose = require('mongoose');
  const Usuario = require('../models/Usuario');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI es obligatorio');

  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    if (args[0] === '--apply') {
      const result = await migrateLegacySecrets(Usuario);
      console.log(JSON.stringify(result));
      if (result.after.invalid > 0 || result.after.legacy > 0) {
        process.exitCode = 1;
      }
    } else {
      const result = await scanUsers(Usuario);
      console.log(JSON.stringify(result));
      if (result.invalid > 0) process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Migración 2FA: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { scanUsers, migrateLegacySecrets };
