const mongoose = require('mongoose');

async function scanAuthState() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI es obligatorio');
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    const usuarios = mongoose.connection.db.collection('usuarios');
    const [total, verified, missingVerificationField, pendingVerification,
      storedTotp, legacyTotp, encryptedTotp] = await Promise.all([
      usuarios.countDocuments({}),
      usuarios.countDocuments({ emailVerifiedAt: { $type: 'date' } }),
      usuarios.countDocuments({ emailVerifiedAt: { $exists: false } }),
      usuarios.countDocuments({ emailVerifiedAt: { $type: 'null' } }),
      usuarios.countDocuments({ twoFactorSecret: { $type: 'string' } }),
      usuarios.countDocuments({ twoFactorSecret: /^[A-Z2-7]{32}$/i }),
      usuarios.countDocuments({ twoFactorSecret: /^v1:/ })
    ]);

    console.log(JSON.stringify({
      total,
      verified,
      missingVerificationField,
      pendingVerification,
      invalidVerificationField: total - verified - missingVerificationField - pendingVerification,
      storedTotp,
      legacyTotp,
      encryptedTotp,
      unknownTotpFormat: storedTotp - legacyTotp - encryptedTotp
    }));
  } finally {
    await mongoose.disconnect();
  }
}

scanAuthState().catch(error => {
  console.error(`Análisis de cuentas: ${error.message}`);
  process.exitCode = 1;
});
