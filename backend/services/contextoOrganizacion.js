'use strict';

const mongoose = require('mongoose');
const Organizacion = require('../models/Organizacion');
const Membresia = require('../models/Membresia');

// Lista deliberadamente cerrada. Reconocer un rol no le concede acciones.
const ROLES_CONOCIDOS = new Set(['administrador', 'colaborador', 'consulta']);
const ERRORES = Object.freeze({
  SESION_REQUERIDA: [401, 'Autenticación requerida'],
  ORGANIZACION_INVALIDA: [400, 'Identificador de organización inválido'],
  ACCESO_ORGANIZACION_DENEGADO: [403, 'No tienes acceso a esta organización'],
  CONTEXTO_NO_DISPONIBLE: [503, 'Servicio no disponible temporalmente']
});

class ErrorContextoOrganizacion extends Error {
  constructor(codigo, opciones) {
    const [status, mensaje] = ERRORES[codigo];
    super(mensaje, opciones);
    this.name = 'ErrorContextoOrganizacion';
    this.codigo = codigo;
    this.status = status;
  }
}

function idCanonico(valor) {
  return mongoose.isObjectIdOrHexString(valor) ? String(valor).toLowerCase() : null;
}

function accesoDenegado() {
  return new ErrorContextoOrganizacion('ACCESO_ORGANIZACION_DENEGADO');
}

// La fabrica permite sustituir SOLO los modelos en pruebas, sin conectar con BD.
// En uso normal se emplean los modelos reales. No aceptar dependencias de req.body.
function crearServicioContextoOrganizacion({
  OrganizacionModel = Organizacion,
  MembresiaModel = Membresia
} = {}) {
  // Precondicion: usuarioId procede de una sesion validada por requireAuth.
  // Este servicio no verifica JWT, correo ni 2FA: lo hace ese middleware.
  return async function obtenerContextoOrganizacion({ usuarioId, organizacionId } = {}) {
    const usuario = idCanonico(usuarioId);
    if (!usuario) throw new ErrorContextoOrganizacion('SESION_REQUERIDA');

    const organizacion = idCanonico(organizacionId);
    if (!organizacion) throw new ErrorContextoOrganizacion('ORGANIZACION_INVALIDA');

    let relaciones;
    try {
      relaciones = await MembresiaModel.find({ usuario, organizacion })
        .select('_id usuario organizacion rol estado')
        .read('primary')
        .limit(2)
        .lean();
    } catch (causa) {
      throw new ErrorContextoOrganizacion('CONTEXTO_NO_DISPONIBLE', { cause: causa });
    }

    // Sin filtrar previamente por estado: tambien detecta dos relaciones
    // contradictorias si el indice unico aun no existe. No elegir una al azar.
    if (!Array.isArray(relaciones) || relaciones.length !== 1) throw accesoDenegado();
    const membresia = relaciones[0];
    if (!membresia ||
        idCanonico(membresia.usuario) !== usuario ||
        idCanonico(membresia.organizacion) !== organizacion ||
        !idCanonico(membresia._id) ||
        membresia.estado !== 'activa' ||
        !ROLES_CONOCIDOS.has(membresia.rol)) {
      throw accesoDenegado();
    }

    let empresa;
    try {
      empresa = await OrganizacionModel.findById(organizacion)
        .select('_id estado')
        .read('primary')
        .lean();
    } catch (causa) {
      throw new ErrorContextoOrganizacion('CONTEXTO_NO_DISPONIBLE', { cause: causa });
    }

    // Mismo rechazo para empresa ausente/no habilitada o pertenencia invalida.
    // Alta/revision de empresas en preparacion tendra su propio flujo.
    if (!empresa || idCanonico(empresa._id) !== organizacion || empresa.estado !== 'activa') {
      throw accesoDenegado();
    }

    // Contexto interno de ESTA peticion, no DTO publico ni permiso sobre tareas.
    // Sin cache: cada llamada relee pertenencia/estado. No es un bloqueo atomico
    // frente a una revocacion que ocurra durante una futura escritura.
    return Object.freeze({
      usuarioId: usuario,
      organizacionId: organizacion,
      membresiaId: idCanonico(membresia._id),
      rol: membresia.rol
    });
  };
}

const obtenerContextoOrganizacion = crearServicioContextoOrganizacion();

module.exports = {
  obtenerContextoOrganizacion,
  crearServicioContextoOrganizacion,
  ErrorContextoOrganizacion
};
