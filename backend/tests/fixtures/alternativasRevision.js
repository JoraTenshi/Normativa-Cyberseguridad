'use strict';
// SOLO contenido sintético; no es una de las fichas ENS pendientes.
const { paquete: legacy, revision: anterior, oid, huella } = require('./revisionRequisito');
const { evaluarAplicabilidadContextual } = require('../../services/aplicabilidadContextual');
const { contextualizarRequisito } = require('../../services/revisionRequisito');
function paquete() {
  const p = legacy(); p.ficha.schemaVersion = 2;
  p.entrada.regla.tiposObjeto = ['sistema']; p.entrada.contexto.objeto = { tipo: 'sistema', id: oid(80) };
  p.entrada.contexto.version = 1;
  p.entrada.contexto.hechos.push({ clave: 'via_ordinaria', estado: 'conocido', valor: true,
    procedencia: { tipo: 'declarado', referencia: 'fixture' } });
  p.ficha.criterios.push({ ...structuredClone(p.ficha.criterios[0]), id: 'C3' });
  p.ficha.criterios.forEach(c => c.tiposEvidencia.push('designacion_versionada'));
  p.ficha.satisfaccion = { tipo: 'rutas_cerradas', hechos: [{ clave: 'via_ordinaria', tipo: 'booleano',
    pregunta: { id: 'P_VIA', texto: 'Hecho sintético', grupo: 'Prueba', motivo: 'No decide aplicabilidad' } }],
    rutas: [{ id: 'NORMAL', titulo: 'Ruta ficticia A', explicacion: 'Solo test', requiereTodos: ['C1','C2'],
      hechosRequeridos: [{ clave: 'via_ordinaria', valor: true }] },
    { id: 'ALTERNATIVA', titulo: 'Ruta ficticia B', explicacion: 'Solo test', requiereTodos: ['C2','C3'],
      hechosRequeridos: [{ clave: 'via_ordinaria', valor: false }] }] };
  return p;
}
function revision(mutacion = () => {}) {
  const x = anterior(), p = paquete(); mutacion(p);
  const requisito = contextualizarRequisito({ id: x.requisito.id, version: 1, organizacionId: p.entrada.organizacionId,
    alcance: x.requisito.alcance, decisionId: x.requisito.decisionId,
    resultado: evaluarAplicabilidadContextual(p.entrada), ficha: p.ficha });
  x.ficha = p.ficha; x.requisito = requisito;
  x.datos.requisito = { id: requisito.id, version: requisito.version, sha256: requisito.sha256 };
  x.datos.ruta = { id: 'NORMAL', motivo: 'Elección sintética expresamente motivada' };
  x.datos.criterios.forEach(c => { c.compatibilidad = { estado: 'compatible', motivo: 'Revisión humana sintética, no detector' }; });
  return x;
}
function sujeto(n = 90) {
  return { schemaVersion: 1, id: oid(n), version: 1, organizacionId: revision().requisito.organizacionId,
    tipo: 'persona', nombre: 'Persona ficticia', procedenciaOrganizativa: 'Cliente ficticio, declarado', membresiaId: null };
}
function designacion() {
  const x = revision(), s = sujeto();
  return { schemaVersion: 1, id: oid(91), version: 1, organizacionId: x.requisito.organizacionId,
    alcance: x.requisito.alcance, objeto: { tipo: 'sistema', id: oid(80), version: 1, sha256: 'e'.repeat(64) },
    funcionId: 'FUNCION_FICTICIA', estado: 'identificada', motivoDelEstado: 'Declaración limitada, no prueba de ejercicio',
    titulares: [{ sujeto: { id: s.id, version: 1, sha256: huella({ sujeto: s }) }, datosSujeto: s, delimitacion: 'Parte A' }],
    instrumentos: [{ tipo: 'comprobacion', metodo: 'Revisión de acta sintética', realizadaEn: x.fechaRevision,
      responsableRef: 'membresia:' + x.permiso.membresiaId, resultado: 'Constatación declarada', limitaciones: 'Sin verificar identidad real' }],
    periodo: { ...x.datos.periodo, hasta: null } };
}
function conDesignacion(mutacion = () => {}) {
  const x = revision(), d = designacion(); mutacion(d);
  x.evidencias[0].tipo = 'designacion_versionada';
  x.evidencias[0].soporte = { tipo: 'designacion_versionada', referencia: { id: d.id, version: d.version,
    sha256: huella({ designacion: d }) }, designacion: d };
  return x;
}
module.exports = { paquete, revision, sujeto, designacion, conDesignacion, oid, huella };
