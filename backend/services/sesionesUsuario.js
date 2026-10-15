'use strict';

const crypto = require('node:crypto');
const mongoose = require('mongoose');
const SesionUsuario = require('../models/SesionUsuario');
const {
  VERSION_POLITICA, DURACION_MAXIMA_MS, INACTIVIDAD_MAXIMA_MS,
  crearEstadoSesion, evaluarVigencia
} = require('./politicaSesion');

const PROYECCION = {
  _id: 0, usuario: 1, versionCredenciales: 1, versionPolitica: 1,
  autenticadaEn: 1, ultimaActividadEn: 1, expiraEn: 1,
  mantenerSesion: 1, revocadaEn: 1
};
const denegar = () => ({ valida: false, codigo: 'SESION_NO_VALIDA' });
const huella = secreto => crypto.createHash('sha256').update(secreto, 'utf8').digest('hex');
const versionValida = v => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

function clavesValidas(datos, permitidas) {
  return datos !== null && typeof datos === 'object' && !Array.isArray(datos) &&
    Object.getPrototypeOf(datos) === Object.prototype &&
    Object.keys(datos).every(k => permitidas.includes(k));
}
function idUsuario(valor) {
  if (valor instanceof mongoose.Types.ObjectId) return valor;
  if (typeof valor === 'string' && /^[a-f0-9]{24}$/.test(valor)) {
    return new mongoose.Types.ObjectId(valor);
  }
  return null;
}
function identidad(datos) {
  if (!clavesValidas(datos, ['usuario', 'versionCredenciales', 'identificador']) ||
      !idUsuario(datos.usuario) || !versionValida(datos.versionCredenciales) ||
      typeof datos.identificador !== 'string' || !/^[a-f0-9]{64}$/.test(datos.identificador)) return null;
  return {
    usuario: idUsuario(datos.usuario),
    versionCredenciales: datos.versionCredenciales,
    identificadorHash: huella(datos.identificador)
  };
}
function respuesta(documento, ahora) {
  if (!documento) return denegar();
  const estado = evaluarVigencia(documento, ahora);
  if (!estado.valida) return denegar();
  // Lista permitida: no devolver documento Mongo, hash ni identificador original.
  return {
    ...estado,
    sesion: {
      usuario: String(documento.usuario),
      autenticadaEn: documento.autenticadaEn,
      ultimaActividadEn: documento.ultimaActividadEn,
      expiraEn: documento.expiraEn,
      mantenerSesion: documento.mantenerSesion
    }
  };
}

