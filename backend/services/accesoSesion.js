'use strict';
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const { crearServicioSesiones } = require('./sesionesUsuario');
const sesiones = crearServicioSesiones();
const TIPO = 'sesion_persistente_v1';
const COOKIE = 'cyberaudit_token';
const PENDING = 'cyberaudit_2fa_pending';
const OPCIONES_COOKIE = Object.freeze({ httpOnly:true, secure:true, sameSite:'strict', path:'/' });
const version = usuario => usuario.sessionVersion ?? 0;
const versionValida = n => Number.isSafeInteger(n) && n >= 0;
function esPersistente(req) {
  // Solo configuración del servidor, jamás body/query/header.
  return req.app.locals.politicaSesiones !== 'legado_pruebas';
}
function leerToken(token, { permitirCaducado = false } = {}) {
  if (typeof token !== 'string' || token.length > 8192) return null;
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms:['HS256'], ignoreExpiration:permitirCaducado
    });
    if (p.tipo !== TIPO || p.pending2fa || !mongoose.isObjectIdOrHexString(p.id) ||
        !versionValida(p.sessionVersion) || typeof p.jti !== 'string' || !/^[a-f0-9]{64}$/.test(p.jti) ||
        !Number.isSafeInteger(p.exp) || !Number.isSafeInteger(p.iat) || p.exp <= p.iat) return null;
    return p;
  } catch { return null; }
}
function clave(p) {
  return { usuario:p.id, versionCredenciales:p.sessionVersion, identificador:p.jti };
}
async function iniciar(usuario, mantenerSesion) {
  // Conservar la versión con la que se verificó contraseña/MFA. Reemplazarla
  // por una versión recién leída podría validar una contraseña antigua.
  const anterior = version(usuario);
  if (!versionValida(anterior)) return null;
  const nueva = await sesiones.crear({
    usuario:usuario._id, versionCredenciales:anterior, mantenerSesion
  });
  const actual = await Usuario.findById(usuario._id)
    .select('sessionVersion emailVerifiedAt twoFactorEnabled').read('primary');
  if (!actual?.emailVerifiedAt || version(actual) !== anterior ||
      Boolean(actual.twoFactorEnabled) !== Boolean(usuario.twoFactorEnabled)) {
    await sesiones.revocar({ usuario:usuario._id, versionCredenciales:anterior, identificador:nueva.identificador });
    return null;
  }
  // Un reset posterior incrementa sessionVersion: este token conserva la
  // versión original y será rechazado por el middleware.
  const token = jwt.sign({
    tipo:TIPO, id:String(usuario._id), email:usuario.email, nombre:usuario.nombre,
    sessionVersion:anterior, jti:nueva.identificador,
    iat:Math.floor(nueva.sesion.autenticadaEn.getTime()/1000),
    exp:Math.floor(nueva.sesion.expiraEn.getTime()/1000)
  }, process.env.JWT_SECRET, { algorithm:'HS256' });
  return { token, estado:nueva, mantenerSesion };
}
function ponerCookie(res, acceso) {
  const opciones = { ...OPCIONES_COOKIE };
  if (acceso.mantenerSesion) opciones.maxAge = Math.max(0, acceso.estado.sesion.expiraEn.getTime() - Date.now());
  res.cookie(COOKIE, acceso.token, opciones);
  res.clearCookie(PENDING, OPCIONES_COOKIE);
  res.set('Cache-Control','no-store');
}
async function comprobar(token) {
  const payload = leerToken(token);
  if (!payload) return null;
  const actual = await Usuario.findById(payload.id)
    .select('sessionVersion emailVerifiedAt nombre email twoFactorEnabled createdAt').read('primary');
  if (!actual?.emailVerifiedAt || version(actual) !== payload.sessionVersion) return null;
  const estado = await sesiones.consultar(clave(payload));
  if (!estado.valida) return null;
  return { payload, estado, clave:clave(payload), usuario:{ id:String(actual._id), nombre:actual.nombre, email:actual.email, twoFactorEnabled:actual.twoFactorEnabled, createdAt:actual.createdAt } };
}
async function actividad(datos) { return sesiones.registrarActividad(datos); }
async function cerrar(token) {
  // Permitir cerrar un token caducado sin omitir la comprobación de su firma.
  const payload = leerToken(token, { permitirCaducado:true });
  if (payload) await sesiones.revocar(clave(payload));
}
function estadoPublico(estado) {
  return {
    autenticadaEn:estado.sesion.autenticadaEn, ultimaActividadEn:estado.sesion.ultimaActividadEn,
    expiraEn:estado.expiraEn, inactivaEn:estado.inactivaEn,
    limiteEfectivoEn:estado.limiteEfectivoEn, restanteMs:estado.restanteMs,
    mantenerSesion:estado.sesion.mantenerSesion
  };
}
module.exports = { esPersistente, iniciar, ponerCookie, comprobar, actividad, cerrar,
  estadoPublico, COOKIE, PENDING, OPCIONES_COOKIE };
