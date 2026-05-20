const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Normativa = require('../models/Normativa');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cybersec_audit';

const normativasCanonicas = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('_normativa.json') && f !== 'schema_normativa.json')
  .sort()
  .map(f => require(`./${f}`));

// Todas las normativas (incluida ENS) se cargan ahora desde sus
// `*_normativa.json` canónicos vía auto-descubrimiento.
const normativas = [...normativasCanonicas];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    await Normativa.deleteMany({});
    console.log('🗑️  Colección normativas limpiada');

    await Normativa.insertMany(normativas);
    console.log(`✅ ${normativas.length} normativas insertadas correctamente`);

    await mongoose.disconnect();
    console.log('Seed completado.');

  } catch (err) {
    console.error('❌ Error en el seed:', err.message);
    process.exit(1);
  }
}

seed();
