'use strict';

// Aplicabilidad orientativa de cada normativa según el perfil de la organización
// (Usuario.organizacion: sector y tamano). Casos y fuentes en docs/aplicabilidad.md.
// No es asesoramiento jurídico: con los datos del perfil solo se puede orientar.
// Función pura: sin Express ni Mongo.

const ESTADOS = Object.freeze({
  APLICA:            'aplica',
  PUEDE_APLICAR:     'puede_aplicar',
  NO_APLICA:         'no_aplica',
  VOLUNTARIA:        'voluntaria',
  PERFIL_INCOMPLETO: 'perfil_incompleto'
});

// Sectores del perfil incluidos en los anexos I y II de NIS2 con umbral de tamaño.
const SECTORES_NIS2 = new Set(['energia', 'transporte', 'sanitaria', 'financiero']);
const TAMANOS_NIS2  = new Set(['mediana', 'grande']);

const resultado = (estado, motivo, extra = {}) => ({ estado, motivo, ...extra });

function faltanDatos(organizacion, campos) {
  return campos.filter(c => !organizacion?.[c]);
}

const REGLAS = {
  rgpd: () => resultado(ESTADOS.APLICA,
    'Aplica a toda organización que trata datos personales (clientes, empleados, proveedores).'),

  lopdpygdd: () => resultado(ESTADOS.APLICA,
    'Desarrolla el RGPD en España: aplica a toda organización que trata datos personales.'),

  iso27001: () => resultado(ESTADOS.VOLUNTARIA,
    'Norma de adopción voluntaria; sirve como marco de referencia y certificación.'),

  iso27002: () => resultado(ESTADOS.VOLUNTARIA,
    'Guía de controles de adopción voluntaria, complementaria a ISO/IEC 27001.'),

  cybersecurity_act: () => resultado(ESTADOS.VOLUNTARIA,
    'La certificación europea de ciberseguridad es voluntaria salvo que otra norma la exija.'),

  ens: ({ sector }) => sector === 'publica'
    ? resultado(ESTADOS.APLICA, 'Obligatorio para el sector público.')
    : resultado(ESTADOS.PUEDE_APLICAR,
      'Aplica si la organización presta servicios o soluciones a entidades del sector público.'),

  eni: ({ sector }) => sector === 'publica'
    ? resultado(ESTADOS.APLICA, 'Obligatorio para el sector público.')
    : resultado(ESTADOS.NO_APLICA, 'Dirigido a las administraciones públicas.'),

  nis2: ({ sector, tamano }) => {
    if (sector === 'publica') {
      return resultado(ESTADOS.APLICA, 'Incluye entidades de la administración pública, con independencia de su tamaño.');
    }
    if (SECTORES_NIS2.has(sector)) {
      if (!tamano) {
        return resultado(ESTADOS.PERFIL_INCOMPLETO,
          'Completa el tamaño de la organización: en este sector NIS2 depende de él.', { faltan: ['tamano'] });
      }
      return TAMANOS_NIS2.has(tamano)
        ? resultado(ESTADOS.APLICA, 'Sector incluido en NIS2 y tamaño mediano o grande.')
        : resultado(ESTADOS.PUEDE_APLICAR,
          'Sector incluido en NIS2; las micro y pequeñas empresas quedan fuera salvo excepciones (p. ej. proveedor único de un servicio esencial).');
    }
    return resultado(ESTADOS.PUEDE_APLICAR,
      'Depende de la actividad concreta: NIS2 cubre también proveedores digitales, fabricación, investigación y otros sectores de sus anexos.');
  },

  lssi_ce: () => resultado(ESTADOS.PUEDE_APLICAR,
    'Aplica si la organización ofrece servicios de la sociedad de la información (web con actividad económica, comercio electrónico, intermediación).'),

  cra: () => resultado(ESTADOS.PUEDE_APLICAR,
    'Aplica si la organización fabrica, importa o distribuye productos con elementos digitales.'),

  ia_act: () => resultado(ESTADOS.PUEDE_APLICAR,
    'Aplica si la organización desarrolla, despliega, importa o distribuye sistemas de IA.')
};

// Datos del perfil que necesita cada regla para poder decidir.
const REQUISITOS = {
  ens:  ['sector'],
  eni:  ['sector'],
  nis2: ['sector']   // el tamaño solo hace falta en algunos sectores; lo pide la propia regla
};

function evaluarAplicabilidad(normativa, organizacion = {}, ahora = new Date()) {
  const regla = REGLAS[normativa.id];
  let r;
  if (!regla) {
    r = resultado(ESTADOS.PUEDE_APLICAR, 'Todavía no hay una regla de aplicabilidad definida para esta normativa.');
  } else {
    const faltan = faltanDatos(organizacion, REQUISITOS[normativa.id] ?? []);
    r = faltan.length
      ? resultado(ESTADOS.PERFIL_INCOMPLETO, 'Completa el perfil de la organización para saber si aplica.', { faltan })
      : regla(organizacion ?? {});
  }

  const fecha = normativa.fecha_aplicabilidad_general;
  if (fecha && r.estado !== ESTADOS.NO_APLICA && new Date(fecha) > ahora) {
    r.aplicable_desde = fecha;
  }
  return r;
}

function perfilCompleto(organizacion) {
  return faltanDatos(organizacion, ['sector', 'tamano']).length === 0;
}

module.exports = { evaluarAplicabilidad, perfilCompleto, ESTADOS, REGLAS };
