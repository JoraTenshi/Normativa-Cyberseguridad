'use strict';
// Datos exclusivos de tests. NO catálogo operativo, NO interpretación del RGPD.
const ORG_A = '100000000000000000000001', ORG_B = '200000000000000000000002';
const AHORA = '2026-10-09T08:00:00.000Z';
const procedencia = () => ({ tipo: 'declarado', referencia: 'fixture-sintetica' });
const conocido = (clave, valor) => ({ clave, estado: 'conocido', valor, procedencia: procedencia() });
const desconocido = clave => ({ clave, estado: 'desconocido', motivo: 'no_sabe' });
const conflicto = clave => ({ clave, estado: 'conflictivo', alternativas: [
  { valor: true, procedencia: procedencia() }, { valor: false, procedencia: procedencia() }
] });
const definicion = (clave, tipo = 'booleano') => ({ clave, tipo, pregunta: {
  id: 'P_' + clave, texto: 'Pregunta sintética sobre ' + clave + '?',
  grupo: 'Contexto sintético', motivo: 'Resolver la condición sintética ' + clave
} });
const eq = (hecho, valor = true) => ({ op: 'eq', hecho, valor });
function entrada() {
  return {
    organizacionId: ORG_A, fechaEvaluacion: AHORA,
    contexto: { id: 'CTX_A', version: 1, organizacionId: ORG_A,
      objeto: { tipo: 'operacion', id: 'operacion_A' }, registradoEn: '2026-10-08T10:00:00.000Z',
      hechos: [conocido('a', true), conocido('b', true)] },
    regla: {
      id: 'DEMO_CONDICION', version: 1, estado: 'revisada',
      revision: { revisorRef: 'revision-sintetica-no-juridica', fecha: '2026-10-08T09:00:00.000Z' },
      naturaleza: 'contrato', origenes: ['contractual'], tiposObjeto: ['operacion', 'servicio', 'organizacion'],
      fuentes: [{ id: 'DEMO_FUENTE', version: 1, editor: 'Fixture de test', titulo: 'Contrato ficticio, no normativo',
        url: 'https://example.invalid/contrato', localizador: 'Cláusula ficticia A',
        consultadaEn: '2026-10-08T08:00:00.000Z', estadoRevision: 'revisada' }],
      vigencia: { estado: 'definida', desde: '2026-01-01T00:00:00.000Z', hasta: null },
      hechos: [definicion('a'), definicion('b')],
      condicion: { op: 'and', args: [eq('a'), eq('b')] }, excepciones: []
    }
  };
}
module.exports = { entrada, conocido, desconocido, conflicto, definicion, eq, ORG_A, ORG_B, AHORA };
