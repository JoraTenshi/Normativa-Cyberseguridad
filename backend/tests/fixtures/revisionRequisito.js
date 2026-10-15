'use strict';
// Contenido sintético, no requisito jurídico ni catálogo publicado.
const { entradaCivil } = require('./aplicabilidadC2');
const { evaluarAplicabilidadContextual } = require('../../services/aplicabilidadContextual');
const { contextualizarRequisito } = require('../../services/revisionRequisito');
const { huella } = require('../../validation/aplicabilidadContextual');
const oid = n => n.toString(16).padStart(24, '0');
function paquete() {
  const x = entradaCivil(), r = x.regla;
  const ficha = { schemaVersion: 1, paqueteId: 'DEMO_C2', id: 'REQUISITO_FICTICIO', version: 1,
    reglaId: r.id, versionRegla: r.version, titulo: 'Requisito sintético', explicacion: 'No es una obligación jurídica',
    fuentes: structuredClone(r.fuentes), criterios: ['C1', 'C2'].map(id => ({ id, descripcion: 'Criterio ficticio ' + id,
      origen: 'metodologia', fuenteIds: [r.fuentes[0].id], preceptos: [{ fuenteId: r.fuentes[0].id, localizador: 'Fixture' }],
      tiposEvidencia: ['version_documento', 'constatacion_revision'], exigeConclusionMotivada: true })),
    fuentesYCalendario: { consultaVigencia: '2020-01-01', limiteVerificacion: 'Fixture, no verificación legal' },
    usoContenido: { tipo: 'fixture', atribucion: 'Prueba', urlCondiciones: 'https://example.invalid/uso',
      advertencia: 'No normativo', incluyeISOoCCNProtegido: false },
    revisionEditorial: { actor: 'Test', tipo: 'fixture', fecha: r.revision.fecha, dictamenJuridicoProfesional: false,
      publicacion: 'no_publicable_fixture' },
    actuacionesSugeridas: [{ id: 'A1', titulo: 'Acción ficticia', funcionSugerida: 'Responsable de prueba',
      criterioCierreTarea: 'Cerrar no aprueba requisito', dependeDe: [] }],
    condicionesRevision: { unidadContada: 'Requisito', favorable: 'Todos revisados', evidencia: 'Versionada',
      aprobacionAutomatica: false, revisor: 'Miembro autorizado', caducidadUniversal: null,
      desencadenantes: ['Cambio de fundamento'], preservarHistorico: true }, limites: ['Solo prueba'] };
  return { ficha, regla: r, entrada: x };
}
function revision() {
  const p = paquete(), resultado = evaluarAplicabilidadContextual(p.entrada);
  const requisito = contextualizarRequisito({ id: oid(10), version: 1, organizacionId: p.entrada.organizacionId,
    alcance: { id: oid(20), version: 1, sha256: 'a'.repeat(64) }, decisionId: oid(30), resultado, ficha: p.ficha });
  const periodo = { desde: '2026-10-14', hasta: '2026-10-15', calendario: 'gregoriano',
    jurisdiccion: 'ES', zonaEvaluacion: 'Europe/Madrid' };
  const evidencia = { id: oid(40), version: 1, organizacionId: requisito.organizacionId, alcanceIds: [requisito.alcance.id],
    tipo: 'version_documento', titulo: 'PDF ficticio', procedencia: 'Documento del caso sintético', localizador: 'p. 2', periodo,
    soporte: { tipo: 'version_documento', documentoId: oid(50), versionDocumentoId: oid(51), numero: 1, sha256: 'b'.repeat(64) } };
  return { id: oid(60), version: 1, requisito, ficha: p.ficha, evidencias: [evidencia],
    permiso: { usuarioId: oid(70), membresiaId: oid(71), organizacionId: requisito.organizacionId, rol: 'administrador' },
    fechaRevision: '2026-10-14T13:00:00.000Z',
    datos: { requisito: { id: requisito.id, version: requisito.version, sha256: requisito.sha256 },
      tipo: 'interna', periodo, criterios: p.ficha.criterios.map(c => ({ criterioId: c.id, resultado: 'favorable',
        motivo: 'Comprobación sintética razonada, no basta nombre del PDF', evidenciaIds: [evidencia.id] })),
      conclusion: 'favorable', motivo: 'Los criterios ficticios han sido examinados expresamente' } };
}
module.exports = { paquete, revision, oid, huella };
