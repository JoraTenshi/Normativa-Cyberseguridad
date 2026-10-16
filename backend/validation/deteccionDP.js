'use strict';
// Fachada pura. No autoriza peticiones HTTP ni resuelve referencias de Mongo.
const TIPOS = Object.freeze(['dpd', 'eipd', 'brecha']);
const MAX_BYTES = 131072;
function fail(campo) {
  const error = new Error('DETECCION_DP_INVALIDA: ' + campo);
  error.codigo = 'DETECCION_DP_INVALIDA'; error.campo = campo;
  throw error;
}
function jsonSeguro(value, depth = 0, budget = {nodes:0}) {
  if (++budget.nodes > 12000) fail('nodos');
  if (depth > 10) fail('profundidad');
  if (typeof value === 'string' && Buffer.byteLength(value,'utf8') > MAX_BYTES) fail('tamano');
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (!value || typeof value !== 'object') fail('json');
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) fail('prototipo_lista');
    if (value.length > 5000 || Object.keys(value).length !== value.length) fail('lista');
    if (Reflect.ownKeys(value).some(k => k !== 'length' && (typeof k !== 'string' || !/^(0|[1-9]\d*)$/.test(k)))) fail('lista');
    for (let i = 0; i < value.length; i += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('propiedad');
      jsonSeguro(descriptor.value, depth + 1, budget);
    }
    return;
  }
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('objeto');
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)) fail('clave');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('propiedad');
    jsonSeguro(descriptor.value, depth + 1, budget);
  }
}
function fechaCivil(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('fecha');
  const time = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) fail('fecha');
}
function validarSolicitudDeteccion(value) {
  jsonSeguro(value);
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('solicitud');
  const keys = ['tipo', 'fechaEvaluacion', 'entrada'];
  if (Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) fail('campos');
  if (!TIPOS.includes(value.tipo)) fail('tipo');
  fechaCivil(value.fechaEvaluacion);
  if (!value.entrada || Array.isArray(value.entrada) || typeof value.entrada !== 'object') fail('entrada');
  // La fecha del caso solo existe en la envoltura; no dos relojes contradictorios.
  if (Object.hasOwn(value.entrada, 'fecha') || Object.hasOwn(value.entrada, 'fechaEvaluacion')) fail('fecha_duplicada');
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BYTES) fail('tamano');
  return JSON.parse(serialized);
}
module.exports = { TIPOS, MAX_BYTES, validarSolicitudDeteccion };
