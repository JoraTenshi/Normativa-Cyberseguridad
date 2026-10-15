'use strict';
const { copiarJSON, ErrorAplicabilidad } = require('./aplicabilidadContextual');
const { campos, id, texto, clave, fallo, ErrorOrganizacion } = require('../services/datosOrganizacion');
const { numero, numeroURL, preparar: prepararHechos } = require('./contextoEmpresa');
const { validarDocumentoExaminado } = require('./constatacionDocumento');
const tipos = ['sistema', 'requisito', 'actuacion', 'evidencia', 'revision', 'sujeto_funcional', 'designacion'];
function instrumento(d, documental = false) {
  if (d?.tipo === 'version_documento') {
    campos(d, ['tipo', 'documentoId', 'versionDocumentoId']);
    return { tipo: d.tipo, documentoId: id(d.documentoId), versionDocumentoId: id(d.versionDocumentoId) };
  }
  campos(d, ['tipo', 'metodo', 'realizadaEn', 'resultado', 'limitaciones', ...(documental ? ['documentoExaminado'] : [])]);
  if (documental) validarDocumentoExaminado(d.documentoExaminado);
  if (d.tipo !== 'comprobacion') fallo('DATOS_INVALIDOS'); return d;
}
function hash(v) { if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) fallo('DATOS_INVALIDOS'); return v; }
function ref(r) { campos(r, ['id', 'version', 'sha256']); return { id: id(r.id), version: numero(r.version), sha256: hash(r.sha256) }; }
function refs(a, min = 0) {
  if (!Array.isArray(a) || a.length < min || a.length > 50) fallo('DATOS_INVALIDOS');
  const r = a.map(ref); if (new Set(r.map(x => x.id)).size !== r.length) fallo('DATOS_INVALIDOS'); return r;
}
function preparar(tipo, entrada, k, editar = false) {
  if (!tipos.includes(tipo) || (editar && tipo === 'revision')) fallo('DATOS_INVALIDOS');
  try {
    const d = copiarJSON(entrada), extra = editar ? ['version'] : [];
    const comunes = ['motivo', ...extra];
    const permitidos = {
      sistema: ['nombre', 'descripcion', 'alcance', 'hechos'],
      requisito: ['alcance', 'objeto', 'ficha'],
      actuacion: ['titulo', 'descripcion', 'estado', 'requisitos', 'responsableMembresiaId'],
      evidencia: ['alcances', 'tipo', 'titulo', 'procedencia', 'localizador', 'periodo', 'soporte'],
      revision: ['requisito', 'evidencias', 'tipo', 'periodo', 'criterios', 'conclusion', 'ruta'],
      sujeto_funcional: ['tipo', 'nombre', 'procedenciaOrganizativa', 'membresiaId'],
      designacion: ['alcance', 'objeto', 'funcionId', 'estado', 'motivoDelEstado', 'titulares', 'instrumentos', 'periodo']
    };
    campos(d, [...comunes, ...permitidos[tipo]]);
    const r = { ...d, motivo: texto(d.motivo, tipo === 'revision' ? 2000 : 300), clave: clave(k) };
    if (editar) r.version = numero(d.version);
    if (tipo === 'sistema') {
      r.nombre = texto(d.nombre, 120); r.descripcion = texto(d.descripcion, 500); r.alcance = ref(d.alcance);
      r.hechos = prepararHechos({ hechos: d.hechos, motivo: r.motivo }, false, k).hechos;
    } else if (tipo === 'requisito') {
      r.alcance = ref(d.alcance); campos(d.objeto, ['tipo', 'id', 'version']);
      if (!['sistema', 'operacion'].includes(d.objeto.tipo)) fallo('DATOS_INVALIDOS');
      r.objeto = { tipo: d.objeto.tipo, id: id(d.objeto.id), version: numero(d.objeto.version) };
      campos(d.ficha, ['id', 'version']);
      if (typeof d.ficha.id !== 'string' || !/^[A-Z][A-Z0-9_]{0,79}$/.test(d.ficha.id)) fallo('DATOS_INVALIDOS');
      r.ficha = { id: d.ficha.id, version: numero(d.ficha.version) };
    } else if (tipo === 'actuacion') {
      r.titulo = texto(d.titulo, 300); r.descripcion = texto(d.descripcion, 2000); r.requisitos = refs(d.requisitos, 1);
      r.responsableMembresiaId = id(d.responsableMembresiaId);
      if (!['pendiente', 'en_curso', 'terminada', 'archivada'].includes(d.estado)) fallo('DATOS_INVALIDOS');
    } else if (tipo === 'sujeto_funcional') {
      r.membresiaId = d.membresiaId === null ? null : id(d.membresiaId);
    } else if (tipo === 'designacion') {
      r.alcance = ref(d.alcance); campos(d.objeto, ['tipo', 'id', 'version']);
      if (!['sistema', 'operacion'].includes(d.objeto.tipo)) fallo('DATOS_INVALIDOS');
      r.objeto = { tipo: d.objeto.tipo, id: id(d.objeto.id), version: numero(d.objeto.version) };
      if (!Array.isArray(d.titulares) || d.titulares.length > 20 || !Array.isArray(d.instrumentos) || d.instrumentos.length > 20) fallo('DATOS_INVALIDOS');
      r.titulares = d.titulares.map(t => { campos(t, ['sujeto', 'delimitacion']); return { sujeto: ref(t.sujeto), delimitacion: texto(t.delimitacion, 2000) }; });
      r.instrumentos = d.instrumentos.map(i => instrumento(i));
    } else if (tipo === 'evidencia') {
      r.alcances = refs(d.alcances, 1);
      if (d.soporte?.tipo === 'designacion_versionada') {
        campos(d.soporte, ['tipo', 'referencia']); r.soporte = { tipo: d.soporte.tipo, referencia: ref(d.soporte.referencia) };
      } else r.soporte = instrumento(d.soporte, d.tipo === 'constatacion_documento');
    } else { r.requisito = ref(d.requisito); r.evidencias = refs(d.evidencias); }
    return r;
  } catch (e) { if (e instanceof ErrorAplicabilidad) throw new ErrorOrganizacion('DATOS_INVALIDOS', e); throw e; }
}
function filtros(d = {}, historial = false) {
  campos(d, historial ? ['limite', 'antes'] : ['limite', 'antes', 'alcanceId', 'requisitoId']);
  const limite = d.limite === undefined ? 20 : numeroURL(d.limite);
  if (limite > 50) fallo('DATOS_INVALIDOS');
  return { limite, antes: d.antes === undefined ? null : historial ? numeroURL(d.antes) : id(d.antes),
    alcanceId: d.alcanceId === undefined ? null : id(d.alcanceId), requisitoId: d.requisitoId === undefined ? null : id(d.requisitoId) };
}
module.exports = { preparar, filtros, ref, tipos };
