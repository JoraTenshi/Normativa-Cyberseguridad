'use strict';
const C = require('../models/Operacion'), R = require('../models/RevisionOperacion');
const D = require('../models/DecisionOperacion'), E = require('../models/EventoOrganizacion');
const { catalogo: produccion } = require('./catalogoAplicabilidad');
const { transaccionAdmin } = require('./transaccionOrganizacion');
const { obtenerContextoOrganizacion, ErrorContextoOrganizacion } = require('./contextoOrganizacion');
const { contextoDeRevisionOperacion: contextoDeRevision } = require('./operaciones');
const { ErrorOrganizacion, fallo, campos, id } = require('./datosOrganizacion');
const { numeroURL } = require('../validation/contextoEmpresa');
const { preparar, reglaId, verificarResultado, periodo } = require('../validation/decisionAplicabilidad');
const { evaluarAplicabilidadContextual, compararEntradasAplicabilidad } = require('./aplicabilidadContextual');
const { ErrorAplicabilidad, huella } = require('../validation/aplicabilidadContextual');
const { periodoCobertura } = require('./calendarioAplicabilidad');
const INDICES = [
  [R, 'revision_operacion_numero_unico', { operacion: 1, numero: 1 }],
  [D, 'decision_por_operacion_numero_unico', { operacion: 1, numero: 1 }],
  [D, 'decision_por_operacion_reintento_unico', { organizacion: 1, clave_operacion: 1 }]
];
const lectura = q => q.read('primary').maxTimeMS(5000);
async function admin(entrada) {
  const permiso = await obtenerContextoOrganizacion(entrada);
  if (permiso.rol !== 'administrador') fallo('GESTION_DENEGADA');
  return permiso;
}
function comprobarGuardada(d, c) {
  if (!d || String(d.organizacion) !== String(c.organizacion) || String(d.operacion) !== String(c._id))
    fallo('RECURSO_NO_DISPONIBLE');
  try {
    verificarResultado(d.resultado);
    const x = d.resultado.decision;
    if (huella(d.resultado) !== d.sha256 || x.organizacionId !== String(d.organizacion) ||
        x.contexto.id !== 'ctx_op_' + c._id ||
        d.resultado.snapshot.contexto.objeto.tipo !== 'operacion' ||
        d.resultado.snapshot.contexto.objeto.id !== String(c._id) || x.contexto.version !== d.version_contexto ||
        x.regla.id !== d.regla_id || x.regla.version !== d.version_regla ||
        d.version_contexto > c.version_actual) fallo('SERVICIO_NO_DISPONIBLE');
  } catch (e) {
    if (e instanceof ErrorOrganizacion) throw e;
    throw new ErrorOrganizacion('SERVICIO_NO_DISPONIBLE', e);
  }
}
function resumenEvento(d) {
  return { version: d.numero, estado: d.resultado.decision.estado, temporal: d.resultado.decision.temporal,
    regla_id: d.regla_id, version_regla: d.version_regla, version_contexto: d.version_contexto, sha256: d.sha256 };
}
// Inyección solo programática para tests. HTTP/variables de entorno no seleccionan
// catálogo, reloj, autor, reglas ni resultado. El servicio por defecto usa producción.
function crearServicioDecisionesOperacion({ catalogo = produccion, reloj = () => new Date() } = {}) {
  function dto(d, c, detalle, repetida = false, ahora = reloj().toISOString()) {
    comprobarGuardada(d, c);
    const regla = catalogo.actual(d.regla_id);
    const reglaDisponible = Boolean(regla && regla.estado === 'revisada' && regla.tiposObjeto.includes('operacion'));
    const revision = {
      contextoCambiado: d.version_contexto !== c.version_actual,
      reglaCambiada: !regla || regla.version !== d.version_regla || huella(regla) !== d.resultado.decision.regla.huellaSha256,
      reglaDisponible,
      periodoCambiado: periodo(d.resultado.snapshot.regla, ahora) !== d.resultado.decision.temporal,
      relojAnteriorAlCalculo: ahora < d.resultado.decision.fechaEvaluacion
    };
    if (d.resultado.decision.cobertura) revision.coberturaPeriodoCambiado =
      periodoCobertura(d.resultado.snapshot.regla, ahora) !== d.resultado.decision.cobertura.temporal;
    revision.requiereNuevaDecision = revision.contextoCambiado || revision.reglaCambiada || !reglaDisponible ||
      revision.periodoCambiado || revision.relojAnteriorAlCalculo || revision.coberturaPeriodoCambiado === true;
    return { id: String(d._id), numero: d.numero, operacionId: String(d.operacion),
      revisionContextoId: String(d.revision_contexto), versionContexto: d.version_contexto,
      versionContextoActual: c.version_actual, reglaId: d.regla_id, versionRegla: d.version_regla,
      anteriorId: d.anterior ? String(d.anterior) : null, autorId: String(d.actor),
      membresiaAutorId: String(d.membresia_actor), motivo: d.motivo, registradoEn: new Date(d.createdAt).toISOString(),
      fechaEvaluacion: d.resultado.decision.fechaEvaluacion, estado: d.resultado.decision.estado,
      temporal: d.resultado.decision.temporal, revisionDecision: 'automatica_orientativa',
      ...(d.resultado.decision.cobertura ? { cobertura: d.resultado.decision.cobertura,
        habilitaEvaluacion: d.resultado.decision.habilitaEvaluacion, motivoCodigo: d.resultado.decision.motivoCodigo } : {}),
      sha256: d.sha256, revision, repetida, horaServidor: ahora,
      ...(detalle ? { decision: d.resultado.decision, snapshot: d.resultado.snapshot } : {}) };
  }
  async function guardarDecision(entrada) {
    const datos = preparar(entrada.datos, entrada.clave);
    return transaccionAdmin(entrada, INDICES, async ({ session, contexto: permiso }) => {
      const org = permiso.organizacionId;
      const firma = huella({ operacionId: id(entrada.operacionId), datos, usuario: permiso.usuarioId, membresia: permiso.membresiaId });
      const c = await C.findOne({ _id: id(entrada.operacionId), organizacion: org }).session(session).lean();
      if (!c) fallo('RECURSO_NO_DISPONIBLE');
      // La repetición devuelve el cálculo original incluso si después cambió el catálogo.
      const repetida = await D.findOne({ organizacion: org, clave_operacion: datos.clave })
        .select('+huella_operacion').session(session).lean();
      if (repetida) {
        if (repetida.huella_operacion !== firma) fallo('CLAVE_REUTILIZADA');
        return dto(repetida, c, true, true);
      }
      if (datos.versionContexto !== c.version_actual) fallo('VERSION_DESACTUALIZADA');
      const regla = catalogo.actual(datos.reglaId);
      if (!regla || regla.estado !== 'revisada' || !regla.tiposObjeto.includes('operacion'))
        fallo('REGLA_NO_DISPONIBLE');
      if (regla.version !== datos.versionRegla) fallo('REGLA_DESACTUALIZADA');
      const r = await R.findOne({ organizacion: org, operacion: c._id, numero: c.version_actual }).session(session).lean();
      const contexto = contextoDeRevision(c, r);
      const ahora = reloj().toISOString();
      let resultado;
      try {
        resultado = verificarResultado(evaluarAplicabilidadContextual({
          organizacionId: org, contexto, regla, fechaEvaluacion: ahora
        }));
      } catch (e) {
        if (e instanceof ErrorAplicabilidad) throw new ErrorOrganizacion('CALCULO_NO_DISPONIBLE', e);
        throw e;
      }
      const ultima = await D.findOne({ organizacion: org, operacion: c._id }).sort({ numero: -1 }).session(session).lean();
      const anterior = await D.findOne({ organizacion: org, operacion: c._id, regla_id: regla.id })
        .sort({ numero: -1 }).session(session).lean();
      if (ultima) comprobarGuardada(ultima, c);
      if (anterior) {
        comprobarGuardada(anterior, c);
        try {
          compararEntradasAplicabilidad(anterior.resultado.snapshot, {
            organizacionId: org, contexto, regla, fechaEvaluacion: ahora
          });
        } catch (e) {
          if (e instanceof ErrorAplicabilidad) throw new ErrorOrganizacion('CALCULO_NO_DISPONIBLE', e);
          throw e;
        }
      }
      const numero = (ultima?.numero || 0) + 1;
      if (numero > 999999999) fallo('SERVICIO_NO_DISPONIBLE');
      const [documento] = await D.create([{
        organizacion: org, operacion: c._id, revision_contexto: r._id, version_contexto: r.numero,
        numero, regla_id: regla.id, version_regla: regla.version, anterior: anterior?._id || null,
        actor: permiso.usuarioId, membresia_actor: permiso.membresiaId, motivo: datos.motivo,
        resultado, sha256: huella(resultado), clave_operacion: datos.clave, huella_operacion: firma
      }], { session });
      const d = documento.toObject();
      await E.create([{
        organizacion: org, operacion: c._id, decision_operacion: d._id,
        subespacios: c.subespacio ? [c.subespacio] : [],
        actor: permiso.usuarioId, membresia_actor: permiso.membresiaId, accion: 'decision_operacion_creada',
        antes: anterior ? resumenEvento(anterior) : null, despues: resumenEvento(d)
      }], { session });
      return dto(d, c, true, false, ahora);
    });
  }
  async function leer(entrada, operacion) {
    try {
      const permiso = await admin(entrada);
      const c = await lectura(C.findOne({ _id: id(entrada.operacionId), organizacion: permiso.organizacionId })).lean();
      if (!c) fallo('RECURSO_NO_DISPONIBLE');
      const datos = await operacion(c);
      const vigente = await admin(entrada);
      if (vigente.membresiaId !== permiso.membresiaId) fallo('GESTION_DENEGADA');
      return datos;
    } catch (e) {
      if (e instanceof ErrorOrganizacion || e instanceof ErrorContextoOrganizacion) throw e;
      throw new ErrorOrganizacion('SERVICIO_NO_DISPONIBLE', e);
    }
  }
  async function obtenerDecision(entrada) {
    const decisionId = id(entrada.decisionId);
    return leer(entrada, async c => {
      const d = await lectura(D.findOne({ _id: decisionId, organizacion: c.organizacion, operacion: c._id })).lean();
      return dto(d, c, true);
    });
  }
  async function listarDecisiones(entrada) {
    const f = entrada.filtros || {};
    campos(f, ['limite', 'antes', 'reglaId']);
    const limite = f.limite === undefined ? 20 : numeroURL(f.limite);
    if (limite > 100) fallo('DATOS_INVALIDOS');
    const antes = f.antes === undefined ? undefined : numeroURL(f.antes);
    const regla = f.reglaId === undefined ? undefined : reglaId(f.reglaId);
    return leer(entrada, async c => {
      const docs = await lectura(D.find({ organizacion: c.organizacion, operacion: c._id,
        ...(antes ? { numero: { $lt: antes } } : {}), ...(regla ? { regla_id: regla } : {})
      })).sort({ numero: -1 }).limit(limite + 1).lean();
      const filas = docs.slice(0, limite), hayMas = docs.length > limite, ahora = reloj().toISOString();
      return { operacionId: String(c._id), versionContextoActual: c.version_actual,
        decisiones: filas.map(d => dto(d, c, false, false, ahora)),
        paginacion: { limite, hayMas, siguienteAntes: hayMas ? filas.at(-1).numero : null } };
    });
  }
  async function listarReglas(entrada) {
    return leer(entrada, async c => {
      const reglas = catalogo.listar().filter(r => r.tiposObjeto.includes('operacion'));
      return { operacionId: String(c._id), reglas, sinReglasPublicadas: reglas.length === 0,
        aviso: 'Catálogo parcial: esta lista no acredita cobertura completa ni cumplimiento.' };
    });
  }
  return { guardarDecision, obtenerDecision, listarDecisiones, listarReglas };
}
module.exports = { ...crearServicioDecisionesOperacion(), crearServicioDecisionesOperacion, comprobarGuardada };
