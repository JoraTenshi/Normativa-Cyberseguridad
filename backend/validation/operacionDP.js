'use strict';
const contrato = require('../contracts/operacionDP.v1.json');
const { copiarJSON, exigir, fechaCivil } = require('./aplicabilidadContextual');
const campos = new Map(contrato.campos.map(c => [c.clave, c]));

// Validación complementaria, después de la forma/procedencia/límites genéricos.
// No interpreta aplicabilidad, no hereda hechos y no transforma strings a booleanos.
function validarHechosDP(hechos) {
  for (const h of hechos) {
    const c = campos.get(h.clave);
    if (!c || h.estado === 'desconocido') continue;
    const valores = h.estado === 'conflictivo' ? h.alternativas.map(a => a.valor) : [h.valor];
    for (const v of valores) {
      if(c.formato==='fecha_civil'){fechaCivil(v);continue;}
      const valido = c.tipo === 'booleano' ? typeof v === 'boolean'
        : c.tipo === 'numero' ? Number.isSafeInteger(v) && v >= c.minimo && v <= c.maximo
        : typeof v === 'string' && c.valores.includes(v);
      exigir(valido, 'tipo_hecho_dp');
    }
  }
}
const obtenerContratoDP = () => copiarJSON(contrato);
module.exports = { validarHechosDP, obtenerContratoDP };
