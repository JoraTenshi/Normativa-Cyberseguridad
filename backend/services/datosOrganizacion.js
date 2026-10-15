"use strict";
const mongoose = require("mongoose");
const MENSAJES = {
  CONTEXTO_NO_INICIADO: [404, "El administrador todavía no ha registrado el contexto de esta empresa"],
  CONTEXTO_YA_EXISTE: [409, "Ya existe un contexto; consulta su versión actual antes de actualizarlo"],
  REGLA_NO_DISPONIBLE: [404, "No hay una regla publicada disponible para este contexto"],
  REGLA_DESACTUALIZADA: [409, "La regla ha cambiado; consulta el catálogo actual antes de calcular"],
  CALCULO_NO_DISPONIBLE: [422, "No se puede calcular con estos datos y esta regla; revisa tipos, fechas y límites"],
  DATOS_INVALIDOS: [400, "Datos de organización inválidos"],
  GESTION_DENEGADA: [
    403,
    "Solo el administrador de esta empresa puede realizar esta operación",
  ],
  RECURSO_NO_DISPONIBLE: [404, "Recurso no disponible"],
  VERSION_DESACTUALIZADA: [
    409,
    "Hay una versión más reciente. Conserva tu borrador y revisa los cambios antes de guardar.",
  ],
  TRANSICION_INVALIDA: [409, "El estado actual no permite esta operación"],
  CLAVE_REUTILIZADA: [
    409,
    "La clave de reintento ya se utilizó para otra operación",
  ],
  CUOTA_DOCUMENTOS: [
    409,
    "Se ha alcanzado la cuota de documentación de la organización",
  ],
  PDF_INVALIDO: [400, "Se requiere un PDF no vacío de hasta 5 MiB"],
  SERVICIO_NO_DISPONIBLE: [
    503,
    "Servicio organizativo no disponible temporalmente",
  ],
};
class ErrorOrganizacion extends Error {
  constructor(codigo, cause) {
    super(MENSAJES[codigo][1], cause ? { cause } : undefined);
    this.codigo = codigo;
    this.status = MENSAJES[codigo][0];
  }
}
const fallo = (codigo) => {
  throw new ErrorOrganizacion(codigo);
};
function campos(v, permitidos) {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(v)) ||
    Reflect.ownKeys(v).some((k) => !permitidos.includes(k))
  )
    fallo("DATOS_INVALIDOS");
}
function id(v) {
  if (!mongoose.isObjectIdOrHexString(v)) fallo("DATOS_INVALIDOS");
  return String(v).toLowerCase();
}
function texto(v, max, opcional = false) {
  if (opcional && v === null) return null;
  if (
    typeof v !== "string" ||
    !v.trim() ||
    v.trim().length > max ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v)
  )
    fallo("DATOS_INVALIDOS");
  return v.trim();
}
function version(v) {
  if (!Number.isSafeInteger(v) || v < 0 || v >= Number.MAX_SAFE_INTEGER)
    fallo("DATOS_INVALIDOS");
  return v;
}
function clave(v) {
  if (typeof v !== "string" || !/^[a-z0-9_-]{16,100}$/i.test(v))
    fallo("DATOS_INVALIDOS");
  return v;
}
const referencia = (ref) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref,
  set: id,
});
module.exports = {
  ErrorOrganizacion,
  fallo,
  campos,
  id,
  texto,
  version,
  clave,
  referencia,
};
