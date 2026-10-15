'use strict';
const { copiarJSON, objeto, exigir, valor, fecha, huella, ErrorAplicabilidad } = require('./aplicabilidadContextual');
const { reproducirSnapshot } = require('../services/aplicabilidadContextual');
const { periodo } = require('../services/calendarioAplicabilidad');
const { numero } = require('./contextoEmpresa');
const { clave, ErrorOrganizacion, fallo } = require('../services/datosOrganizacion');
function reglaId(v) {
  if (typeof v !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(v) ||
      ['constructor', 'prototype', '__proto__', 'toJSON'].includes(v)) fallo('DATOS_INVALIDOS');
  return v;
}
function preparar(datos, claveOperacion) {
  try {
    const d = copiarJSON(datos);
    objeto(d, ['versionContexto', 'reglaId', 'versionRegla', 'motivo']);
    numero(d.versionContexto); numero(d.versionRegla); reglaId(d.reglaId);
    valor(d.motivo, 'texto'); exigir(d.motivo.length <= 300, 'motivo');
    return { ...d, clave: clave(claveOperacion) };
  } catch (e) {
    if (e instanceof ErrorAplicabilidad) throw new ErrorOrganizacion('DATOS_INVALIDOS', e);
    throw e;
  }
}
function verificarResultado(entrada) {
  // También limita el tamaño/complejidad del paquete persistido, no solo la petición HTTP.
  const r = copiarJSON(entrada);
  objeto(r, ['decision', 'snapshot']);
  const esperado = reproducirSnapshot(r.snapshot);
  exigir(huella(r) === huella(esperado), 'decision_incoherente');
  return r;
}
function resultadoValido(r) { try { verificarResultado(r); return true; } catch { return false; } }
module.exports = { preparar, reglaId, verificarResultado, resultadoValido, periodo };
