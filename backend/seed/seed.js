const fs = require('fs');
const path = require('path');

const SEED_DIR = __dirname;

class ColeccionNoVaciaError extends Error {
  constructor(total) {
    super(
      `La colección normativas ya contiene ${total} documento(s); el seed no se ejecuta ` +
      'para no borrar ni duplicar datos. Solo se puede sembrar una base de datos vacía.'
    );
    this.name = 'ColeccionNoVaciaError';
    this.total = total;
  }
}

function cargarNormativas(dir = SEED_DIR) {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('_normativa.json') && f !== 'schema_normativa.json')
    .sort()
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

async function sembrarNormativas(Normativa, normativas) {
  const total = await Normativa.countDocuments();
  if (total !== 0) throw new ColeccionNoVaciaError(total);

  await Normativa.insertMany(normativas);
  return normativas.length;
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  const mongoose = require('mongoose');
  const Normativa = require('../models/Normativa');

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cybersec_audit';

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado a MongoDB');

    const insertadas = await sembrarNormativas(Normativa, cargarNormativas());
    console.log(`${insertadas} normativas insertadas correctamente`);
    console.log('Seed completado.');
  } catch (err) {
    console.error('Error en el seed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) main();

module.exports = { sembrarNormativas, cargarNormativas, ColeccionNoVaciaError };
