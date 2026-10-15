'use strict';
const { copiarJSON, objeto, ErrorAplicabilidad } = require('./aplicabilidadContextual');
const base = require('./contextoEmpresa');
const { ErrorOrganizacion, fallo, id, texto } = require('../services/datosOrganizacion');
const tiene = (o, k) => Object.hasOwn(o, k);
function preparar(datos, actualizacion, clave) {
  try {
    const d = copiarJSON(datos);
    objeto(d, actualizacion
      ? ['version', 'nombre', 'descripcion', 'subespacioId', 'cambios', 'motivo']
      : ['nombre', 'descripcion', 'subespacioId', 'hechos', 'motivo'],
    actualizacion ? ['version', 'motivo'] : ['nombre', 'descripcion', 'hechos', 'motivo']);
    const metadatos = {};
    for (const [k, max] of [['nombre', 120], ['descripcion', 500]]) {
      if (!actualizacion || tiene(d, k)) metadatos[k] = texto(d[k], max);
    }
    if (!actualizacion || tiene(d, 'subespacioId'))
      metadatos.subespacioId = d.subespacioId == null ? null : id(d.subespacioId);
    if (actualizacion && !tiene(d, 'cambios') && !Object.keys(metadatos).length) fallo('DATOS_INVALIDOS');
    // Reutiliza exactamente límites, motivos, tipos y protección de procedencia.
    const b = base.preparar(actualizacion && tiene(d, 'cambios')
      ? { version: d.version, cambios: d.cambios, motivo: d.motivo }
      : { hechos: actualizacion ? [] : d.hechos, motivo: d.motivo },
    actualizacion && tiene(d, 'cambios'), clave);
    return { ...metadatos, motivo: b.motivo, clave: b.clave,
      ...(actualizacion ? { version: base.numero(d.version), cambios: b.cambios || [] } : { hechos: b.hechos }) };
  } catch (e) {
    if (e instanceof ErrorAplicabilidad) throw new ErrorOrganizacion('DATOS_INVALIDOS', e);
    throw e;
  }
}
function validarContenido(entrada) {
  try {
    const d = copiarJSON(entrada);
    objeto(d, ['nombre', 'descripcion', 'subespacioId', 'hechos']);
    for (const [k, max] of [['nombre', 120], ['descripcion', 500]])
      if (texto(d[k], max) !== d[k]) return false;
    if (d.subespacioId !== null && id(d.subespacioId) !== d.subespacioId) return false;
    return base.validarHechosGuardados(d.hechos);
  } catch { return false; }
}
module.exports = { preparar, validarContenido };
