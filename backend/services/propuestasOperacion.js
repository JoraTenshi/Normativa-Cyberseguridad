'use strict';
const { ErrorAplicabilidad } = require('../validation/aplicabilidadContextual');
const { ErrorOrganizacion } = require('./datosOrganizacion');
const { obtenerOperacion } = require('./operaciones');
const { obtenerBorradorRGPD28, inspeccionarBorradorRGPD28 } = require('../catalogo/propuestas/rgpd28EncargoDirecto');
// Consulta explícita del BORRADOR. No se introduce en catálogo ni persiste una decisión.
// Las respuestas se guardan por PATCH de la operación: nunca se evalúan hechos inyectados aquí.
async function consultarPropuestaRGPD28(entrada) {
  const guardada = await obtenerOperacion({ ...entrada, numero: entrada.version });
  const fechaEvaluacion = new Date().toISOString();
  const borrador = obtenerBorradorRGPD28();
  let inspeccion;
  try {
    inspeccion = inspeccionarBorradorRGPD28({ organizacionId: guardada.contexto.organizacionId,
      contexto: guardada.contexto, fechaEvaluacion });
  } catch(e) {
    if(e instanceof ErrorAplicabilidad) throw new ErrorOrganizacion('CALCULO_NO_DISPONIBLE', e);
    throw e;
  }
  return {
    operacion: guardada.operacion, versionActual: guardada.versionActual,
    versionContexto: guardada.contexto.version, revisionContextoId: guardada.revision.id,
    contexto: guardada.contexto, horaServidor: fechaEvaluacion,
    campos: borrador.hechos,
    inspeccion,
    decisionPersistida: false,
    aviso: 'Vista de borrador sobre respuestas declaradas. No determina obligaciones ni acredita cumplimiento.'
  };
}
module.exports = { consultarPropuestaRGPD28 };
