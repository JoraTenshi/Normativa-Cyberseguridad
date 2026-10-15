'use strict';

const mongoose = require('mongoose');
const Organizacion = require('../models/Organizacion');
const Usuario = require('../models/Usuario');
const Membresia = require('../models/Membresia');
const UnidadTrabajo = require('../models/UnidadTrabajo');
const MembresiaUnidad = require('../models/MembresiaUnidad');
const EventoOrganizacion = require('../models/EventoOrganizacion');
const { crearServicioContextoOrganizacion, ErrorContextoOrganizacion } = require('./contextoOrganizacion');
const { crearServicioContextoUnidad, ErrorContextoUnidad } = require('./contextoUnidad');

const ERRORES = Object.freeze({
  DATOS_INVALIDOS: [400, 'Datos de gestión inválidos'],
  GESTION_DENEGADA: [403, 'No tienes permiso para esta operación'],
  RECURSO_NO_DISPONIBLE: [403, 'Recurso no disponible en esta organización'],
  VERSION_DESACTUALIZADA: [409, 'El registro ha cambiado; recarga antes de guardar'],
  TRANSICION_INVALIDA: [409, 'El cambio no está permitido desde el estado actual'],
  PERTENENCIA_EXISTENTE: [409, 'La pertenencia ya existe; modifica el registro existente'],
  ROL_INCOMPATIBLE: [409, 'Una membresía de consulta no puede coordinar una unidad'],
  GESTION_NO_DISPONIBLE: [503, 'Gestión no disponible temporalmente']
});
class ErrorGestionUnidades extends Error {
  constructor(codigo, opciones) {
    const [status, mensaje] = ERRORES[codigo];
    super(mensaje, opciones);
    this.name = 'ErrorGestionUnidades';
    this.codigo = codigo;
    this.status = status;
  }
}
const fallo = codigo => { throw new ErrorGestionUnidades(codigo); };
const propio = (objeto, campo) => Object.hasOwn(objeto, campo);
function objetoPlano(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(valor));
}
function soloCampos(valor, permitidos) {
  if (!objetoPlano(valor) || Reflect.ownKeys(valor).some(k => !permitidos.includes(k))) {
    fallo('DATOS_INVALIDOS');
  }
}
function id(valor) {
  if (!mongoose.isObjectIdOrHexString(valor)) fallo('DATOS_INVALIDOS');
  return String(valor).toLowerCase();
}
function version(valor) {
  if (!Number.isSafeInteger(valor) || valor < 0 || valor === Number.MAX_SAFE_INTEGER) fallo('DATOS_INVALIDOS');
  return valor;
}
function datosUnidad(datos, alta) {
  soloCampos(datos, ['nombre', 'descripcion']);
  if (Object.keys(datos).length === 0 || (alta && !propio(datos, 'nombre'))) fallo('DATOS_INVALIDOS');
  const salida = {};
  if (propio(datos, 'nombre')) {
    if (typeof datos.nombre !== 'string' || !datos.nombre.trim() || datos.nombre.trim().length > 120) fallo('DATOS_INVALIDOS');
    salida.nombre = datos.nombre.trim();
  }
  if (propio(datos, 'descripcion')) {
    if (datos.descripcion !== null && (typeof datos.descripcion !== 'string' || datos.descripcion.trim().length > 500)) fallo('DATOS_INVALIDOS');
    salida.descripcion = datos.descripcion === null ? null : datos.descripcion.trim();
  }
  return salida;
}
function rolUnidad(rol) {
  if (!['miembro', 'coordinador'].includes(rol)) fallo('DATOS_INVALIDOS');
  return rol;
}
const CAMBIOS_UNIDAD = Object.freeze({
  activar: { desde: ['en_preparacion'], hasta: 'activa', evento: 'unidad_activada' },
  archivar: { desde: ['en_preparacion', 'activa'], hasta: 'archivada', evento: 'unidad_archivada' },
  restaurar: { desde: ['archivada'], hasta: 'en_preparacion', evento: 'unidad_restaurada' }
});
const CAMBIOS_MIEMBRO = Object.freeze({
  activar: { desde: ['pendiente', 'suspendida'], hasta: 'activa', evento: 'miembro_activado' },
  suspender: { desde: ['activa'], hasta: 'suspendida', evento: 'miembro_suspendido' },
  revocar: { desde: ['pendiente', 'activa', 'suspendida'], hasta: 'revocada', evento: 'miembro_revocado' },
  restaurar: { desde: ['revocada'], hasta: 'pendiente', evento: 'miembro_restaurado' }
});
function transicion(tabla, accion) {
  if (typeof accion !== 'string' || !propio(tabla, accion)) fallo('DATOS_INVALIDOS');
  return tabla[accion];
}
function resumir(doc, esMiembro) {
  return esMiembro
    ? { rol: doc.rol, estado: doc.estado, version: doc.__v }
    : { nombre: doc.nombre, descripcion: doc.descripcion, estado: doc.estado, version: doc.__v };
}
function salidaUnidad(doc) {
  return { id: String(doc._id), organizacionId: String(doc.organizacion), ...resumir(doc, false) };
}
function salidaMiembro(doc) {
  return { id: String(doc._id), unidadId: String(doc.unidad), membresiaId: String(doc.membresia), ...resumir(doc, true) };
}

