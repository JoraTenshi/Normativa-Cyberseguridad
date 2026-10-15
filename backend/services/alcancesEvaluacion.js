'use strict';
const C = require('../models/ContextoEmpresa'), RC = require('../models/RevisionContextoEmpresa');
const O = require('../models/Operacion'), RO = require('../models/RevisionOperacion');
const S = require('../models/Subespacio'), E = require('../models/EventoOrganizacion');
const A = require('../models/AlcanceEvaluacion'), R = require('../models/RevisionAlcance');
const M = require('../models/MaterializacionPerfil');
const { transaccionAdmin } = require('./transaccionOrganizacion');
const { obtenerContextoOrganizacion, ErrorContextoOrganizacion } = require('./contextoOrganizacion');
const { contextoDeRevision } = require('./contextoEmpresa');
const { contextoDeRevisionOperacion } = require('./operaciones');
const { fallo, id, campos, ErrorOrganizacion } = require('./datosOrganizacion');
const { numeroURL } = require('../validation/contextoEmpresa');
const { preparar } = require('../validation/alcanceEvaluacion');
const { huella } = require('../validation/aplicabilidadContextual');
const { proyectar, proponer, analizar, operacionesPerfil } = require('./perfilNormativo');
const { obtenerCatalogo } = require('../catalogo/orientacionC1');
const INDICES = [
  [C, 'contexto_empresa_unico', { organizacion: 1 }],
  [RC, 'revision_contexto_unica', { contexto: 1, numero: 1 }],
  [RO, 'revision_operacion_numero_unico', { operacion: 1, numero: 1 }],
  [S, 'subespacio_creacion_unica', { organizacion: 1, clave_creacion: 1 }],
  [R, 'revision_alcance_unica', { alcance: 1, numero: 1 }],
  [R, 'revision_alcance_reintento_unico', { organizacion: 1, clave_operacion: 1 }],
  [M, 'perfil_reintento_unico', { organizacion: 1, clave_operacion: 1 }],
  [M, 'perfil_propuesta_unica', { organizacion: 1, propuesta_sha256: 1 }]
];
const q = (query, session) => query.read('primary').maxTimeMS(5000).session(session || null).lean();
async function cargarContexto(organizacion, session) {
  const c = await q(C.findOne({ organizacion }), session);
  if (!c) fallo('CONTEXTO_NO_INICIADO');
  const r = await q(RC.findOne({ organizacion, contexto: c._id, numero: c.version_actual }), session);
  const contexto = contextoDeRevision(c, r);
  const revision = { autorId: String(r.actor), membresiaAutorId: String(r.membresia_actor) };
  return { c, contexto, revision };
}
async function cargar(organizacion, session) {
  const { c, contexto, revision } = await cargarContexto(organizacion, session);
  const perfil = proyectar(contexto, revision), operaciones = [];
  for (const identificador of operacionesPerfil(perfil)) {
    const o = await q(O.findOne({ organizacion, _id: identificador }), session);
    if (!o) fallo('RECURSO_NO_DISPONIBLE');
    const ro = await q(RO.findOne({ organizacion, operacion: o._id, numero: o.version_actual }), session);
    operaciones.push({ id: String(o._id), version: o.version_actual,
      contexto: contextoDeRevisionOperacion(o, ro), sha256: ro.sha256,
      autorId: String(ro.actor), membresiaAutorId: String(ro.membresia_actor) });
  }
  return { c, contexto, revision, operaciones, propuesta: proponer(contexto, revision, operaciones) };
}
async function admin(e) {
  const p = await obtenerContextoOrganizacion(e);
  if (p.rol !== 'administrador') fallo('GESTION_DENEGADA');
  return p;
}
async function leer(e, fn, conPropuestas = false) {
  try {
    const cargarLectura = conPropuestas ? cargar : cargarContexto;
    const permiso = await admin(e), cargado = await cargarLectura(permiso.organizacionId);
    const salida = await fn(cargado, permiso);
    const despues = await cargarLectura(permiso.organizacionId), vigente = await admin(e);
    if (vigente.membresiaId !== permiso.membresiaId) fallo('GESTION_DENEGADA');
    if (cargado.contexto.version !== despues.contexto.version ||
      (conPropuestas && cargado.propuesta.propuestaHuella !== despues.propuesta.propuestaHuella)) fallo('VERSION_DESACTUALIZADA');
    return salida;
  } catch (err) {
    if (err instanceof ErrorOrganizacion || err instanceof ErrorContextoOrganizacion) throw err;
    throw new ErrorOrganizacion('SERVICIO_NO_DISPONIBLE', err);
  }
}
function validarPropuesta(d, cargado) {
  if (d.contextoVersion !== cargado.contexto.version || d.propuestaHuella !== cargado.propuesta.propuestaHuella)
    fallo('VERSION_DESACTUALIZADA');
}
function validarActividades(ids, p) {
  if (!ids.every(a => p.espacios.some(s => s.actividadId === a))) fallo('DATOS_INVALIDOS');
}
async function comprobarSubespacios(refs, organizacion, session) {
  if (new Set(refs.map(s => s.id)).size !== refs.length) fallo('DATOS_INVALIDOS');
  for (const ref of refs) {
    const s = await q(S.findOne({ _id: ref.id, organizacion, estado: 'activo' }), session);
    if (!s) fallo('RECURSO_NO_DISPONIBLE');
    if (s.__v !== ref.version) fallo('VERSION_DESACTUALIZADA');
  }
}
function instantanea(datos, cargado) {
  validarActividades(datos.actividadIds, cargado.propuesta);
  const ids = new Set(cargado.propuesta.espacios.filter(s => datos.actividadIds.includes(s.actividadId)).flatMap(s => s.operaciones));
  const ops = cargado.operaciones.filter(o => ids.has(o.id));
  const { candidatos, contradicciones, catalogo, aviso } = analizar(cargado.propuesta.perfil, ops, datos.actividadIds);
  return { alcance: { ...datos, estado: 'preliminar', esCertificacion: false },
    origen: { contextoId: String(cargado.c._id), contextoVersion: cargado.contexto.version,
      contextoSha256: huella(cargado.contexto.hechos), contextoRegistradoEn: cargado.contexto.registradoEn,
      operaciones: ops.map(o => ({ id: o.id, version: o.version, sha256: o.sha256 })),
      propuestaHuella: cargado.propuesta.propuestaHuella },
    catalogo, candidatos, contradicciones, aviso,
    enlacesFuturos: { tareas: 'no_implementado', evidenciasRevisadas: 'no_implementado', metricas: 'no_implementado', pds: 'no_implementado' } };
}
function integridad(a, r) {
  if (!r || String(r.organizacion) !== String(a.organizacion) || String(r.alcance) !== String(a._id) ||
    r.numero > a.version_actual || huella(r.contenido) !== r.sha256 ||
    (r.numero === a.version_actual && r.contenido.alcance.nombre !== a.nombre)) fallo('SERVICIO_NO_DISPONIBLE');
}
async function estadoActual(a, r, cargado, session) {
  integridad(a, r);
  const motivos = [], origen = r.contenido.origen;
  if (r.numero !== a.version_actual) motivos.push('alcance_modificado');
  if (origen.contextoVersion !== cargado.contexto.version) motivos.push('contexto_modificado');
  if (r.contenido.catalogo.sha256 !== obtenerCatalogo().sha256) motivos.push('catalogo_modificado');
  for (const op of origen.operaciones) {
    const actual = await q(O.findOne({ _id: op.id, organizacion: a.organizacion }), session);
    if (!actual || actual.version_actual !== op.version) motivos.push('operacion_modificada:' + op.id);
  }
  for (const s of r.contenido.alcance.subespacios) {
    const actual = await q(S.findOne({ _id: s.id, organizacion: a.organizacion }), session);
    if (!actual || actual.estado !== 'activo' || actual.__v !== s.version) motivos.push('subespacio_modificado:' + s.id);
  }
  return { necesitaRevision: !!motivos.length, motivos, recalculadoAlLeer: false };
}
async function dto(a, r, cargado, repetida = false, session) {
  const vigencia = await estadoActual(a, r, cargado, session);
  return { id: String(a._id), organizacionId: String(a.organizacion), versionActual: a.version_actual,
    revision: { id: String(r._id), numero: r.numero, registradoEn: new Date(r.createdAt).toISOString(),
      autorId: String(r.actor), membresiaAutorId: String(r.membresia_actor), motivo: r.motivo, sha256: r.sha256 },
    contenido: r.contenido, vigencia, repetida, horaServidor: new Date().toISOString() };
}
async function guardarRevision(a, contenido, d, ctx, firma) {
  const org = ctx.contexto.organizacionId, session = ctx.session;
  const [revision] = await R.create([{ organizacion: org, alcance: a._id, numero: a.version_actual, contenido,
    actor: ctx.contexto.usuarioId, membresia_actor: ctx.contexto.membresiaId, motivo: d.motivo,
    sha256: huella(contenido), clave_operacion: d.clave, huella_operacion: firma }], { session });
  await E.create([{ organizacion: org, alcance: a._id, actor: ctx.contexto.usuarioId, membresia_actor: ctx.contexto.membresiaId,
    subespacios: contenido.alcance.subespacios.map(s => s.id), accion: a.version_actual === 1 ? 'alcance_creado' : 'alcance_actualizado',
    antes: a.version_actual > 1 ? { version: a.version_actual - 1 } : null,
    despues: { version: a.version_actual, nombre: a.nombre, estado: 'preliminar', sha256: revision.sha256,
      version_contexto: contenido.origen.contextoVersion } }], { session });
  return revision.toObject();
}
async function obtenerPropuestas(e) { return leer(e, async c => ({ ...c.propuesta, horaServidor: new Date().toISOString() }), true); }
async function materializar(e) {
  const d = preparar(e.datos, e.clave);
  return transaccionAdmin(e, INDICES, async ctx => {
    const org = ctx.contexto.organizacionId, session = ctx.session;
    const firma = huella({ datos: d, actor: ctx.contexto.usuarioId, membresia: ctx.contexto.membresiaId });
    const previa = await q(M.findOne({ organizacion: org, clave_operacion: d.clave }).select('+huella_operacion'), session);
    if (previa) {
      if (previa.huella_operacion !== firma) fallo('CLAVE_REUTILIZADA');
      if (huella(previa.resultado) !== previa.resultado_sha256) fallo('SERVICIO_NO_DISPONIBLE');
      return { ...previa.resultado, repetida: true };
    }
    const c = await cargar(org, session); validarPropuesta(d, c);
    if (await q(M.findOne({ organizacion: org, propuesta_sha256: d.propuestaHuella }), session)) fallo('CLAVE_REUTILIZADA');
    const actividades = c.propuesta.espacios.map(s => s.actividadId).sort();
    if (JSON.stringify(d.espacios.map(s => s.actividadId).sort()) !== JSON.stringify(actividades)) fallo('DATOS_INVALIDOS');
    if (!actividades.every(a => d.alcances.some(s => s.actividadIds.includes(a)))) fallo('DATOS_INVALIDOS');
    for (const a of d.alcances) validarActividades(a.actividadIds, c.propuesta);
    const espacios = [];
    for (const s of d.espacios) {
      if (s.existente) {
        await comprobarSubespacios([s.existente], org, session);
        espacios.push({ actividadId: s.actividadId, ...s.existente, creado: false });
      } else {
        const [nuevo] = await S.create([{ ...s.nuevo, organizacion: org, creado_por: ctx.contexto.membresiaId,
          clave_creacion: 'nc1_' + huella([d.clave, s.actividadId]), huella_creacion: firma }], { session });
        espacios.push({ actividadId: s.actividadId, id: String(nuevo._id), version: nuevo.__v, creado: true });
        await E.create([{ organizacion: org, subespacio: nuevo._id, actor: ctx.contexto.usuarioId,
          membresia_actor: ctx.contexto.membresiaId, accion: 'subespacio_creado',
          despues: { nombre: nuevo.nombre, tipo: nuevo.tipo, descripcion: nuevo.descripcion, estado: 'activo', version: nuevo.__v } }], { session });
      }
    }
    const alcances = [];
    for (const propuesta of d.alcances) {
      const { clave: k, ...datos } = propuesta;
      const refs = espacios.filter(s => datos.actividadIds.includes(s.actividadId));
      datos.subespacios = [...new Map(refs.map(s => [s.id, { id: s.id, version: s.version }])).values()];
      const [a] = await A.create([{ organizacion: org, nombre: datos.nombre, version_actual: 1 }], { session });
      const r = await guardarRevision(a, instantanea(datos, c), { ...d, clave: 'nc1_' + huella([d.clave, k]) }, ctx, firma);
      alcances.push({ clave: k, id: String(a._id), version: 1, revisionId: String(r._id), sha256: r.sha256 });
    }
    const resultado = { espacios, alcances, propuestaHuella: d.propuestaHuella, contextoVersion: d.contextoVersion,
      aviso: 'Organización del trabajo confirmada. Alcances preliminares y candidatos; no conclusión jurídica ni certificación.' };
    await M.create([{ organizacion: org, actor: ctx.contexto.usuarioId, propuesta_sha256: d.propuestaHuella,
      clave_operacion: d.clave, huella_operacion: firma, resultado, resultado_sha256: huella(resultado) }], { session });
    return { ...resultado, repetida: false };
  });
}
async function modificar(e) {
  const identificador = id(e.alcanceId), d = preparar(e.datos, e.clave, true);
  return transaccionAdmin(e, INDICES, async ctx => {
    const org = ctx.contexto.organizacionId, session = ctx.session;
    let a = await q(A.findOne({ _id: identificador, organizacion: org }), session);
    if (!a) fallo('RECURSO_NO_DISPONIBLE');
    const firma = huella({ alcanceId: identificador, datos: d, actor: ctx.contexto.usuarioId, membresia: ctx.contexto.membresiaId });
    const previa = await q(R.findOne({ organizacion: org, clave_operacion: d.clave }).select('+huella_operacion'), session);
    const c = await cargar(org, session);
    if (previa) {
      if (previa.huella_operacion !== firma) fallo('CLAVE_REUTILIZADA');
      return dto(a, previa, c, true, session);
    }
    if (a.version_actual !== d.version) fallo('VERSION_DESACTUALIZADA');
    validarPropuesta(d, c);
    const anterior = await q(R.findOne({ organizacion: org, alcance: a._id, numero: a.version_actual }), session);
    integridad(a, anterior);
    if (a.version_actual >= 999999999) fallo('SERVICIO_NO_DISPONIBLE');
    await comprobarSubespacios(d.datos.subespacios, org, session);
    const contenido = instantanea(d.datos, c);
    a = await q(A.findOneAndUpdate({ _id: a._id, organizacion: org, version_actual: d.version },
      { $set: { nombre: d.datos.nombre }, $inc: { version_actual: 1, __v: 1 } }, { new: true, runValidators: true }), session);
    if (!a) fallo('VERSION_DESACTUALIZADA');
    const r = await guardarRevision(a, contenido, d, ctx, firma);
    return dto(a, r, c, false, session);
  });
}
async function obtener(e) {
  const identificador = id(e.alcanceId), numero = e.numero === undefined ? undefined : numeroURL(e.numero);
  return leer(e, async (c, p) => {
    const a = await q(A.findOne({ _id: identificador, organizacion: p.organizacionId }));
    if (!a) fallo('RECURSO_NO_DISPONIBLE');
    const r = await q(R.findOne({ organizacion: p.organizacionId, alcance: a._id, numero: numero ?? a.version_actual }));
    if (!r && numero !== undefined) fallo('RECURSO_NO_DISPONIBLE');
    return dto(a, r, c);
  });
}
async function listar(e) {
  const f = e.filtros || {}; campos(f, ['limite', 'antes']);
  const limite = f.limite === undefined ? 20 : numeroURL(f.limite);
  if (limite > 50) fallo('DATOS_INVALIDOS');
  const antes = f.antes === undefined ? undefined : id(f.antes);
  return leer(e, async (_, p) => {
    const docs = await q(A.find({ organizacion: p.organizacionId, ...(antes ? { _id: { $lt: antes } } : {}) })
      .sort({ _id: -1 }).limit(limite + 1));
    return { alcances: docs.slice(0, limite).map(a => ({ id: String(a._id), nombre: a.nombre,
      versionActual: a.version_actual, estado: a.estado, createdAt: a.createdAt })),
      siguienteAntes: docs.length > limite ? String(docs[limite - 1]._id) : null,
      aviso: 'Consultar la revisión de cada alcance para conocer candidatos y cambios pendientes.' };
  });
}
async function listarVersiones(e) {
  const identificador = id(e.alcanceId), f = e.filtros || {}; campos(f, ['limite', 'antes']);
  const limite = f.limite === undefined ? 20 : numeroURL(f.limite), antes = f.antes === undefined ? undefined : numeroURL(f.antes);
  if (limite > 50) fallo('DATOS_INVALIDOS');
  return leer(e, async (_, p) => {
    const a = await q(A.findOne({ _id: identificador, organizacion: p.organizacionId }));
    if (!a) fallo('RECURSO_NO_DISPONIBLE');
    const docs = await q(R.find({ organizacion: p.organizacionId, alcance: a._id,
      numero: { $lte: a.version_actual, ...(antes ? { $lt: antes } : {}) } })
      .select('numero actor motivo sha256 createdAt').sort({ numero: -1 }).limit(limite + 1));
    return { alcanceId: identificador, versionActual: a.version_actual,
      versiones: docs.slice(0, limite).map(r => ({ numero: r.numero, autorId: String(r.actor), motivo: r.motivo,
        sha256: r.sha256, registradoEn: r.createdAt })), siguienteAntes: docs.length > limite ? docs[limite - 1].numero : null };
  });
}
module.exports = { obtenerPropuestas, materializar, modificar, obtener, listar, listarVersiones };
