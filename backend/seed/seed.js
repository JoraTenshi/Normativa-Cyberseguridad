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

const normativas = [
  {
    id: 'ens',
    nombre: 'Esquema Nacional de Seguridad (ENS)',
    descripcion: 'Marco normativo español para garantizar la seguridad de los sistemas de información en las Administraciones Públicas y sus proveedores. Regulado por el Real Decreto 311/2022.',
    sectores_aplicables: ['publica'],
    bloques: [
      {
        id: 'marco_organizativo',
        nombre: 'Marco Organizativo',
        temas: ['security_policy', 'awareness_training'],
        preguntas: [
          { id: 'mo_1', texto: '¿Existe una política de seguridad formal aprobada por el órgano directivo?', peso: 3 },
          { id: 'mo_2', texto: '¿Están definidos los roles y responsabilidades en materia de seguridad?', peso: 3 },
          { id: 'mo_3', texto: '¿Se realiza formación y concienciación en seguridad para el personal?', peso: 2 },
          { id: 'mo_4', texto: '¿Existe un proceso de autorización para la operación de sistemas?', peso: 2 }
        ]
      },
      {
        id: 'proteccion_datos',
        nombre: 'Protección de Datos Personales',
        temas: ['data_protection', 'cryptography'],
        preguntas: [
          { id: 'pd_1', texto: '¿Se aplican medidas técnicas de protección de datos personales (cifrado, seudonimización)?', peso: 3 },
          { id: 'pd_2', texto: '¿Existe un Delegado de Protección de Datos (DPD) designado?', peso: 2 },
          { id: 'pd_3', texto: '¿Se realizan evaluaciones de impacto (EIPD) para tratamientos de alto riesgo?', peso: 3 },
          { id: 'pd_4', texto: '¿Se gestionan adecuadamente los derechos ARCO de los interesados?', peso: 2 }
        ]
      },
      {
        id: 'infraestructura',
        nombre: 'Seguridad de la Infraestructura',
        temas: ['network_security', 'vulnerability_management', 'logging_monitoring'],
        preguntas: [
          { id: 'if_1', texto: '¿Se aplican parches de seguridad de forma periódica?', peso: 3 },
          { id: 'if_2', texto: '¿Existe segmentación de red y control de tráfico mediante firewalls?', peso: 3 },
          { id: 'if_3', texto: '¿Se monitorizan los sistemas y se almacenan logs de auditoría?', peso: 2 },
          { id: 'if_4', texto: '¿Se realizan análisis de vulnerabilidades y pruebas de penetración?', peso: 3 }
        ]
      },
      {
        id: 'gestion_servicios',
        nombre: 'Gestión de Servicios Externos',
        temas: ['supplier_risk'],
        preguntas: [
          { id: 'gs_1', texto: '¿Se evalúa la seguridad de proveedores y terceros antes de contratarlos?', peso: 3 },
          { id: 'gs_2', texto: '¿Existen cláusulas de seguridad en los contratos con proveedores?', peso: 2 },
          { id: 'gs_3', texto: '¿Se audita periódicamente el cumplimiento de los proveedores críticos?', peso: 2 }
        ]
      }
    ]
  },
  ...normativasCanonicas
];

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
