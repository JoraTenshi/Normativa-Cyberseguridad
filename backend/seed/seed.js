const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Normativa = require('../models/Normativa');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cybersec_audit';

const normativas = [
  {
    id: 'iso27001',
    nombre: 'ISO 27001',
    descripcion: 'Estándar internacional para Sistemas de Gestión de Seguridad de la Información (SGSI). Define requisitos para establecer, implementar, mantener y mejorar continuamente la seguridad de la información.',
    sectores_aplicables: [],
    bloques: [
      {
        id: 'politicas',
        nombre: 'Políticas de Seguridad',
        preguntas: [
          { id: 'ps_1', texto: '¿Existe una política de seguridad de la información documentada?', peso: 3 },
          { id: 'ps_2', texto: '¿La política está aprobada por la dirección de la organización?', peso: 2 },
          { id: 'ps_3', texto: '¿La política se revisa periódicamente (al menos anualmente)?', peso: 2 },
          { id: 'ps_4', texto: '¿Se comunica la política a todos los empleados?', peso: 2 }
        ]
      },
      {
        id: 'accesos',
        nombre: 'Gestión de Accesos',
        preguntas: [
          { id: 'ga_1', texto: '¿Se utiliza autenticación multifactor (MFA) para el acceso a sistemas críticos?', peso: 3 },
          { id: 'ga_2', texto: '¿Existe un proceso formal de alta y baja de usuarios?', peso: 3 },
          { id: 'ga_3', texto: '¿Se revisan periódicamente los permisos de acceso de los usuarios?', peso: 2 },
          { id: 'ga_4', texto: '¿Se aplica el principio de mínimo privilegio?', peso: 3 },
          { id: 'ga_5', texto: '¿Los accesos privilegiados (administradores) están correctamente controlados y monitorizados?', peso: 3 }
        ]
      },
      {
        id: 'activos',
        nombre: 'Gestión de Activos',
        preguntas: [
          { id: 'ac_1', texto: '¿Existe un inventario actualizado de activos de información?', peso: 3 },
          { id: 'ac_2', texto: '¿Están clasificados los activos según su criticidad y confidencialidad?', peso: 2 },
          { id: 'ac_3', texto: '¿Existe un responsable (propietario) asignado para cada activo crítico?', peso: 2 },
          { id: 'ac_4', texto: '¿Se aplican controles de seguridad acordes a la clasificación de cada activo?', peso: 2 }
        ]
      },
      {
        id: 'riesgos',
        nombre: 'Gestión de Riesgos',
        preguntas: [
          { id: 'ri_1', texto: '¿Se realiza un análisis de riesgos de seguridad de la información?', peso: 3 },
          { id: 'ri_2', texto: '¿Existe un plan de tratamiento de riesgos documentado?', peso: 3 },
          { id: 'ri_3', texto: '¿Se revisa y actualiza el análisis de riesgos periódicamente?', peso: 2 },
          { id: 'ri_4', texto: '¿Los riesgos aceptados están formalmente aprobados por la dirección?', peso: 2 }
        ]
      },
      {
        id: 'incidentes',
        nombre: 'Gestión de Incidentes',
        preguntas: [
          { id: 'in_1', texto: '¿Existe un proceso formal de gestión de incidentes de seguridad?', peso: 3 },
          { id: 'in_2', texto: '¿Se registran y clasifican todos los incidentes de seguridad?', peso: 2 },
          { id: 'in_3', texto: '¿Se realizan análisis post-incidente para aprender y mejorar?', peso: 2 },
          { id: 'in_4', texto: '¿Existe un equipo o responsable definido para responder a incidentes?', peso: 3 }
        ]
      },
      {
        id: 'continuidad',
        nombre: 'Continuidad del Negocio',
        preguntas: [
          { id: 'co_1', texto: '¿Existe un Plan de Continuidad del Negocio (BCP) documentado?', peso: 3 },
          { id: 'co_2', texto: '¿Se realizan pruebas y simulacros del plan de continuidad?', peso: 2 },
          { id: 'co_3', texto: '¿Están definidos los objetivos de tiempo de recuperación (RTO) y punto de recuperación (RPO)?', peso: 2 },
          { id: 'co_4', texto: '¿Se realizan copias de seguridad regulares y se verifica su integridad?', peso: 3 }
        ]
      }
    ]
  },
  {
    id: 'ens',
    nombre: 'Esquema Nacional de Seguridad (ENS)',
    descripcion: 'Marco normativo español para garantizar la seguridad de los sistemas de información en las Administraciones Públicas y sus proveedores. Regulado por el Real Decreto 311/2022.',
    sectores_aplicables: ['publica'],
    bloques: [
      {
        id: 'marco_organizativo',
        nombre: 'Marco Organizativo',
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
        preguntas: [
          { id: 'gs_1', texto: '¿Se evalúa la seguridad de proveedores y terceros antes de contratarlos?', peso: 3 },
          { id: 'gs_2', texto: '¿Existen cláusulas de seguridad en los contratos con proveedores?', peso: 2 },
          { id: 'gs_3', texto: '¿Se audita periódicamente el cumplimiento de los proveedores críticos?', peso: 2 }
        ]
      }
    ]
  }
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
