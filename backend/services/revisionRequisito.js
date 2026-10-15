'use strict';
// Núcleo de dominio puro C2. No es una API ni autoriza por sí mismo.
// El futuro repositorio deberá resolver TODAS las referencias, permisos vigentes,
// versiones, idempotencia y evento dentro de una transacción antes de persistir.
const { copiarJSON, objeto, exigir, mongoId, fecha, fechaCivil, zonaEvaluacion, huella, valor } = require('../validation/aplicabilidadContextual');
const { validarFicha, identificador, version, texto, lista, unicos } = require('../validation/paqueteNormativo');
const { reproducirSnapshot } = require('./aplicabilidadContextual');
const { periodo: estadoPeriodo, periodoCobertura, referenciaTemporal } = require('./calendarioAplicabilidad');
const { validarDesignacion } = require('../validation/designacionFuncional');
const { validarDocumentoExaminado, faltaDocumentoExaminado } = require('../validation/constatacionDocumento');
function hash(v) { exigir(typeof v === 'string' && /^[a-f0-9]{64}$/.test(v), 'huella_revision'); }
function ref(v, mongo = true) {
  objeto(v, ['id', 'version', 'sha256']); (mongo ? mongoId : identificador)(v.id); version(v.version); hash(v.sha256);
}
function periodo(v) {
  objeto(v, ['desde', 'hasta', 'calendario', 'jurisdiccion', 'zonaEvaluacion']);
  fechaCivil(v.desde); fechaCivil(v.hasta); exigir(v.desde < v.hasta, 'periodo_revision');
  exigir(v.calendario === 'gregoriano', 'calendario_revision'); zonaEvaluacion(v.zonaEvaluacion);
  exigir(typeof v.jurisdiccion === 'string' && /^[A-Z]{2}(?:-[A-Z0-9]{1,10})?$/.test(v.jurisdiccion), 'jurisdiccion_revision');
}
function baseRequisito(r) {
  objeto(r, ['schemaVersion', 'id', 'version', 'organizacionId', 'alcance', 'ficha', 'decisionId', 'resultado', 'sha256']);
  exigir(r.schemaVersion === 1, 'contrato_requisito'); mongoId(r.id); mongoId(r.organizacionId); version(r.version);
  ref(r.alcance); ref(r.ficha, false); mongoId(r.decisionId); hash(r.sha256);
  const { sha256, ...base } = r;
  exigir(huella(base) === sha256, 'requisito_alterado');
  const esperado = reproducirSnapshot(r.resultado.snapshot);
  exigir(huella(esperado) === huella(r.resultado), 'decision_alterada');
  exigir(esperado.decision.organizacionId === r.organizacionId, 'organizacion_requisito');
  return r;
}
function contextualizarRequisito(entrada) {
  const d = copiarJSON(entrada);
  objeto(d, ['id', 'version', 'organizacionId', 'alcance', 'decisionId', 'resultado', 'ficha']);
  const f = validarFicha(d.ficha, d.resultado.snapshot.regla);
  const r = { schemaVersion: 1, ...d, ficha: { id: f.id, version: f.version, sha256: huella(f) } };
  r.sha256 = huella(r);
  return baseRequisito(r);
}
function validarEvidencia(entrada) {
  const e = copiarJSON(entrada);
  objeto(e, ['id', 'version', 'organizacionId', 'alcanceIds', 'tipo', 'titulo', 'procedencia', 'localizador', 'periodo', 'soporte']);
  mongoId(e.id); mongoId(e.organizacionId); version(e.version); identificador(e.tipo);
  lista(e.alcanceIds, 50, 1); unicos(e.alcanceIds); e.alcanceIds.forEach(mongoId);
  texto(e.titulo, 300); texto(e.procedencia, 1000); texto(e.localizador, 1000); periodo(e.periodo);
  exigir(e.tipo !== 'designacion_versionada' || e.soporte?.tipo === 'designacion_versionada', 'designacion_sin_registro');
  if (e.soporte?.tipo === 'version_documento') {
    objeto(e.soporte, ['tipo', 'documentoId', 'versionDocumentoId', 'numero', 'sha256']);
    mongoId(e.soporte.documentoId); mongoId(e.soporte.versionDocumentoId); version(e.soporte.numero); hash(e.soporte.sha256);
  } else if (e.soporte?.tipo === 'designacion_versionada') {
    objeto(e.soporte, ['tipo', 'referencia', 'designacion']); ref(e.soporte.referencia);
    const d = validarDesignacion(e.soporte.designacion), r = e.soporte.referencia;
    exigir(e.tipo === 'designacion_versionada' && d.id === r.id && d.version === r.version &&
      huella({ designacion: d }) === r.sha256 && d.organizacionId === e.organizacionId &&
      e.alcanceIds.length === 1 && e.alcanceIds[0] === d.alcance.id, 'soporte_designacion');
  } else {
    const camposSoporte = ['tipo', 'metodo', 'realizadaEn', 'responsableRef', 'resultado', 'limitaciones'];
    objeto(e.soporte, [...camposSoporte, ...(e.tipo === 'constatacion_documento' ? ['documentoExaminado'] : [])], camposSoporte);
    exigir(e.soporte.tipo === 'comprobacion' && !['version_documento', 'designacion_versionada'].includes(e.tipo), 'soporte_evidencia');
    fecha(e.soporte.realizadaEn);
    for (const k of ['metodo', 'responsableRef', 'resultado', 'limitaciones']) texto(e.soporte[k], 2000);
    // Los registros antiguos siguen siendo legibles; una revisión favorable
    // nueva exige la referencia documental, y su ausencia invalida la vigencia.
    if (Object.hasOwn(e.soporte, 'documentoExaminado')) validarDocumentoExaminado(e.soporte.documentoExaminado);
  }
  // No clasificación por nombre del archivo, extracción IA, caducidad universal ni aprobación.
  return e;
}
function vincularActuacion(entrada) {
  const d = copiarJSON(entrada); objeto(d, ['requisito', 'actuacion']);
  const r = baseRequisito(d.requisito), a = d.actuacion;
  objeto(a, ['id', 'version', 'organizacionId']); mongoId(a.id); version(a.version); mongoId(a.organizacionId);
  exigir(a.organizacionId === r.organizacionId, 'organizacion_actuacion');
  // Una relación por pareja: la misma actuación admite varios requisitos y viceversa.
  return { organizacionId: r.organizacionId, requisitoId: r.id, actuacionId: a.id,
    versionRequisito: r.version, versionActuacion: a.version };
}
function cubrePeriodo(evidencia, evaluado) {
  return ['calendario', 'jurisdiccion', 'zonaEvaluacion'].every(k => evidencia[k] === evaluado[k]) &&
    evidencia.desde <= evaluado.desde && evidencia.hasta >= evaluado.hasta;
}
function crearRevisionRequisito(entrada) {
  const e = copiarJSON(entrada);
  objeto(e, ['id', 'version', 'requisito', 'ficha', 'evidencias', 'permiso', 'fechaRevision', 'datos']);
  mongoId(e.id); version(e.version); fecha(e.fechaRevision);
  const r = baseRequisito(e.requisito), f = validarFicha(e.ficha, r.resultado.snapshot.regla);
  exigir(f.id === r.ficha.id && f.version === r.ficha.version && huella(f) === r.ficha.sha256, 'ficha_desactualizada');
  // Es el contexto de permiso resuelto por el SERVIDOR, no req.body ni rol ENS.
  objeto(e.permiso, ['usuarioId', 'membresiaId', 'organizacionId', 'rol']);
  ['usuarioId', 'membresiaId', 'organizacionId'].forEach(k => mongoId(e.permiso[k]));
  exigir(e.permiso.organizacionId === r.organizacionId && e.permiso.rol === 'administrador', 'revision_no_autorizada');
  exigir(r.resultado.decision.habilitaEvaluacion === true && r.resultado.decision.estado === 'aplica' &&
    r.resultado.decision.cobertura?.estado === 'dentro_de_cobertura', 'revision_no_habilitada');
  exigir(e.fechaRevision >= r.resultado.decision.fechaEvaluacion, 'revision_anterior_decision');
  const regla = r.resultado.snapshot.regla;
  exigir(estadoPeriodo(regla, e.fechaRevision) === 'en_periodo' &&
    periodoCobertura(regla, e.fechaRevision) === 'en_periodo', 'decision_temporal_desactualizada');
  const d = e.datos;
  objeto(d, ['requisito', 'tipo', 'periodo', 'criterios', 'conclusion', 'motivo', ...(f.schemaVersion === 2 ? ['ruta'] : [])]);
  let ruta = null, hechosRuta = [], criteriosExigidos = f.criterios.map(c => c.id);
  if (f.schemaVersion === 2) {
    objeto(d.ruta, ['id', 'motivo']); identificador(d.ruta.id); texto(d.ruta.motivo, 2000);
    ruta = f.satisfaccion.rutas.find(x => x.id === d.ruta.id); exigir(ruta, 'ruta_no_admitida');
    criteriosExigidos = ruta.requiereTodos;
    const hechos = new Map(r.resultado.snapshot.contexto.hechos.map(h => [h.clave, h]));
    for (const def of f.satisfaccion.hechos) {
      const h = hechos.get(def.clave);
      if (h?.estado === 'conocido') valor(h.valor, def.tipo);
      if (h?.estado === 'conflictivo') h.alternativas.forEach(a => valor(a.valor, def.tipo));
    }
    hechosRuta = ruta.hechosRequeridos.map(g => {
      const h = hechos.get(g.clave);
      return { clave: g.clave, esperado: g.valor,
        hecho: h || { clave: g.clave, estado: 'desconocido', motivo: 'no_aportado' },
        estado: h?.estado === 'conocido' ? (h.valor === g.valor ? 'coincide' : 'no_coincide') :
          h?.estado === 'conflictivo' ? 'en_conflicto' : 'desconocido' };
    });
  }
  ref(d.requisito); exigir(d.requisito.id === r.id && d.requisito.version === r.version && d.requisito.sha256 === r.sha256,
    'version_requisito_desactualizada');
  exigir(d.tipo === 'interna', 'tipo_revision_no_implementado'); periodo(d.periodo); texto(d.motivo, 2000);
  const v = r.resultado.snapshot.regla.vigencia, p = r.resultado.snapshot.regla.cobertura.periodo;
  exigir(v.tipo === 'fecha_civil' && ['calendario', 'jurisdiccion', 'zonaEvaluacion'].every(k => d.periodo[k] === v[k]),
    'periodo_ambito_no_coincide');
  const hoy = referenciaTemporal(regla, e.fechaRevision).fechaCivil;
  const diaSiguiente = new Date(Date.parse(hoy + 'T12:00:00.000Z') + 86400000).toISOString().slice(0, 10);
  exigir(d.periodo.desde <= hoy && d.periodo.hasta <= diaSiguiente, 'periodo_futuro');
  for (const limite of [v, p].filter(Boolean)) exigir(
    (limite.desde === null || d.periodo.desde >= limite.desde) && (limite.hasta === null || d.periodo.hasta <= limite.hasta),
    'periodo_fuera_de_cobertura');
  lista(e.evidencias, 80); unicos(e.evidencias.map(x => x.id));
  const evidencias = new Map(e.evidencias.map(x => { const ev = validarEvidencia(x); return [ev.id, ev]; }));
  for (const ev of evidencias.values()) {
    exigir(ev.organizacionId === r.organizacionId && ev.alcanceIds.includes(r.alcance.id), 'evidencia_fuera_de_ambito');
    if (ev.soporte.tipo === 'comprobacion') exigir(ev.soporte.realizadaEn <= e.fechaRevision, 'evidencia_futura');
  }
  lista(d.criterios, 80, 1); unicos(d.criterios.map(c => c.criterioId));
  exigir(d.criterios.length === criteriosExigidos.length && criteriosExigidos.every(id => d.criterios.some(x => x.criterioId === id)),
    'criterios_incompletos');
  const usados = new Set();
  for (const c of d.criterios) {
    objeto(c, ['criterioId', 'resultado', 'motivo', 'evidenciaIds', ...(ruta ? ['compatibilidad'] : [])]);
    identificador(c.criterioId); texto(c.motivo, 2000);
    // Las alternativas solo existen en fichas schema2; nunca no_procede libre.
    exigir(['favorable', 'desfavorable', 'no_determinado'].includes(c.resultado), 'resultado_criterio');
    if (ruta) {
      objeto(c.compatibilidad, ['estado', 'motivo']); texto(c.compatibilidad.motivo, 2000);
      exigir(['compatible', 'desconocida', 'en_conflicto'].includes(c.compatibilidad.estado), 'compatibilidad_evidencia');
      exigir(c.resultado !== 'favorable' || c.compatibilidad.estado === 'compatible', 'compatibilidad_no_resuelta');
    }
    lista(c.evidenciaIds, 40, c.resultado === 'favorable' ? 1 : 0); unicos(c.evidenciaIds);
    const criterio = f.criterios.find(x => x.id === c.criterioId);
    for (const id of c.evidenciaIds) {
      mongoId(id); const ev = evidencias.get(id);
      exigir(ev && criterio.tiposEvidencia.includes(ev.tipo), 'evidencia_tipo_o_referencia');
      exigir(c.resultado !== 'favorable' || !faltaDocumentoExaminado(ev), 'documento_subyacente_no_identificado');
      exigir(cubrePeriodo(ev.periodo, d.periodo), 'evidencia_periodo_insuficiente'); usados.add(id);
      if (ev.soporte.tipo === 'designacion_versionada') {
        const des = ev.soporte.designacion, obj = r.resultado.snapshot.contexto;
        exigir(huella(des.alcance) === huella(r.alcance) && des.objeto.tipo === obj.objeto.tipo &&
          des.objeto.id === obj.objeto.id && des.objeto.version === obj.version, 'designacion_otro_objeto');
        const ejercicio = { ...des.periodo, hasta: des.periodo.hasta || d.periodo.hasta };
        exigir(cubrePeriodo(ejercicio, d.periodo), 'designacion_periodo_insuficiente');
        exigir(c.resultado !== 'favorable' || des.estado === 'identificada', 'designacion_no_resuelta');
      }
    }
  }
  exigir(usados.size === evidencias.size, 'evidencia_no_revisada');
  const conclusion = d.criterios.every(c => c.resultado === 'favorable') ? 'favorable' :
    d.criterios.some(c => c.resultado === 'desfavorable') ? 'desfavorable' : 'no_determinado';
  exigir(d.conclusion === conclusion, 'conclusion_incoherente');
  exigir(conclusion !== 'favorable' || hechosRuta.every(h => h.estado === 'coincide'), 'hechos_ruta_no_resueltos');
  const salida = { schemaVersion: f.schemaVersion, id: e.id, version: e.version, organizacionId: r.organizacionId,
    requisito: { id: r.id, version: r.version, sha256: r.sha256 }, alcance: r.alcance, ficha: r.ficha,
    decisionId: r.decisionId, fechaRevision: e.fechaRevision,
    revisor: { usuarioId: e.permiso.usuarioId, membresiaId: e.permiso.membresiaId },
    tipo: d.tipo, periodo: d.periodo, criterios: d.criterios, conclusion, motivo: d.motivo,
    evidencias: [...evidencias.values()], esCertificacion: false, dictamenJuridicoProfesional: false,
    ...(ruta ? { ruta: { id: ruta.id, motivo: d.ruta.motivo, requiereTodos: ruta.requiereTodos, hechos: hechosRuta },
      criteriosFueraRuta: f.criterios.filter(c => !criteriosExigidos.includes(c.id)).map(c => ({ criterioId: c.id,
        estado: 'no_exigido_por_ruta', motivo: 'No forma parte de la alternativa seleccionada ' + ruta.id })) } : {}) };
  return { ...salida, sha256: huella(salida) };
}
function vigenciaRevision(entrada) {
  const e = copiarJSON(entrada); objeto(e, ['revision', 'requisitoActual', 'evidenciasActuales', 'fechaConsulta']);
  fecha(e.fechaConsulta);
  const rv = e.revision, { sha256, ...base } = rv;
  hash(sha256); exigir(huella(base) === sha256, 'revision_alterada');
  const r = baseRequisito(e.requisitoActual);
  exigir(rv.organizacionId === r.organizacionId && rv.requisito.id === r.id, 'revision_otro_requisito');
  lista(e.evidenciasActuales, 80); unicos(e.evidenciasActuales.map(x => x.id));
  const actuales = new Map(e.evidenciasActuales.map(x => [x.id, validarEvidencia(x)]));
  exigir([...actuales.values()].every(x => x.organizacionId === r.organizacionId), 'evidencia_fuera_de_ambito');
  const motivos = [];
  // El periodo factual revisado no es la vigencia legal de la regla ni la
  // caducidad de un documento. Un juicio sobre el día A no acredita el día B.
  periodo(rv.periodo);
  const fechaCivilConsulta = referenciaTemporal({ contratoVersion: 2,
    vigencia: { estado: 'definida', tipo: 'fecha_civil', ...rv.periodo } }, e.fechaConsulta).fechaCivil;
  const estadoCobertura = fechaCivilConsulta < rv.periodo.desde ? 'antes_del_periodo' :
    fechaCivilConsulta >= rv.periodo.hasta ? 'despues_del_periodo' : 'dentro_del_periodo';
  const coberturaPeriodo = { periodo: copiarJSON(rv.periodo), fechaCivilConsulta,
    estado: estadoCobertura, cubreFechaConsulta: estadoCobertura === 'dentro_del_periodo' };
  if (!coberturaPeriodo.cubreFechaConsulta) motivos.push('fecha_consulta_fuera_del_periodo_revisado');
  if (r.version !== rv.requisito.version || r.sha256 !== rv.requisito.sha256) motivos.push('requisito_o_fundamento_modificado');
  if (!r.resultado.decision.habilitaEvaluacion) motivos.push('evaluacion_no_habilitada');
  if (e.fechaConsulta < rv.fechaRevision) motivos.push('reloj_anterior_revision');
  if (estadoPeriodo(r.resultado.snapshot.regla, e.fechaConsulta) !== 'en_periodo' ||
    periodoCobertura(r.resultado.snapshot.regla, e.fechaConsulta) !== 'en_periodo') motivos.push('periodo_no_habilitado');
  for (const ev of rv.evidencias) {
    if (faltaDocumentoExaminado(ev)) motivos.push('documento_subyacente_no_identificado:' + ev.id);
    const actual = actuales.get(ev.id);
    if (!actual) motivos.push('evidencia_no_disponible:' + ev.id);
    else if (huella(actual) !== huella(ev)) motivos.push('evidencia_modificada:' + ev.id);
  }
  return { conclusionHistorica: rv.conclusion, coberturaPeriodo, requiereRevision: motivos.length > 0, motivos,
    satisfaccionActual: motivos.length ? 'requiere_revision' : rv.conclusion };
}
module.exports = { contextualizarRequisito, validarEvidencia, vincularActuacion, crearRevisionRequisito, vigenciaRevision };
