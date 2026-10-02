require('dotenv').config();

try {
  require('./utils/initSecrets');
} catch (err) {
  console.error(`Configuración de claves: ${err.message}`);
  process.exit(1);
}

const mongoose = require('mongoose');
const { createApp } = require('./app');

const PORT        = process.env.PORT        || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cybersec_audit';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
  } catch (err) {
    console.error('Error al conectar con MongoDB:', err.message);
    process.exit(1);
  }

  const server = createApp().listen(PORT);

  function shutdown() {
    server.close(() => {
      mongoose.connection.close().then(() => process.exit(0));
    });
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
