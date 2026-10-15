'use strict';
const { validarPaquete } = require('../validation/paqueteNormativo');
const { copiarJSON } = require('../validation/aplicabilidadContextual');
// Publicación por código del servidor, sin rutas de importación ni flags HTTP.
// Cinco requisitos concretos: no cobertura completa ENS/RGPD ni dictamen profesional.
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
  require('../catalogo/c2/ENS_POC_SERVICIO_EXTERNALIZADO.v1.json')
]);
module.exports = { catalogoNormativo, crearCatalogoNormativo };
