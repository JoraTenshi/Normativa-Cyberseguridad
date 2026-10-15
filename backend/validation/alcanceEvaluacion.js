'use strict';
const { copiarJSON, ErrorAplicabilidad } = require('./aplicabilidadContextual');
const { campos, fallo, texto, id, version, clave, ErrorOrganizacion } = require('../services/datosOrganizacion');
const { numero } = require('./contextoEmpresa');
const { datos: datosSubespacio } = require('../services/subespacios');
const { slug, MAX_ACTIVIDADES } = require('../services/perfilNormativo');
function lista(v, max, fn, min = 0) {
  if (!Array.isArray(v) || v.length < min || v.length > max) fallo('DATOS_INVALIDOS');
  const r = v.map(fn);
  if (new Set(r.map(x => JSON.stringify(x))).size !== r.length) fallo('DATOS_INVALIDOS');
  return r;
}
function identificador(v) { if (!slug(v)) fallo('DATOS_INVALIDOS'); return v; }
function ref(v) { campos(v, ['id', 'version']); return { id: id(v.id), version: version(v.version) }; }
function contenido(v, materializar = false) {
  campos(v, [...(materializar ? ['clave'] : ['subespacios']), 'nombre', 'actividadIds', 'sistemas', 'informacion', 'limites', 'exclusiones', 'dependencias']);
  const r = {
    nombre: texto(v.nombre, 120), actividadIds: lista(v.actividadIds, MAX_ACTIVIDADES, identificador, 1),
    sistemas: lista(v.sistemas, 20, x => texto(x, 200)),
    informacion: lista(v.informacion, 20, x => texto(x, 200)),
    limites: v.limites === '' ? '' : texto(v.limites, 1000),
    exclusiones: lista(v.exclusiones, 20, x => { campos(x, ['elemento', 'motivo']);
      return { elemento: texto(x.elemento, 200), motivo: texto(x.motivo, 500) }; }),
    dependencias: lista(v.dependencias, 20, x => texto(x, 200))
  };
  if (materializar) r.clave = identificador(v.clave);
  else r.subespacios = lista(v.subespacios, 20, ref, 1);
  return r;
}
function preparar(entrada, k, editar = false) {
  try {
    const d = copiarJSON(entrada);
    campos(d, editar ? ['version', 'contextoVersion', 'propuestaHuella', 'datos', 'motivo'] :
      ['contextoVersion', 'propuestaHuella', 'confirmar', 'espacios', 'alcances', 'motivo']);
    numero(d.contextoVersion);
    if (typeof d.propuestaHuella !== 'string' || !/^[a-f0-9]{64}$/.test(d.propuestaHuella)) fallo('DATOS_INVALIDOS');
    const r = { contextoVersion: d.contextoVersion, propuestaHuella: d.propuestaHuella, motivo: texto(d.motivo, 300), clave: clave(k) };
    if (editar) return { ...r, version: numero(d.version), datos: contenido(d.datos) };
    if (d.confirmar !== true) fallo('DATOS_INVALIDOS');
    r.espacios = lista(d.espacios, MAX_ACTIVIDADES, s => {
      campos(s, ['actividadId', 'existente', 'nuevo']);
      identificador(s.actividadId);
      if (Object.hasOwn(s, 'existente') === Object.hasOwn(s, 'nuevo')) fallo('DATOS_INVALIDOS');
      return { actividadId: s.actividadId, ...(s.existente ? { existente: ref(s.existente) } : { nuevo: datosSubespacio(s.nuevo, true) }) };
    }, 1);
    r.alcances = lista(d.alcances, 8, a => contenido(a, true), 1);
    for (const [xs, campo] of [[r.espacios, 'actividadId'], [r.alcances, 'clave']])
      if (new Set(xs.map(x => x[campo])).size !== xs.length) fallo('DATOS_INVALIDOS');
    return r;
  } catch(e) {
    if (e instanceof ErrorAplicabilidad) throw new ErrorOrganizacion('DATOS_INVALIDOS', e);
    throw e;
  }
}
module.exports = { preparar, contenido };
