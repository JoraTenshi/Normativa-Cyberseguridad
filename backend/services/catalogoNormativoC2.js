'use strict';
const { validarPaquete } = require('../validation/paqueteNormativo');
const { copiarJSON } = require('../validation/aplicabilidadContextual');
// Publicación por código del servidor, sin rutas de importación ni flags HTTP.
// Requisitos acotados: no cobertura completa ENS/RGPD ni dictamen profesional.
function crearCatalogoNormativo(paquetes) {
  const mapa = new Map();
  for (const original of paquetes) {
    const p = validarPaquete(original), anterior = mapa.get(p.ficha.id);
    if (anterior) throw Error('Ficha duplicada en catálogo actual');
    mapa.set(p.ficha.id, p);
  }
  return Object.freeze({
    obtener: id => mapa.has(id) ? copiarJSON(mapa.get(id)) : null,
    listar: () => [...mapa.values()].map(p => copiarJSON(p))
  });
}
const catalogoNormativo = crearCatalogoNormativo([
  require('../catalogo/c2/ENS_POLITICA_SEGURIDAD.v3.json'),
  require('../catalogo/c2/RGPD28_FORMALIZACION_CONTENIDO.v3.json'),
  require('../catalogo/c2/ENS_FUNCIONES_EJERCICIO.v1.json'),
  require('../catalogo/c2/ENS_SEPARACION_SEGURIDAD_SISTEMA.v1.json'),
  require('../catalogo/c2/ENS_POC_SERVICIO_EXTERNALIZADO.v1.json'),
  require('../catalogo/c2/RGPD32_SEGURIDAD_OPERACION.v2.json'),
  require('../catalogo/c2/RGPD6_7_LICITUD_FINALIDAD.v2.json'),
  require('../catalogo/c2/RGPD44_49_TRANSFERENCIA_FLUJO.v2.json'),
  require('../catalogo/c2/RGPD12_14_TRANSPARENCIA_UNIDAD.v2.json'),
  require('../catalogo/c2/RGPD12_SOLICITUD_DERECHOS.v2.json')
]);
module.exports = { catalogoNormativo, crearCatalogoNormativo };
