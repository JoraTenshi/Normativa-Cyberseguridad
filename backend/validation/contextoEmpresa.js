'use strict';
const { copiarJSON, objeto, exigir, valor, huella, ErrorAplicabilidad } = require('./aplicabilidadContextual');
const { ErrorOrganizacion, fallo, clave } = require('../services/datosOrganizacion');
const MAX_HECHOS = 200, MAX_CAMBIOS = 50, MAX_BYTES = 40 * 1024;
const motivos = ['no_aportado', 'no_sabe', 'por_consultar'];
function numero(v) {
  if (!Number.isSafeInteger(v) || v < 1 || v > 999999999) fallo('DATOS_INVALIDOS');
  return v;
}
function numeroURL(v) {
  if (typeof v !== 'string' || !/^[1-9][0-9]{0,8}$/.test(v)) fallo('DATOS_INVALIDOS');
  return numero(Number(v));
}
function valorHecho(v) {
  const tipo = typeof v === 'boolean' ? 'booleano' :
    typeof v === 'number' ? 'numero' : typeof v === 'string' ? 'texto' :
    Array.isArray(v) ? 'lista_textos' : null;
  exigir(tipo !== null, 'valor_hecho');
  valor(v, tipo);
}
function hecho(h, interno = false) {
  exigir(h && typeof h === 'object', 'hecho');
  exigir(typeof h.clave === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(h.clave) &&
    !['__proto__', 'prototype', 'constructor', 'toJSON'].includes(h.clave), 'clave_hecho');
  const procedencia = p => {
    objeto(p, ['tipo', 'referencia']);
    exigir(p.tipo === 'declarado' && /^membresia:[a-f0-9]{24}$/.test(p.referencia), 'procedencia');
  };
  if (h.estado === 'conocido') {
    objeto(h, ['clave', 'estado', 'valor', ...(interno ? ['procedencia'] : [])]);
    valorHecho(h.valor);
    if (interno) procedencia(h.procedencia);
  } else if (h.estado === 'desconocido') {
    objeto(h, ['clave', 'estado', 'motivo']);
    exigir(motivos.includes(h.motivo), 'motivo');
  } else {
    objeto(h, ['clave', 'estado', 'alternativas']);
    exigir(h.estado === 'conflictivo' && Array.isArray(h.alternativas) &&
      h.alternativas.length >= 2 && h.alternativas.length <= 5, 'alternativas');
    for (const a of h.alternativas) {
      objeto(a, ['valor', ...(interno ? ['procedencia'] : [])]);
      valorHecho(a.valor);
      if (interno) procedencia(a.procedencia);
    }
    exigir(new Set(h.alternativas.map(a => huella(a.valor))).size === h.alternativas.length, 'alternativas_duplicadas');
  }
  return h;
}
function lista(hechos, max, interno, min = 0) {
  exigir(Array.isArray(hechos) && hechos.length >= min && hechos.length <= max, 'hechos');
  hechos.forEach(h => hecho(h, interno));
  exigir(new Set(hechos.map(h => h.clave)).size === hechos.length, 'claves_duplicadas');
  exigir(Buffer.byteLength(JSON.stringify(hechos)) <= MAX_BYTES, 'tamano_contexto');
  return hechos;
}
function preparar(datos, actualizacion, claveOperacion) {
  try {
    const d = copiarJSON(datos);
    objeto(d, actualizacion ? ['version', 'cambios', 'motivo'] : ['hechos', 'motivo']);
    valor(d.motivo, 'texto');
    exigir(d.motivo.length <= 300, 'motivo');
    if (actualizacion) numero(d.version);
    lista(actualizacion ? d.cambios : d.hechos, actualizacion ? MAX_CAMBIOS : MAX_HECHOS, false, actualizacion ? 1 : 0);
    return { ...d, clave: clave(claveOperacion) };
  } catch (e) {
    if (e instanceof ErrorAplicabilidad) throw new ErrorOrganizacion('DATOS_INVALIDOS', e);
    throw e;
  }
}
function validarHechosGuardados(hechos) {
  try { lista(copiarJSON(hechos), MAX_HECHOS, true); return true; } catch { return false; }
}
function combinar(anteriores, cambios, membresiaId) {
  const mapa = new Map(copiarJSON(anteriores).map(h => [h.clave, h]));
  const procedencia = { tipo: 'declarado', referencia: 'membresia:' + membresiaId };
  for (const h of cambios) {
    const copia = copiarJSON(h);
    if (h.estado === 'conocido') copia.procedencia = { ...procedencia };
    if (h.estado === 'conflictivo') copia.alternativas.forEach(a => { a.procedencia = { ...procedencia }; });
    mapa.set(h.clave, copia);
  }
  const resultado = [...mapa.values()].sort((a, b) => a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0);
  if (!validarHechosGuardados(resultado)) fallo('DATOS_INVALIDOS');
  return resultado;
}
module.exports = { preparar, combinar, validarHechosGuardados, numero, numeroURL, MAX_HECHOS, MAX_CAMBIOS, MAX_BYTES };