// Servicio INTERNO. El llamador debe completar contraseña/MFA y obtener usuario
// y versionCredenciales de la cuenta actual en servidor, NO de req.body ni de un
// JWT sin verificar. Aquí no se comprueba existencia del usuario, MFA ni permisos.
// No conectar este módulo a HTTP hasta completar ese contrato en el bloque 3.
function crearServicioSesiones({ Modelo = SesionUsuario, relojPruebas } = {}) {
  if (relojPruebas !== undefined && typeof relojPruebas !== 'function') {
    throw new TypeError('relojPruebas debe ser una función interna de pruebas');
  }
  function fechaPruebas() {
    const fecha = relojPruebas();
    if (!(fecha instanceof Date) || !Number.isFinite(fecha.getTime())) {
      throw new TypeError('Reloj de pruebas inválido');
    }
    return new Date(fecha.getTime());
  }
  // $$NOW es el reloj de Mongo dentro de la operación, no el de la petición.
  // La sustitución solo es una dependencia de tests, nunca una opción HTTP/env.
  const tiempoMongo = () => relojPruebas ? { $literal: fechaPruebas() } : '$$NOW';
  async function enBase(accion) {
    try {
      if (Modelo.db.readyState !== 1) throw new Error('Sin conexión');
      return await accion();
    } catch {
      // No filtrar errores del driver, consultas, hashes o credenciales.
      const error = new Error('No se puede comprobar la sesión en este momento');
      error.code = 'SESIONES_NO_DISPONIBLES';
      error.status = 503;
      throw error;
    }
  }
  function filtroVigente(clave, tiempo) {
    return {
      ...clave,
      versionPolitica: VERSION_POLITICA,
      mantenerSesion: { $type: 'bool' },
      revocadaEn: { $type: 'null' },
      autenticadaEn: { $type: 'date' },
      ultimaActividadEn: { $type: 'date' },
      expiraEn: { $type: 'date' },
      $expr: { $and: [
        { $eq: ['$expiraEn', { $add: ['$autenticadaEn', DURACION_MAXIMA_MS] }] },
        { $gte: ['$ultimaActividadEn', '$autenticadaEn'] },
        { $lt: ['$ultimaActividadEn', '$expiraEn'] },
        { $lte: ['$ultimaActividadEn', tiempo] },
        { $gt: ['$expiraEn', tiempo] },
        { $gt: [{ $add: ['$ultimaActividadEn', INACTIVIDAD_MAXIMA_MS] }, tiempo] }
      ] }
    };
  }
  async function crear(datos) {
    if (!clavesValidas(datos, ['usuario', 'versionCredenciales', 'mantenerSesion']) ||
        !idUsuario(datos.usuario) || !versionValida(datos.versionCredenciales) ||
        (Object.hasOwn(datos, 'mantenerSesion') && typeof datos.mantenerSesion !== 'boolean')) {
      throw new TypeError('Datos internos de creación de sesión inválidos');
    }
    return enBase(async () => {
      const ahora = relojPruebas ? fechaPruebas() :
        (await Modelo.db.db.command({ hello: 1 }, { readPreference: 'primary' })).localTime;
      const identificador = crypto.randomBytes(32).toString('hex');
      const documento = new Modelo({
        usuario: idUsuario(datos.usuario), identificadorHash: huella(identificador),
        versionCredenciales: datos.versionCredenciales,
        ...crearEstadoSesion({ ahora, mantenerSesion: datos.mantenerSesion ?? false })
      });
      await documento.save({ w: 'majority', j: true });
      // Se devuelve una sola vez al llamador de confianza para el transporte
      // seguro del siguiente bloque. Nunca en logs o respuestas públicas de estado.
      return { identificador, ...respuesta(documento, ahora) };
    });
  }
  async function consultar(datos) {
    const clave = identidad(datos);
    if (!clave) return denegar();
    return enBase(async () => {
      const tiempo = tiempoMongo();
      const documento = await Modelo.collection.aggregate([
        { $match: filtroVigente(clave, tiempo) },
        { $project: { ...PROYECCION, comprobadaEn: tiempo } }
      ], { readPreference: 'primary' }).next();
      return respuesta(documento, documento?.comprobadaEn);
    });
  }
  async function registrarActividad(datos) {
    const clave = identidad(datos);
    if (!clave) return denegar();
    return enBase(async () => {
      const tiempo = tiempoMongo();
      // Operación única sobre un documento. No hay read-then-save, upsert ni
      // posibilidad de poner revocadaEn a null. Las fechas y el filtro no vienen
      // del cliente. Native collection evita los casts/validadores parciales de
      // Mongoose: el filtro valida la cronología y SOLO se escriben estas fechas.
      const documento = await Modelo.collection.findOneAndUpdate(
        filtroVigente(clave, tiempo),
        [{ $set: { ultimaActividadEn: tiempo, updatedAt: tiempo } }],
        { returnDocument: 'after', includeResultMetadata: false, upsert: false,
          projection: PROYECCION, writeConcern: { w: 'majority', j: true } }
      );
      return respuesta(documento, documento?.ultimaActividadEn);
    });
  }
  async function revocar(datos) {
    const clave = identidad(datos);
    if (!clave) return { ok: false, codigo: 'SESION_NO_VALIDA' };
    return enBase(async () => {
      const tiempo = tiempoMongo();
      // Cerrar no exige que siga vigente. Un retroceso del reloj tampoco
      // debe devolver éxito dejando una sesión abierta: conservar la mayor
      // fecha mantiene la cronología y la revocación sigue siendo irreversible.
      await Modelo.collection.updateOne({
        ...clave, revocadaEn: { $type: 'null' }
      }, [{ $set: {
        revocadaEn: { $max: [tiempo, '$autenticadaEn', '$ultimaActividadEn'] },
        updatedAt: tiempo
      } }], { upsert: false, writeConcern: { w: 'majority', j: true } });
      // Idempotente: no revela si existía, había caducado o ya estaba revocada.
      return { ok: true };
    });
  }
  return Object.freeze({ crear, consultar, registrarActividad, revocar });
}

module.exports = { crearServicioSesiones };
