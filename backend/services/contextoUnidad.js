'use strict';

const mongoose = require('mongoose');
const UnidadTrabajo = require('../models/UnidadTrabajo');
const MembresiaUnidad = require('../models/MembresiaUnidad');
const { obtenerContextoOrganizacion } = require('./contextoOrganizacion');

const ROLES_UNIDAD = new Set(['miembro', 'coordinador']);
const ERRORES = Object.freeze({
  UNIDAD_INVALIDA: [400, 'Identificador de unidad inválido'],
  ACCESO_UNIDAD_DENEGADO: [403, 'No tienes acceso a esta unidad'],
  CONTEXTO_UNIDAD_NO_DISPONIBLE: [503, 'Servicio no disponible temporalmente']
});

class ErrorContextoUnidad extends Error {
  constructor(codigo, opciones) {
    const [status, mensaje] = ERRORES[codigo];
    super(mensaje, opciones);
    this.name = 'ErrorContextoUnidad';
    this.codigo = codigo;
    this.status = status;
  }
}

function idCanonico(valor) {
  return mongoose.isObjectIdOrHexString(valor) ? String(valor).toLowerCase() : null;
}

function accesoDenegado() {
  return new ErrorContextoUnidad('ACCESO_UNIDAD_DENEGADO');
}

// Dependencias sustituibles solo desde codigo interno/pruebas, nunca desde HTTP.
function crearServicioContextoUnidad({
  resolverOrganizacion = obtenerContextoOrganizacion,
  UnidadTrabajoModel = UnidadTrabajo,
  MembresiaUnidadModel = MembresiaUnidad
} = {}) {
  // Precondicion: usuarioId sale de requireAuth, no del cuerpo de la peticion.
  // Revalida la empresa en cada llamada; no admite un contexto aportado por el
  // navegador. Propaga los errores de organizacion con su codigo/status.
  return async function obtenerContextoUnidad({ usuarioId, organizacionId, unidadId } = {}) {
    const empresa = await resolverOrganizacion({ usuarioId, organizacionId });
    const unidad = idCanonico(unidadId);
    if (!unidad) throw new ErrorContextoUnidad('UNIDAD_INVALIDA');

    let departamento;
    try {
      departamento = await UnidadTrabajoModel.findOne({
        _id: unidad,
        organizacion: empresa.organizacionId
      }).select('_id organizacion estado').read('primary').lean();
    } catch (causa) {
      throw new ErrorContextoUnidad('CONTEXTO_UNIDAD_NO_DISPONIBLE', { cause: causa });
    }

    // No basta conocer el ID de una unidad: debe ser de la empresa comprobada.
    // Las unidades archivadas/en preparacion necesitaran su flujo de gestion.
    if (!departamento ||
        idCanonico(departamento._id) !== unidad ||
        idCanonico(departamento.organizacion) !== empresa.organizacionId ||
        departamento.estado !== 'activa') {
      throw accesoDenegado();
    }

    const base = {
      usuarioId: empresa.usuarioId,
      organizacionId: empresa.organizacionId,
      membresiaId: empresa.membresiaId,
      rolOrganizacion: empresa.rol,
      unidadId: unidad
    };

    // Supervision empresarial acordada, no Usuario.rol=admin ni pertenencia
    // ficticia a cada unidad. Las acciones sobre recursos se autorizan aparte.
    if (empresa.rol === 'administrador') {
      return Object.freeze({
        ...base,
        membresiaUnidadId: null,
        rolUnidad: null,
        origenAcceso: 'administracion_organizacion'
      });
    }

    let relaciones;
    try {
      relaciones = await MembresiaUnidadModel.find({
        unidad,
        membresia: empresa.membresiaId
      }).select('_id unidad membresia rol estado').read('primary').limit(2).lean();
    } catch (causa) {
      throw new ErrorContextoUnidad('CONTEXTO_UNIDAD_NO_DISPONIBLE', { cause: causa });
    }

    // No filtrar por estado antes: una relacion activa y otra revocada tambien
    // son una duplicidad. El indice unico aun debe probarse en Mongo real.
    if (!Array.isArray(relaciones) || relaciones.length !== 1) throw accesoDenegado();
    const pertenencia = relaciones[0];
    if (!pertenencia ||
        !idCanonico(pertenencia._id) ||
        idCanonico(pertenencia.unidad) !== unidad ||
        idCanonico(pertenencia.membresia) !== empresa.membresiaId ||
        pertenencia.estado !== 'activa' ||
        !ROLES_UNIDAD.has(pertenencia.rol)) {
      throw accesoDenegado();
    }

    // Una responsabilidad local no eleva un rol empresarial de solo consulta.
    // La combinacion contradictoria se rechaza, no se corrige silenciosamente.
    if (empresa.rol === 'consulta' && pertenencia.rol === 'coordinador') {
      throw accesoDenegado();
    }

    // Contexto interno, NO permisos para editar tareas o descargar evidencias.
    // Sin cache, pero las lecturas NO son una transaccion/bloqueo contra cambios
    // durante escrituras futuras. No usar este resultado para validar el alta
    // de otra persona: esa escritura necesita comprobar actor Y destinatario.
    return Object.freeze({
      ...base,
      membresiaUnidadId: idCanonico(pertenencia._id),
      rolUnidad: pertenencia.rol,
      origenAcceso: 'membresia_unidad'
    });
  };
}

const obtenerContextoUnidad = crearServicioContextoUnidad();

module.exports = {
  obtenerContextoUnidad,
  crearServicioContextoUnidad,
  ErrorContextoUnidad
};
