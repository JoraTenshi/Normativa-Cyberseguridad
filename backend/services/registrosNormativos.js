'use strict';
const mongoose = require('mongoose');
const H = require('../models/RegistroNormativo'), V = require('../models/VersionRegistroNormativo');
const A = require('../models/AlcanceEvaluacion'), RA = require('../models/RevisionAlcance');
const O = require('../models/Operacion'), RO = require('../models/RevisionOperacion');
const C = require('../models/ContextoEmpresa'), S = require('../models/Subespacio');
const D = require('../models/DocumentoOrganizacion'), VD = require('../models/VersionDocumento');
const M = require('../models/Membresia'), E = require('../models/EventoOrganizacion');
const Usuario = require('../models/Usuario');
const { transaccionAdmin } = require('./transaccionOrganizacion');
const { obtenerContextoOrganizacion, ErrorContextoOrganizacion } = require('./contextoOrganizacion');
const { ErrorOrganizacion, fallo, id, campos } = require('./datosOrganizacion');
const { preparar, filtros } = require('../validation/registroNormativo');
const { combinar, numeroURL } = require('../validation/contextoEmpresa');
const { huella, copiarJSON, validarContexto, ErrorAplicabilidad } = require('../validation/aplicabilidadContextual');
const { contextoDeRevisionOperacion } = require('./operaciones');
const { evaluarAplicabilidadContextual } = require('./aplicabilidadContextual');
const { periodo, periodoCobertura } = require('./calendarioAplicabilidad');
const dominio = require('./revisionRequisito');
const { validarSujeto, validarDesignacion } = require('../validation/designacionFuncional');
const { catalogoNormativo } = require('./catalogoNormativoC2');
const { obtenerCatalogo: catalogoOrientacion } = require('../catalogo/orientacionC1');
const { TIPOS: TIPOS_ENS, INMUTABLES: INMUTABLES_ENS } = require('../validation/categorizacionEns');
const { crearExtensionEns } = require('./expedienteCategorizacionEns');
const contratoEns = require('../contracts/categorizacionEns.v1.json');
const {TIPOS: TIPOS_RAT,INMUTABLES: INMUTABLES_RAT,contrato: contratoRAT}=require('../validation/registroRAT');
const {crearExtensionRAT}=require('./expedienteRAT');
const {CLASES: CLASES_DP, contrato: contratoUnidadDP}=require('../validation/unidadDP');
const {crearExtensionUnidadDP}=require('./expedienteUnidadDP');
const {TIPOS: TIPOS_DERECHOS, contrato: contratoDerechos}=require('../validation/solicitudDerechos');
const {crearExtensionDerechos}=require('./expedienteDerechos');
const {crearExtensionDeteccionEIPD}=require('./expedienteDeteccionEIPD');
const {contrato:contratoEIPD}=require('../validation/deteccionEIPD');
const INDICES = [
  [H, 'registro_normativo_identidad_unica', { organizacion: 1, tipo: 1, clave_negocio: 1 }],
  [V, 'registro_normativo_version_unica', { registro: 1, numero: 1 }],
  [V, 'registro_normativo_reintento_unico', { organizacion: 1, clave_operacion: 1 }]
];
const q = (query, session) => query.read('primary').session(session || null).maxTimeMS(5000).lean();
const oid = () => new mongoose.Types.ObjectId();
const referencia = (h, v) => ({ id: String(h._id), version: v.numero, sha256: v.sha256 });
function integridad(h, v) {
  if (!v || String(v.organizacion) !== String(h.organizacion) || String(v.registro) !== String(h._id) ||
    v.numero > h.version_actual || huella(v.contenido) !== v.sha256) fallo('SERVICIO_NO_DISPONIBLE');
}
async function registro(org, tipo, identificador, session, n) {
  const h = await q(H.findOne({ _id: id(identificador), organizacion: org, tipo }), session);
  if (!h) fallo('RECURSO_NO_DISPONIBLE');
  const v = await q(V.findOne({ organizacion: org, registro: h._id, numero: n ?? h.version_actual }), session);
  if (!v && n !== undefined) fallo('RECURSO_NO_DISPONIBLE'); integridad(h, v); return { h, v };
}
function compararRef(ref, actual) {
  if (ref.id !== actual.id || ref.version !== actual.version || ref.sha256 !== actual.sha256) fallo('VERSION_DESACTUALIZADA');
}
async function referenciado(org, tipo, ref, session) {
  const r = await registro(org, tipo, ref.id, session); compararRef(ref, referencia(r.h, r.v)); return r;
}
// Lee el alcance verdadero y sus bases actuales. Nunca crea un alcance ficticio
// ni considera vigente un perfil cuyas operaciones/subespacios ya cambiaron.
async function alcance(org, ref, session, estricto = true) {
  const a = await q(A.findOne({ _id: id(ref.id), organizacion: org }), session);
  if (!a) fallo('RECURSO_NO_DISPONIBLE');
  const r = await q(RA.findOne({ organizacion: org, alcance: a._id, numero: a.version_actual }), session);
  if (!r || huella(r.contenido) !== r.sha256 || r.contenido.alcance.nombre !== a.nombre) fallo('SERVICIO_NO_DISPONIBLE');
  const motivos = [], actual = { id: String(a._id), version: r.numero, sha256: r.sha256 };
  if (huella(actual) !== huella(ref)) motivos.push('alcance_modificado');
  if (r.contenido.catalogo.sha256 !== catalogoOrientacion().sha256) motivos.push('orientacion_del_alcance_modificada');
  const origen = r.contenido.origen;
  const c = await q(C.findOne({ _id: origen.contextoId, organizacion: org }), session);
  if (!c || c.version_actual !== origen.contextoVersion) motivos.push('contexto_del_alcance_modificado');
  for (const op of origen.operaciones) {
    const o = await q(O.findOne({ _id: op.id, organizacion: org }), session);
    if (!o || o.version_actual !== op.version) motivos.push('operacion_del_alcance_modificada:' + op.id);
  }
  for (const sub of r.contenido.alcance.subespacios) {
    const s = await q(S.findOne({ _id: sub.id, organizacion: org, estado: 'activo' }), session);
    if (!s || s.__v !== sub.version) motivos.push('subespacio_del_alcance_modificado:' + sub.id);
  }
  if (estricto && motivos.length) fallo('VERSION_DESACTUALIZADA');
  return { a, r, actual, motivos };
}
async function contextoObjetoBase(org, objeto, ar, session) {
  if (objeto.tipo === 'operacion') {
    if (!ar.r.contenido.origen.operaciones.some(o => o.id === objeto.id)) fallo('RECURSO_NO_DISPONIBLE');
    const o = await q(O.findOne({ _id: objeto.id, organizacion: org }), session);
    if (!o) fallo('RECURSO_NO_DISPONIBLE');
    const r = await q(RO.findOne({ organizacion: org, operacion: o._id, numero: o.version_actual }), session);
    if (o.version_actual !== objeto.version) fallo('VERSION_DESACTUALIZADA');
    return { contexto: contextoDeRevisionOperacion(o, r), objetoSha256: r.sha256 };
  }
  if(objeto.tipo!=='sistema')fallo('DATOS_INVALIDOS');
  const { h, v } = await registro(org, 'sistema', objeto.id, session);
  if (h.version_actual !== objeto.version) fallo('VERSION_DESACTUALIZADA');
  compararRef(v.contenido.alcance, ar.actual);
  return { contexto: validarContexto({ id: 'ctx_sis_' + h._id, version: v.numero,
    organizacionId: String(org), objeto: { tipo: 'sistema', id: String(h._id) },
    registradoEn: new Date(v.createdAt).toISOString(), hechos: v.contenido.hechos }), objetoSha256: v.sha256 };
}
async function soporteDocumento(org, soporte, session) {
  const d = await q(D.findOne({ _id: soporte.documentoId, organizacion: org, estado: 'activo' }), session);
  const v = await q(VD.findOne({ _id: soporte.versionDocumentoId, organizacion: org, documento: soporte.documentoId }), session);
  if (!d || !v) fallo('RECURSO_NO_DISPONIBLE');
  // Se fija la versión revisada; no se envían bytes ni se deduce suficiencia.
  return { tipo: 'version_documento', documentoId: String(d._id), versionDocumentoId: String(v._id), numero: v.numero, sha256: v.sha256 };
}
function crearServicioRegistros({ catalogo = catalogoNormativo, reloj = () => new Date() } = {}) {
  const ens = crearExtensionEns({ alcance, referenciado, registro, designacionActual, evidenciaActual, referencia, compararRef, q, reloj });
  const rat = crearExtensionRAT({alcance,referenciado,registro,evidenciaActual,referencia,compararRef,q,reloj});
  const unidadDP = crearExtensionUnidadDP({alcance,referenciado,registro,evidenciaActual,referencia,compararRef,q});
  const derechos = crearExtensionDerechos({alcance,referenciado,registro,evidenciaActual,referencia,compararRef,q,reloj});
  const deteccionEIPD = crearExtensionDeteccionEIPD({alcance,registro,evidenciaActual,referencia,compararRef,q,reloj});
  const contextoObjeto=(org,objeto,ar,session)=>CLASES_DP.includes(objeto.tipo)
    ? unidadDP.contexto(org,objeto,ar,session) : TIPOS_DERECHOS.includes(objeto.tipo)
      ? derechos.contexto(org,objeto,ar,session) : contextoObjetoBase(org,objeto,ar,session);
  async function admin(e) { const p = await obtenerContextoOrganizacion(e); if (p.rol !== 'administrador') fallo('GESTION_DENEGADA'); return p; }
  async function leer(e, fn) {
    try {
      const p = await admin(e);
      const salida = await mongoose.connection.transaction(session => fn(p, session), {
        readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000
      });
      const actual = await admin(e); if (actual.membresiaId !== p.membresiaId) fallo('GESTION_DENEGADA'); return salida;
    } catch (err) {
      if (err instanceof ErrorOrganizacion || err instanceof ErrorContextoOrganizacion) throw err;
      throw new ErrorOrganizacion('SERVICIO_NO_DISPONIBLE', err);
    }
  }
  async function fundamentos(org, contenido, session) {
    const r = contenido.requisito, motivos = [];
    const ar = await alcance(org, r.alcance, session, false); motivos.push(...ar.motivos);
    const p = catalogo.obtener(r.ficha.id);
    if (!p || p.sha256 !== contenido.paquete.sha256) motivos.push('ficha_modificada_o_retirada');
    if (periodo(r.resultado.snapshot.regla, reloj().toISOString()) !== r.resultado.decision.temporal ||
      periodoCobertura(r.resultado.snapshot.regla, reloj().toISOString()) !== r.resultado.decision.cobertura.temporal)
      motivos.push('periodo_modificado');
    try {
      const obj = await contextoObjeto(org, contenido.objeto, ar, session);
      if (obj.objetoSha256 !== contenido.objetoSha256) motivos.push('contexto_objeto_modificado');
    } catch (err) {
      if (['VERSION_DESACTUALIZADA', 'RECURSO_NO_DISPONIBLE'].includes(err.codigo)) motivos.push('contexto_objeto_modificado');
      else throw err;
    }
    return motivos;
  }
  async function evidenciaActual(org, ref, session, exigirActual = false) {
    const ev = await registro(org, 'evidencia', ref.id, session);
    if (exigirActual) compararRef(ref, referencia(ev.h, ev.v));
    const e = ev.v.contenido.evidencia;
    const motivos = [];
    for (const refAlcance of ev.v.contenido.alcances) {
      const ar = await alcance(org, refAlcance, session, false);
      motivos.push(...ar.motivos.map(m => 'ambito_evidencia:' + e.id + ':' + m));
    }
    if (e.soporte.tipo === 'version_documento') {
      const d = await q(D.findOne({ _id: e.soporte.documentoId, organizacion: org }), session);
      const v = await q(VD.findOne({ _id: e.soporte.versionDocumentoId, organizacion: org, documento: e.soporte.documentoId }), session);
      if (!d || d.estado !== 'activo' || !v || v.sha256 !== e.soporte.sha256 || v.numero !== e.soporte.numero)
        motivos.push('soporte_no_disponible:' + e.id);
      else if (d.version_actual !== e.soporte.numero) motivos.push('documento_con_nueva_version:' + e.id);
    }
    if (e.soporte.tipo === 'designacion_versionada') {
      const des = await designacionActual(org, e.soporte.referencia, session);
      if (huella(e.soporte.referencia) !== huella(referencia(des.h, des.v))) motivos.push('designacion_modificada:' + e.id);
      motivos.push(...des.motivos);
    }
    if (exigirActual && motivos.length) fallo('VERSION_DESACTUALIZADA');
    return { ...ev, evidencia: e, motivos };
  }
  async function designacionActual(org, ref, session, exigirActual = false) {
    const des = await registro(org, 'designacion', ref.id, session);
    if (exigirActual) compararRef(ref, referencia(des.h, des.v));
    const d = validarDesignacion(des.v.contenido.designacion), motivos = [];
    const ar = await alcance(org, d.alcance, session, false); motivos.push(...ar.motivos);
    try {
      const obj = await contextoObjeto(org, d.objeto, ar, session);
      if (obj.objetoSha256 !== d.objeto.sha256) motivos.push('objeto_designacion_modificado');
    } catch (e) {
      if (['VERSION_DESACTUALIZADA', 'RECURSO_NO_DISPONIBLE'].includes(e.codigo)) motivos.push('objeto_designacion_modificado');
      else throw e;
    }
    for (const t of d.titulares) {
      const actual = await registro(org, 'sujeto_funcional', t.sujeto.id, session);
      if (huella(referencia(actual.h, actual.v)) !== huella(t.sujeto)) motivos.push('sujeto_designacion_modificado:' + t.sujeto.id);
    }
    for (const i of d.instrumentos.filter(i => i.tipo === 'version_documento')) {
      const doc = await q(D.findOne({ _id: i.documentoId, organizacion: org }), session);
      const v = await q(VD.findOne({ _id: i.versionDocumentoId, organizacion: org, documento: i.documentoId }), session);
      if (!doc || doc.estado !== 'activo' || !v || v.sha256 !== i.sha256 || v.numero !== i.numero)
        motivos.push('instrumento_designacion_no_disponible:' + i.documentoId);
      else if (doc.version_actual !== i.numero) motivos.push('instrumento_designacion_con_nueva_version:' + i.documentoId);
    }
    if (exigirActual && motivos.length) fallo('VERSION_DESACTUALIZADA');
    return { ...des, designacion: d, motivos };
  }
  async function satisfaccion(org, req, session, revisionEspecifica) {
    const fundamentosCambiados = await fundamentos(org, req.v.contenido, session);
    const revisionId = revisionEspecifica || req.h.ultima_revision;
    if (!revisionId) return { conclusionHistorica: null, coberturaPeriodo: null, avisosCobertura: [], satisfaccionActual: fundamentosCambiados.length ? 'requiere_revision' : 'sin_revisar',
      requiereRevision: fundamentosCambiados.length > 0, motivos: fundamentosCambiados, esCertificacion: false };
    const rv = await registro(org, 'revision', revisionId, session), revision = rv.v.contenido.revision;
    if (revision.requisito.id !== String(req.h._id)) fallo('SERVICIO_NO_DISPONIBLE');
    const actuales = [], motivos = [...fundamentosCambiados];
    for (const ev of revision.evidencias) {
      const actual = await evidenciaActual(org, { id: ev.id }, session);
      actuales.push(actual.evidencia); motivos.push(...actual.motivos);
    }
    const estado = dominio.vigenciaRevision({ revision, requisitoActual: req.v.contenido.requisito,
      evidenciasActuales: actuales, fechaConsulta: reloj().toISOString() });
    motivos.push(...estado.motivos);
    return { ...estado, revisionId: String(rv.h._id), esCertificacion: false, motivos: [...new Set(motivos)],
      requiereRevision: motivos.length > 0, satisfaccionActual: motivos.length ? 'requiere_revision' : estado.satisfaccionActual };
  }
  async function dto(h, v, session, repetida = false) {
    integridad(h, v); const org = String(h.organizacion);
    const r = { id: String(h._id), tipo: h.tipo, version: v.numero, versionActual: h.version_actual,
      referencia: referencia(h, v), contenido: copiarJSON(v.contenido), repetida,
      revision: { id: String(v._id), numero: v.numero, actorId: String(v.actor), membresiaId: String(v.membresia_actor),
        registradoEn: new Date(v.createdAt).toISOString(), motivo: v.motivo },
      permisos: { consultar: true, crear: true, actualizar: h.tipo !== 'revision' && !INMUTABLES_ENS.includes(h.tipo) && !INMUTABLES_RAT.includes(h.tipo), revisar: ['requisito','categorizacion_ens','registro_rat'].includes(h.tipo),
        ...(TIPOS_ENS.includes(h.tipo) ? {determinar:h.tipo==='categorizacion_ens'} : {}) },
      horaServidor: reloj().toISOString() };
    if (h.tipo === 'requisito') {
      const actual = v.numero === h.version_actual ? { h, v } : await registro(org, 'requisito', h._id, session);
      r.estadoRevision = await satisfaccion(org, actual, session);
      r.estadoRevision.seRefiereAVersionActual = actual.v.numero; // nunca atribuirla al snapshot antiguo mostrado
      r.evaluabilidad = { habilitaEvaluacion: actual.v.contenido.requisito.resultado.decision.habilitaEvaluacion,
        fundamentosActuales: (await fundamentos(org, actual.v.contenido, session)).length === 0,
        seRefiereAVersionActual: actual.v.numero };
    } else if (h.tipo === 'revision') {
      const req = await registro(org, 'requisito', v.contenido.revision.requisito.id, session);
      r.estadoRevision = await satisfaccion(org, req, session, h._id);
    } else if (h.tipo === 'sistema') r.vigencia = await alcance(org, v.contenido.alcance, session, false).then(a => ({ requiereRevision: !!a.motivos.length, motivos: a.motivos }));
    else if (h.tipo === 'evidencia') r.vigencia = await evidenciaActual(org, { id: String(h._id) }, session).then(e => ({ requiereRevision: !!e.motivos.length, motivos: e.motivos, seRefiereAVersionActual: h.version_actual }));
    else if (h.tipo === 'designacion') r.vigencia = await designacionActual(org, { id: String(h._id) }, session).then(d => ({ requiereRevision: !!d.motivos.length, motivos: d.motivos, seRefiereAVersionActual: h.version_actual }));
    else if (TIPOS_ENS.includes(h.tipo)) Object.assign(r, await ens.estado(org,h,v,session));
    else if (TIPOS_RAT.includes(h.tipo)) Object.assign(r, await rat.estado(org,h,v,session));
    else if (h.tipo==='unidad_dp') Object.assign(r, await unidadDP.estado(org,h,v,session));
    else if (TIPOS_DERECHOS.includes(h.tipo)) Object.assign(r, await derechos.estado(org,h,v,session));
    else if (h.tipo==='deteccion_eipd') Object.assign(r,await deteccionEIPD.estado(org,h,v,session));
    return r;
  }
  async function construir(tipo, d, ctx, h, versionId, n) {
    const org = ctx.contexto.organizacionId, session = ctx.session, registroId = String(h._id);
    const ahora = reloj().toISOString();
    if (TIPOS_ENS.includes(tipo)) return ens.construir(tipo,d,ctx,h,n);
    if (TIPOS_RAT.includes(tipo)) return rat.construir(tipo,d,ctx,h,n);
    if (tipo==='unidad_dp') return unidadDP.construir(d,ctx,h,n);
    if (TIPOS_DERECHOS.includes(tipo)) return derechos.construir(tipo,d,ctx,h,n);
    if (tipo==='deteccion_eipd') return deteccionEIPD.construir(d,ctx,h,n);
    if (tipo === 'sujeto_funcional') {
      if (d.membresiaId !== null && !await q(M.findOne({ _id: d.membresiaId, organizacion: org, estado: 'activa' }), session)) fallo('RECURSO_NO_DISPONIBLE');
      if (n > 1) {
        const anterior = await registro(org, tipo, h._id, session);
        if (anterior.v.contenido.sujeto.tipo !== d.tipo) fallo('DATOS_INVALIDOS');
      }
      const sujeto = validarSujeto({ schemaVersion: 1, id: registroId, version: n, organizacionId: org,
        tipo: d.tipo, nombre: d.nombre, procedenciaOrganizativa: d.procedenciaOrganizativa, membresiaId: d.membresiaId });
      return { contenido: { sujeto }, titulo: sujeto.nombre, alcanceIds: [], requisitoIds: [] };
    }
    if (tipo === 'designacion') {
      const ar = await alcance(org, d.alcance, session), obj = await contextoObjeto(org, d.objeto, ar, session);
      const titulares = [];
      for (const t of d.titulares) {
        const s = await referenciado(org, 'sujeto_funcional', t.sujeto, session);
        titulares.push({ ...t, datosSujeto: s.v.contenido.sujeto });
      }
      const instrumentos = [];
      for (const i of d.instrumentos) {
        if (i.tipo === 'version_documento') {
          const soporte = await soporteDocumento(org, i, session);
          const doc = await q(D.findOne({ _id: soporte.documentoId, organizacion: org }), session);
          if (doc.version_actual !== soporte.numero) fallo('VERSION_DESACTUALIZADA');
          instrumentos.push(soporte);
        } else {
          if (i.realizadaEn > ahora) fallo('DATOS_INVALIDOS');
          instrumentos.push({ ...i, responsableRef: 'membresia:' + ctx.contexto.membresiaId });
        }
      }
      const designacion = validarDesignacion({ schemaVersion: 1, id: registroId, version: n, organizacionId: org,
        alcance: d.alcance, objeto: { ...d.objeto, sha256: obj.objetoSha256 }, funcionId: d.funcionId,
        estado: d.estado, motivoDelEstado: d.motivoDelEstado, titulares, instrumentos, periodo: d.periodo });
      return { contenido: { designacion }, titulo: 'Designación: ' + designacion.funcionId, alcanceIds: [d.alcance.id], requisitoIds: [] };
    }
    if (tipo === 'sistema') {
      await alcance(org, d.alcance, session);
      return { contenido: { nombre: d.nombre, descripcion: d.descripcion, alcance: d.alcance,
        hechos: combinar([], d.hechos, ctx.contexto.membresiaId) }, titulo: d.nombre, alcanceIds: [d.alcance.id], requisitoIds: [] };
    }
    if (tipo === 'requisito') {
      const ar = await alcance(org, d.alcance, session), p = catalogo.obtener(d.ficha.id);
      if (!p) fallo('REGLA_NO_DISPONIBLE');
      if (p.ficha.version !== d.ficha.version) fallo('REGLA_DESACTUALIZADA');
      const obj = await contextoObjeto(org, d.objeto, ar, session);
      let resultado;
      try { resultado = evaluarAplicabilidadContextual({ organizacionId: org, regla: p.regla, contexto: obj.contexto, fechaEvaluacion: ahora }); }
      catch (err) { if (err instanceof ErrorAplicabilidad) throw new ErrorOrganizacion('CALCULO_NO_DISPONIBLE', err); throw err; }
      const requisito = dominio.contextualizarRequisito({ id: registroId, version: n, organizacionId: org,
        alcance: ar.actual, decisionId: String(versionId), resultado, ficha: p.ficha });
      return { contenido: { requisito, paquete: p, objeto: d.objeto, objetoSha256: obj.objetoSha256 },
        titulo: p.ficha.titulo, alcanceIds: [d.alcance.id], requisitoIds: [] };
    }
    if (tipo === 'actuacion') {
      const miembro = await q(M.findOne({ _id: d.responsableMembresiaId, organizacion: org, estado: 'activa' }), session);
      if (!miembro) fallo('RECURSO_NO_DISPONIBLE');
      const relaciones = [], alcanceIds = [];
      for (const ref of d.requisitos) {
        const req = await referenciado(org, 'requisito', ref, session);
        relaciones.push(dominio.vincularActuacion({ requisito: req.v.contenido.requisito,
          actuacion: { id: registroId, version: n, organizacionId: org } }));
        alcanceIds.push(req.v.contenido.requisito.alcance.id);
      }
      if (d.estado === 'archivada') {
        if (n === 1) fallo('TRANSICION_INVALIDA');
        const previa = await registro(org, 'actuacion', h._id, session);
        if (!['terminada', 'archivada'].includes(previa.v.contenido.estado)) fallo('TRANSICION_INVALIDA');
      }
      return { contenido: { titulo: d.titulo, descripcion: d.descripcion, estado: d.estado,
        responsableMembresiaId: d.responsableMembresiaId, relaciones, efectoSobreSatisfaccion: 'ninguno' },
        titulo: d.titulo, alcanceIds: [...new Set(alcanceIds)], requisitoIds: d.requisitos.map(r => r.id) };
    }
    if (tipo === 'evidencia') {
      for (const a of d.alcances) await alcance(org, a, session);
      let soporte;
      if (d.soporte.tipo === 'version_documento') soporte = await soporteDocumento(org, d.soporte, session);
      else if (d.soporte.tipo === 'designacion_versionada') {
        const des = await designacionActual(org, d.soporte.referencia, session, true);
        soporte = { tipo: d.soporte.tipo, referencia: referencia(des.h, des.v), designacion: des.designacion };
      } else soporte = { ...d.soporte, responsableRef: 'membresia:' + ctx.contexto.membresiaId };
      const evidencia = dominio.validarEvidencia({ id: registroId, version: n, organizacionId: org,
        alcanceIds: d.alcances.map(a => a.id), tipo: d.tipo, titulo: d.titulo, procedencia: d.procedencia,
        localizador: d.localizador, periodo: d.periodo, soporte });
      if (soporte.tipo === 'comprobacion' && soporte.realizadaEn > ahora) fallo('DATOS_INVALIDOS');
      return { contenido: { evidencia, alcances: d.alcances }, titulo: evidencia.titulo,
        alcanceIds: evidencia.alcanceIds, requisitoIds: [] };
    }
    const req = await referenciado(org, 'requisito', d.requisito, session);
    if ((await fundamentos(org, req.v.contenido, session)).length) fallo('VERSION_DESACTUALIZADA');
    const evidencias = [];
    for (const ref of d.evidencias) evidencias.push((await evidenciaActual(org, ref, session, true)).evidencia);
    const interno = req.v.contenido.requisito;
    const revision = dominio.crearRevisionRequisito({ id: registroId, version: 1, requisito: interno,
      ficha: req.v.contenido.paquete.ficha, evidencias,
      permiso: { usuarioId: ctx.contexto.usuarioId, membresiaId: ctx.contexto.membresiaId, organizacionId: org, rol: ctx.contexto.rol },
      fechaRevision: ahora, datos: { requisito: { id: interno.id, version: interno.version, sha256: interno.sha256 },
        tipo: d.tipo, periodo: d.periodo, criterios: d.criterios, conclusion: d.conclusion, motivo: d.motivo,
        ...(Object.hasOwn(d, 'ruta') ? { ruta: d.ruta } : {}) } });
    await H.updateOne({ _id: req.h._id, organizacion: org, tipo: 'requisito', version_actual: req.h.version_actual },
      { $set: { ultima_revision: h._id }, $inc: { __v: 1 } }, { session, runValidators: true });
    return { contenido: { revision }, titulo: ('Revisión interna: ' + req.h.titulo).slice(0, 300),
      alcanceIds: [interno.alcance.id], requisitoIds: [interno.id] };
  }
  async function guardar(e, tipo, editar = false) {
    const d = preparar(tipo, e.datos, e.clave, editar), registroId = editar ? id(e.registroId) : null;
    try {
      return await transaccionAdmin(e, INDICES, async ctx => {
        const org = ctx.contexto.organizacionId, session = ctx.session;
        const firma = huella({ tipo, registroId, datos: d, actor: ctx.contexto.usuarioId, membresia: ctx.contexto.membresiaId });
        const previa = await q(V.findOne({ organizacion: org, clave_operacion: d.clave }).select('+huella_operacion'), session);
        if (previa) {
          if (previa.huella_operacion !== firma) fallo('CLAVE_REUTILIZADA');
          const h = await q(H.findOne({ _id: previa.registro, organizacion: org, tipo }), session);
          if (!h) fallo('SERVICIO_NO_DISPONIBLE'); return dto(h, previa, session, true);
        }
        let h = editar ? (await registro(org, tipo, registroId, session)).h : { _id: oid(), organizacion: org, tipo };
        if (editar && h.version_actual !== d.version) fallo('VERSION_DESACTUALIZADA');
        if (editar && h.version_actual >= 999999999) fallo('SERVICIO_NO_DISPONIBLE');
        const identidad = tipo === 'registro_rat' ? 'rat:'+d.funcion+':'+d.alcance.id : tipo === 'categorizacion_ens' ? 'sistema:'+d.sistema.id : ['requisito', 'designacion'].includes(tipo) ?
          [d.alcance.id, d.objeto.tipo, d.objeto.id, tipo === 'requisito' ? d.ficha.id : d.funcionId].join(':') : String(h._id);
        if (editar && h.clave_negocio !== identidad) fallo('DATOS_INVALIDOS');
        if (!editar && await q(H.findOne({ organizacion: org, tipo, clave_negocio: identidad }), session)) fallo('CLAVE_REUTILIZADA');
        const n = editar ? h.version_actual + 1 : 1, versionId = oid();
        const construido = await construir(tipo, d, ctx, h, versionId, n);
        const cabecera = { titulo: construido.titulo, version_actual: n,
          alcance_ids: construido.alcanceIds, requisito_ids: construido.requisitoIds };
        if (editar) h = await q(H.findOneAndUpdate({ _id: h._id, organizacion: org, tipo, version_actual: d.version },
          { $set: cabecera, $inc: { __v: 1 } }, { session, new: true, runValidators: true }), session);
        else { [h] = await H.create([{ _id: h._id, organizacion: org, tipo, clave_negocio: identidad, ...cabecera,
          ...(construido.sistemaId ? {sistema_id:construido.sistemaId,categorizacion_id:construido.categorizacionId} : {}) }], { session }); h = h.toObject(); }
        if (!h) fallo('VERSION_DESACTUALIZADA');
        const [v] = await V.create([{ _id: versionId, organizacion: org, registro: h._id, numero: n,
          contenido: construido.contenido, sha256: huella(construido.contenido), actor: ctx.contexto.usuarioId,
          membresia_actor: ctx.contexto.membresiaId, motivo: d.motivo, clave_operacion: d.clave, huella_operacion: firma }], { session });
        await E.create([{ organizacion: org, registro_normativo: h._id, actor: ctx.contexto.usuarioId,
          membresia_actor: ctx.contexto.membresiaId, accion: editar ? 'normativa_registro_actualizado' : 'normativa_registro_creado',
          antes: editar ? { version: n - 1, tipo } : null,
          despues: { version: n, tipo, titulo: h.titulo.slice(0, 120), sha256: v.sha256 } }], { session });
        return dto(h, v.toObject(), session);
      });
    } catch (err) {
      // ErrorAplicabilidad puede venir envuelto por el adaptador transaccional.
      if (err instanceof ErrorAplicabilidad || (err.codigo === 'SERVICIO_NO_DISPONIBLE' && err.cause instanceof ErrorAplicabilidad))
        throw new ErrorOrganizacion('DATOS_INVALIDOS', err);
      throw err;
    }
  }
  async function obtener(e, tipo) {
    const n = e.numero === undefined ? undefined : numeroURL(e.numero);
    return leer(e, async (p, s) => { const r = await registro(p.organizacionId, tipo, e.registroId, s, n); return dto(r.h, r.v, s); });
  }
  async function listar(e, tipo) {
    const f = filtros(e.filtros);
    return leer(e, async (p, s) => {
      const docs = await q(H.find({ organizacion: p.organizacionId, tipo,
        ...(f.antes ? { _id: { $lt: f.antes } } : {}), ...(f.alcanceId ? { alcance_ids: f.alcanceId } : {}),
        ...(f.requisitoId ? { requisito_ids: f.requisitoId } : {}),
        ...(f.sistemaId ? {sistema_id:f.sistemaId} : {}), ...(f.categorizacionId ? {categorizacion_id:f.categorizacionId} : {}) }).sort({ _id: -1 }).limit(f.limite + 1), s);
      const filas = docs.slice(0, f.limite), registros = [];
      for (const h of filas) { const v = await q(V.findOne({ organizacion: p.organizacionId, registro: h._id, numero: h.version_actual }), s); registros.push(await dto(h, v, s)); }
      return { registros, paginacion: { limite: f.limite, hayMas: docs.length > f.limite,
        siguienteAntes: docs.length > f.limite ? String(filas.at(-1)._id) : null } };
    });
  }
  async function versiones(e, tipo) {
    const f = filtros(e.filtros, true);
    return leer(e, async (p, s) => {
      const { h } = await registro(p.organizacionId, tipo, e.registroId, s);
      const docs = await q(V.find({ organizacion: p.organizacionId, registro: h._id,
        numero: { $lte: h.version_actual, ...(f.antes ? { $lt: f.antes } : {}) } }).sort({ numero: -1 }).limit(f.limite + 1), s);
      const filas = docs.slice(0, f.limite);
      return { id: String(h._id), versionActual: h.version_actual,
        versiones: filas.map(v => ({ ...referencia(h, v), registradoEn: new Date(v.createdAt).toISOString(), motivo: v.motivo })),
        paginacion: { limite: f.limite, hayMas: docs.length > f.limite, siguienteAntes: docs.length > f.limite ? filas.at(-1).numero : null } };
    });
  }
  async function fichas(e) {
    const p = await admin(e);
    const paquete = e.fichaId ? catalogo.obtener(e.fichaId) : null;
    if (e.fichaId && !paquete) fallo('REGLA_NO_DISPONIBLE');
    const actual = await admin(e); if (actual.membresiaId !== p.membresiaId) fallo('GESTION_DENEGADA');
    return { ...(e.fichaId ? { paquete } : { paquetes: catalogo.listar() }),
      permisos: { consultar: true, contextualizar: true },
      aviso: 'Requisitos concretos con cobertura limitada; revisión editorial asistida por IA, no dictamen jurídico ni certificación. Las alternativas y sus criterios no son requisitos adicionales.' };
  }
  async function responsables(e) {
    campos(e.filtros || {}, ['limite', 'antes']);
    const f = filtros(e.filtros);
    return leer(e, async (p, session) => {
      // Agrupa ANTES de filtrar estados: no elige una pertenencia entre
      // duplicados y no confunde usuarioId con membresiaId. No expone email.
      const rows = await M.aggregate([
        { $match: { organizacion: new mongoose.Types.ObjectId(p.organizacionId) } },
        { $group: { _id: '$usuario', cantidad: { $sum: 1 }, membresia: { $first: '$_id' },
          estado: { $first: '$estado' }, rol: { $first: '$rol' } } },
        { $match: { cantidad: 1, estado: 'activa', rol: { $in: ['administrador','colaborador','consulta'] },
          ...(f.antes ? { membresia: { $lt: new mongoose.Types.ObjectId(f.antes) } } : {}) } },
        { $lookup: { from: Usuario.collection.name, localField: '_id', foreignField: '_id', as: 'persona',
          pipeline: [{ $project: { _id: 0, nombre: 1 } }] } },
        { $unwind: '$persona' }, { $sort: { membresia: -1 } }, { $limit: f.limite + 1 },
        { $project: { _id: 0, membresiaId: { $toString: '$membresia' }, nombre: '$persona.nombre', rol: 1 } }
      ]).session(session).read('primary').option({ maxTimeMS: 5000 });
      const filas = rows.slice(0, f.limite);
      return { responsables: filas, membresiaActualId: p.membresiaId,
        paginacion: { limite: f.limite, hayMas: rows.length > f.limite,
          siguienteAntes: rows.length > f.limite ? filas.at(-1).membresiaId : null },
        aviso: 'Asignar una actuación no concede permisos ni sustituye la gestión de unidades.' };
    });
  }
  async function contratoCategorizacion(e) {
    await admin(e);
    return {contrato:copiarJSON(contratoEns),permisos:{consultar:true,crear:true,actualizar:true,determinar:true,revisar:true}};
  }
  async function contratoRegistroRAT(e){const p=await admin(e);const actual=await admin(e);if(actual.membresiaId!==p.membresiaId)fallo('GESTION_DENEGADA');return {contrato:copiarJSON(contratoRAT),permisos:{consultar:true,crear:true,actualizar:true,revisar:true}};}
  async function contratoUnidadesDP(e) {const p=await admin(e);const actual=await admin(e);if(actual.membresiaId!==p.membresiaId)fallo('GESTION_DENEGADA');return {contrato:copiarJSON(contratoUnidadDP),permisos:{consultar:true,crear:true,actualizar:true}};}
  async function contratoSolicitudesDerechos(e) {const p=await admin(e);const actual=await admin(e);if(actual.membresiaId!==p.membresiaId)fallo('GESTION_DENEGADA');return {contrato:copiarJSON(contratoDerechos),permisos:{consultar:true,crear:true,actualizar:true}};}
  async function contratoDeteccionesEIPD(e) {const p=await admin(e);const actual=await admin(e);if(actual.membresiaId!==p.membresiaId)fallo('GESTION_DENEGADA');return {contrato:copiarJSON(contratoEIPD),permisos:{consultar:true,crear:true,actualizar:true}};}
  return { guardar, obtener, listar, versiones, fichas, responsables, contratoCategorizacion, contratoRegistroRAT, contratoUnidadesDP, contratoSolicitudesDerechos, contratoDeteccionesEIPD };
}
module.exports = { ...crearServicioRegistros(), crearServicioRegistros };
