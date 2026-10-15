'use strict';
const { copiarJSON, validarRegla, exigir } = require('../validation/aplicabilidadContextual');
// Catálogo cargado exclusivamente por código del servidor. Sin JSON del cliente,
// rutas de importación, flags de demo o fixtures en producción.
function crearCatalogo(reglas) {
  exigir(Array.isArray(reglas) && reglas.length <= 100, 'catalogo');
  const actuales = new Map(), versiones = new Set();
  for (const entrada of reglas) {
    const regla = validarRegla(copiarJSON(entrada));
    const clave = regla.id + ':' + regla.version;
    exigir(!versiones.has(clave), 'version_regla_duplicada');
    versiones.add(clave);
    const previa = actuales.get(regla.id);
    if (!previa || regla.version > previa.version) actuales.set(regla.id, regla);
  }
  const actual = id => actuales.has(id) ? copiarJSON(actuales.get(id)) : null;
  return Object.freeze({
    actual,
    listar: () => [...actuales.values()].filter(r => r.estado === 'revisada').map(r => ({
      id: r.id, version: r.version, naturaleza: r.naturaleza, origenes: [...r.origenes],
      tiposObjeto: [...r.tiposObjeto], fuentes: copiarJSON(r.fuentes), vigencia: copiarJSON(r.vigencia),
      ...(r.contratoVersion === 2 ? { contratoVersion: 2, cobertura: copiarJSON(r.cobertura) } : {})
    })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  });
}
// Vacío deliberadamente hasta revisar y aprobar reglas reales. La etiqueta
// "revisada" valida coherencia técnica; no acredita una revisión jurídica.
const catalogo = crearCatalogo([]);
module.exports = { crearCatalogo, catalogo };
