'use strict';
// Registros declarados por la organización. No conceden permisos ni prueban
// identidad civil, competencia jurídica o suficiencia por sí mismos.
const { copiarJSON, objeto, exigir, mongoId, fecha, fechaCivil, zonaEvaluacion, huella } = require('./aplicabilidadContextual');
const { identificador, version, texto, lista, unicos } = require('./paqueteNormativo');
function hash(h) { exigir(typeof h === 'string' && /^[a-f0-9]{64}$/.test(h), 'huella_designacion'); }
function ref(r) { objeto(r, ['id', 'version', 'sha256']); mongoId(r.id); version(r.version); hash(r.sha256); }
function validarSujeto(entrada) {
  const s = copiarJSON(entrada);
  objeto(s, ['schemaVersion', 'id', 'version', 'organizacionId', 'tipo', 'nombre', 'procedenciaOrganizativa', 'membresiaId']);
  exigir(s.schemaVersion === 1, 'contrato_sujeto'); mongoId(s.id); mongoId(s.organizacionId); version(s.version);
  exigir(['persona', 'punto_organizativo'].includes(s.tipo), 'tipo_sujeto');
  texto(s.nombre, 200); texto(s.procedenciaOrganizativa, 500);
  if (s.membresiaId !== null) { mongoId(s.membresiaId); exigir(s.tipo === 'persona', 'membresia_no_persona'); }
  return s;
}
function validarInstrumento(i) {
  if (i?.tipo === 'version_documento') {
    objeto(i, ['tipo', 'documentoId', 'versionDocumentoId', 'numero', 'sha256']);
    mongoId(i.documentoId); mongoId(i.versionDocumentoId); version(i.numero); hash(i.sha256);
  } else {
    objeto(i, ['tipo', 'metodo', 'realizadaEn', 'responsableRef', 'resultado', 'limitaciones']);
    exigir(i.tipo === 'comprobacion', 'tipo_instrumento'); fecha(i.realizadaEn);
    ['metodo', 'responsableRef', 'resultado', 'limitaciones'].forEach(k => texto(i[k], 2000));
  }
}
function validarDesignacion(entrada) {
  const d = copiarJSON(entrada);
  objeto(d, ['schemaVersion', 'id', 'version', 'organizacionId', 'alcance', 'objeto', 'funcionId', 'estado',
    'motivoDelEstado', 'titulares', 'instrumentos', 'periodo']);
  exigir(d.schemaVersion === 1, 'contrato_designacion'); mongoId(d.id); mongoId(d.organizacionId); version(d.version);
  ref(d.alcance); objeto(d.objeto, ['tipo', 'id', 'version', 'sha256']);
  exigir(['sistema', 'operacion'].includes(d.objeto.tipo), 'objeto_designacion');
  mongoId(d.objeto.id); version(d.objeto.version); hash(d.objeto.sha256); identificador(d.funcionId);
  exigir(['identificada', 'por_aclarar', 'en_conflicto'].includes(d.estado), 'estado_designacion');
  texto(d.motivoDelEstado, 2000); lista(d.titulares, 20, d.estado === 'identificada' ? 1 : 0);
  unicos(d.titulares.map(t => t.sujeto.id));
  for (const t of d.titulares) {
    objeto(t, ['sujeto', 'datosSujeto', 'delimitacion']); ref(t.sujeto); texto(t.delimitacion, 2000);
    const s = validarSujeto(t.datosSujeto);
    exigir(s.organizacionId === d.organizacionId && s.id === t.sujeto.id && s.version === t.sujeto.version &&
      huella({ sujeto: s }) === t.sujeto.sha256, 'sujeto_fuera_de_designacion');
  }
  lista(d.instrumentos, 20, d.estado === 'identificada' ? 1 : 0); d.instrumentos.forEach(validarInstrumento);
  unicos(d.instrumentos.map(i => huella(i)));
  objeto(d.periodo, ['desde', 'hasta', 'calendario', 'jurisdiccion', 'zonaEvaluacion']);
  fechaCivil(d.periodo.desde); if (d.periodo.hasta !== null) fechaCivil(d.periodo.hasta);
  exigir(d.periodo.hasta === null || d.periodo.desde < d.periodo.hasta, 'periodo_designacion');
  exigir(d.periodo.calendario === 'gregoriano', 'calendario_designacion'); zonaEvaluacion(d.periodo.zonaEvaluacion);
  exigir(typeof d.periodo.jurisdiccion === 'string' && /^[A-Z]{2}(?:-[A-Z0-9]{1,10})?$/.test(d.periodo.jurisdiccion), 'jurisdiccion_designacion');
  return d;
}
module.exports = { validarSujeto, validarInstrumento, validarDesignacion };