// No acepta dependencias ni modelos desde HTTP. Todas las colecciones deben
// pertenecer a la misma conexion; no hay fallback sin transaccion.
function crearServicioGestionUnidades({
  conexion = mongoose.connection,
  modelos = { Organizacion, Membresia, UnidadTrabajo, MembresiaUnidad, EventoOrganizacion, Usuario }
} = {}) {
  const O = modelos.Organizacion, M = modelos.Membresia, U = modelos.UnidadTrabajo;
  const P = modelos.MembresiaUnidad, E = modelos.EventoOrganizacion;

  async function comprobarIndices() {
    // No crea indices/migra datos durante una peticion. Exige los unicos
    // previos, evitando habilitar escrituras sobre una infraestructura incompleta.
    for (const [Modelo, nombre, claves] of [
      [O, 'organizacion_identificador_unico', { pais: 1, identificador_tipo: 1, identificador_valor: 1 }],
      [M, 'membresia_organizacion_usuario_unica', { organizacion: 1, usuario: 1 }],
      [P, 'membresia_unidad_pareja_unica', { unidad: 1, membresia: 1 }]
    ]) {
      const indices = await Modelo.collection.listIndexes().toArray();
      const indice = indices.find(i => i.name === nombre);
      if (!indice?.unique || indice.sparse || indice.partialFilterExpression ||
          JSON.stringify(indice.key) !== JSON.stringify(claves)) fallo('GESTION_NO_DISPONIBLE');
    }
  }

  async function bloquear(Modelo, filtro, sesion) {
    // Escritura real sobre __v para obtener conflicto/lock: releer solo dentro
    // de una transaccion NO basta contra una revocacion concurrente.
    // No cambia updatedAt: es un control interno, no una edicion del perfil.
    const doc = await Modelo.findOneAndUpdate(filtro, { $inc: { __v: 1 } },
      { session: sesion, new: true, timestamps: false }).select('_id').lean();
    if (!doc) fallo('RECURSO_NO_DISPONIBLE');
    return doc;
  }

  async function ejecutar(entrada, miembros, operacion) {
    try {
      await comprobarIndices();
      return await conexion.transaction(async sesion => {
        try {
          const resolverEmpresa = crearServicioContextoOrganizacion({
            OrganizacionModel: { findById: valor => O.findById(valor).session(sesion) },
            MembresiaModel: { find: filtro => M.find(filtro).session(sesion) }
          });
          const contexto = await resolverEmpresa(entrada);
          let contextoLocal = null;
          if (contexto.rol !== 'administrador') {
            if (!miembros) fallo('GESTION_DENEGADA');
            const resolverUnidad = crearServicioContextoUnidad({
              resolverOrganizacion: async () => contexto,
              UnidadTrabajoModel: { findOne: filtro => U.findOne(filtro).session(sesion) },
              MembresiaUnidadModel: { find: filtro => P.find(filtro).session(sesion) }
            });
            contextoLocal = await resolverUnidad(entrada);
            if (contextoLocal.rolUnidad !== 'coordinador') fallo('GESTION_DENEGADA');
          }

          // Orden estable: empresa, membresia empresarial del actor y rol local.
          // Serializa estas gestiones por empresa, aceptable para este MVP;
          // no es un lock global del proceso ni requiere cache compartida.
          await bloquear(O, { _id: contexto.organizacionId, estado: 'activa' }, sesion);
          await bloquear(M, {
            _id: contexto.membresiaId, usuario: contexto.usuarioId,
            organizacion: contexto.organizacionId, estado: 'activa', rol: contexto.rol
          }, sesion);
          // Si el coordinador se modifica a si mismo, su escritura final ya
          // bloquea ese documento y aplica la version que vio el cliente.
          if (contextoLocal && contextoLocal.membresiaUnidadId !== entrada.membresiaUnidadId) {
            await bloquear(P, {
              _id: contextoLocal.membresiaUnidadId, unidad: entrada.unidadId,
              membresia: contexto.membresiaId, estado: 'activa', rol: 'coordinador'
            }, sesion);
          }
          return await operacion({ sesion, contexto });
        } catch (error) {
          // Los resolvers de lectura encapsulan fallos de Mongo. El driver
          // necesita la causa original para reintentar TransientTransactionError.
          if (error.cause?.hasErrorLabel?.('TransientTransactionError')) throw error.cause;
          throw error;
        }
      }, { readPreference: 'primary', readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000 });
    } catch (error) {
      if ((error instanceof ErrorContextoOrganizacion || error instanceof ErrorContextoUnidad) && error.status === 503) {
        throw new ErrorGestionUnidades('GESTION_NO_DISPONIBLE', { cause: error.cause || error });
      }
      if (error instanceof ErrorGestionUnidades || error instanceof ErrorContextoOrganizacion ||
          error instanceof ErrorContextoUnidad) throw error;
      if (error.code === 11000) throw new ErrorGestionUnidades('PERTENENCIA_EXISTENTE');
      if (['ValidationError', 'CastError', 'StrictModeError'].includes(error.name)) {
        throw new ErrorGestionUnidades('DATOS_INVALIDOS', { cause: error });
      }
      throw new ErrorGestionUnidades('GESTION_NO_DISPONIBLE', { cause: error });
    }
  }

  function preparar(entrada, extras, unidad = true) {
    soloCampos(entrada, ['usuarioId', 'organizacionId', ...(unidad ? ['unidadId'] : []), ...extras]);
    // usuarioId ya debe haber sido autenticado por requireAuth.
    return { ...entrada, usuarioId: id(entrada.usuarioId),
      organizacionId: id(entrada.organizacionId), ...(unidad ? { unidadId: id(entrada.unidadId) } : {}) };
  }
  async function obtenerUnidad(entrada, sesion) {
    const doc = await U.findOne({ _id: entrada.unidadId, organizacion: entrada.organizacionId })
      .session(sesion).lean();
    if (!doc) fallo('RECURSO_NO_DISPONIBLE');
    if (!['en_preparacion', 'activa', 'archivada'].includes(doc.estado)) fallo('RECURSO_NO_DISPONIBLE');
    version(doc.__v);
    return doc;
  }
  async function guardarUnidad(doc, cambios, sesion) {
    const nueva = await U.findOneAndUpdate(
      { _id: doc._id, organizacion: doc.organizacion, __v: doc.__v, estado: doc.estado },
      { $set: cambios, $inc: { __v: 1 } },
      { session: sesion, new: true, runValidators: true }
    ).lean();
    if (!nueva) fallo('VERSION_DESACTUALIZADA');
    return nueva;
  }
  async function evento(ctx, unidad, accion, antes, despues, relacion = null) {
    await E.create([{
      organizacion: ctx.contexto.organizacionId, actor: ctx.contexto.usuarioId,
      membresia_actor: ctx.contexto.membresiaId, unidad,
      membresia_unidad: relacion, accion, antes, despues
    }], { session: ctx.sesion });
  }
  async function crearUnidad(entrada) {
    const e = preparar(entrada, ['datos'], false);
    const datos = datosUnidad(e.datos, true);
    return ejecutar(e, false, async ctx => {
      const [doc] = await U.create([{ ...datos, organizacion: e.organizacionId,
        estado: 'en_preparacion' }], { session: ctx.sesion });
      await evento(ctx, doc._id, 'unidad_creada', null, resumir(doc, false));
      return salidaUnidad(doc);
    });
  }
  async function actualizarUnidad(entrada) {
    const e = preparar(entrada, ['datos', 'versionUnidad']);
    const revision = version(e.versionUnidad), datos = datosUnidad(e.datos, false);
    return ejecutar(e, false, async ctx => {
      const doc = await obtenerUnidad(e, ctx.sesion);
      if (doc.__v !== revision) fallo('VERSION_DESACTUALIZADA');
      if (doc.estado === 'archivada') fallo('TRANSICION_INVALIDA');
      const nueva = await guardarUnidad(doc, datos, ctx.sesion);
      await evento(ctx, doc._id, 'unidad_actualizada', resumir(doc, false), resumir(nueva, false));
      return salidaUnidad(nueva);
    });
  }
  async function cambiarEstadoUnidad(entrada) {
    const e = preparar(entrada, ['accion', 'versionUnidad']);
    const revision = version(e.versionUnidad), cambio = transicion(CAMBIOS_UNIDAD, e.accion);
    return ejecutar(e, false, async ctx => {
      const doc = await obtenerUnidad(e, ctx.sesion);
      if (doc.__v !== revision) fallo('VERSION_DESACTUALIZADA');
      if (!cambio.desde.includes(doc.estado)) fallo('TRANSICION_INVALIDA');
      const nueva = await guardarUnidad(doc, { estado: cambio.hasta }, ctx.sesion);
      await evento(ctx, doc._id, cambio.evento, resumir(doc, false), resumir(nueva, false));
      return salidaUnidad(nueva);
    });
  }

  async function destino(membresiaId, ctx, permitirInactiva = false) {
    const doc = await M.findOne({ _id: membresiaId, organizacion: ctx.contexto.organizacionId })
      .session(ctx.sesion).lean();
    if (!doc || !mongoose.isObjectIdOrHexString(doc.usuario) ||
        !['administrador', 'colaborador', 'consulta'].includes(doc.rol) ||
        !['pendiente', 'activa', 'suspendida', 'revocada'].includes(doc.estado) ||
        (!permitirInactiva && doc.estado !== 'activa')) fallo('RECURSO_NO_DISPONIBLE');
    const parejas = await M.find({ usuario: doc.usuario, organizacion: doc.organizacion })
      .select('_id').session(ctx.sesion).limit(2).lean();
    if (parejas.length !== 1 || String(parejas[0]._id) !== String(doc._id)) fallo('RECURSO_NO_DISPONIBLE');
    // Bloquea la referencia empresarial del destinatario, no solo la del actor.
    await bloquear(M, {
      _id: doc._id, organizacion: doc.organizacion, usuario: doc.usuario, rol: doc.rol, estado: doc.estado
    }, ctx.sesion);
    // No conceder una pertenencia a una referencia de cuenta inexistente.
    // Revocar sigue permitido para limpiar relaciones huerfanas. No cambia
    // credenciales, rol global o verificacion: solo bloquea la referencia.
    if (!permitirInactiva) await bloquear(modelos.Usuario, { _id: doc.usuario }, ctx.sesion);
    return doc;
  }
  function comprobarRol(empresa, rol, esRevocacion = false) {
    if (!esRevocacion && empresa.rol === 'consulta' && rol === 'coordinador') fallo('ROL_INCOMPATIBLE');
  }
  async function obtenerPertenencia(e, sesion) {
    const doc = await P.findOne({ _id: e.membresiaUnidadId, unidad: e.unidadId }).session(sesion).lean();
    if (!doc || !mongoose.isObjectIdOrHexString(doc.membresia) ||
        !['miembro', 'coordinador'].includes(doc.rol) ||
        !['pendiente', 'activa', 'suspendida', 'revocada'].includes(doc.estado)) fallo('RECURSO_NO_DISPONIBLE');
    version(doc.__v);
    const parejas = await P.find({ unidad: doc.unidad, membresia: doc.membresia })
      .select('_id').session(sesion).limit(2).lean();
    if (parejas.length !== 1 || String(parejas[0]._id) !== String(doc._id)) fallo('RECURSO_NO_DISPONIBLE');
    if (doc.__v !== e.versionMembresia) fallo('VERSION_DESACTUALIZADA');
    return doc;
  }
  async function guardarPertenencia(doc, cambios, sesion) {
    const nueva = await P.findOneAndUpdate(
      { _id: doc._id, unidad: doc.unidad, membresia: doc.membresia, __v: doc.__v, estado: doc.estado },
      { $set: cambios, $inc: { __v: 1 } }, { session: sesion, new: true, runValidators: true }
    ).lean();
    if (!nueva) fallo('VERSION_DESACTUALIZADA');
    return nueva;
  }
  async function crearMembresiaUnidad(entrada) {
    const e = preparar(entrada, ['membresiaId', 'rol']);
    e.membresiaId = id(e.membresiaId);
    e.rol = rolUnidad(e.rol);
    return ejecutar(e, true, async ctx => {
      const unidad = await obtenerUnidad(e, ctx.sesion);
      if (unidad.estado === 'archivada') fallo('TRANSICION_INVALIDA');
      const empresaDestino = await destino(e.membresiaId, ctx);
      comprobarRol(empresaDestino, e.rol);
      if (await P.exists({ unidad: unidad._id, membresia: e.membresiaId }).session(ctx.sesion)) {
        fallo('PERTENENCIA_EXISTENTE');
      }
      // Tambien bloquea estado/empresa de la unidad contra archivo concurrente.
      const unidadActual = await guardarUnidad(unidad, {}, ctx.sesion);
      const [doc] = await P.create([{ unidad: unidad._id, membresia: e.membresiaId,
        rol: e.rol, estado: 'pendiente' }], { session: ctx.sesion });
      await evento(ctx, unidad._id, 'miembro_anadido', null, resumir(doc, true), doc._id);
      return { ...salidaMiembro(doc), versionUnidad: unidadActual.__v };
    });
  }
  async function cambiarRolMembresiaUnidad(entrada) {
    const e = preparar(entrada, ['membresiaUnidadId', 'versionMembresia', 'rol']);
    e.membresiaUnidadId = id(e.membresiaUnidadId);
    e.versionMembresia = version(e.versionMembresia);
    e.rol = rolUnidad(e.rol);
    return ejecutar(e, true, async ctx => {
      const unidad = await obtenerUnidad(e, ctx.sesion);
      if (unidad.estado === 'archivada') fallo('TRANSICION_INVALIDA');
      const doc = await obtenerPertenencia(e, ctx.sesion);
      if (doc.estado === 'revocada') fallo('TRANSICION_INVALIDA');
      comprobarRol(await destino(doc.membresia, ctx), e.rol);
      const unidadActual = await guardarUnidad(unidad, {}, ctx.sesion);
      const nueva = await guardarPertenencia(doc, { rol: e.rol }, ctx.sesion);
      await evento(ctx, unidad._id, 'rol_unidad_cambiado', resumir(doc, true), resumir(nueva, true), doc._id);
      return { ...salidaMiembro(nueva), versionUnidad: unidadActual.__v };
    });
  }
  async function cambiarEstadoMembresiaUnidad(entrada) {
    const e = preparar(entrada, ['membresiaUnidadId', 'versionMembresia', 'accion']);
    e.membresiaUnidadId = id(e.membresiaUnidadId);
    e.versionMembresia = version(e.versionMembresia);
    const cambio = transicion(CAMBIOS_MIEMBRO, e.accion);
    return ejecutar(e, true, async ctx => {
      const unidad = await obtenerUnidad(e, ctx.sesion);
      // Admin puede retirar una pertenencia incluso con la unidad archivada o
      // la membresia empresarial inactiva. No puede conceder acceso en ese caso.
      if (unidad.estado === 'archivada' && e.accion !== 'revocar') fallo('TRANSICION_INVALIDA');
      const doc = await obtenerPertenencia(e, ctx.sesion);
      if (!cambio.desde.includes(doc.estado)) fallo('TRANSICION_INVALIDA');
      const esRevocacion = e.accion === 'revocar';
      comprobarRol(await destino(doc.membresia, ctx, esRevocacion), doc.rol, esRevocacion);
      const unidadActual = await guardarUnidad(unidad, {}, ctx.sesion);
      const nueva = await guardarPertenencia(doc, { estado: cambio.hasta }, ctx.sesion);
      await evento(ctx, unidad._id, cambio.evento, resumir(doc, true), resumir(nueva, true), doc._id);
      return { ...salidaMiembro(nueva), versionUnidad: unidadActual.__v };
    });
  }

  // Sin endpoints, invitaciones, tareas, grupos ni borrados. Estas funciones
  // exigen identidad autenticada y gestionan solo membresias empresariales YA
  // existentes. Antes de publicar HTTP faltan contrato, CSRF e idempotencia de
  // creacion/reintentos de cliente; no reintentar a ciegas tras resultado incierto.
  return { crearUnidad, actualizarUnidad, cambiarEstadoUnidad,
    crearMembresiaUnidad, cambiarRolMembresiaUnidad, cambiarEstadoMembresiaUnidad };
}

module.exports = {
  ...crearServicioGestionUnidades(),
  crearServicioGestionUnidades,
  ErrorGestionUnidades
};
