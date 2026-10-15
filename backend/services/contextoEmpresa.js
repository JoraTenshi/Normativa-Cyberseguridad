'use strict';
const C = require('../models/ContextoEmpresa'), R = require('../models/RevisionContextoEmpresa');
const E = require('../models/EventoOrganizacion');
const { transaccionAdmin } = require('./transaccionOrganizacion');
const { obtenerContextoOrganizacion, ErrorContextoOrganizacion } = require('./contextoOrganizacion');
const { ErrorOrganizacion, fallo, campos } = require('./datosOrganizacion');
const { preparar, combinar, numeroURL, validarHechosGuardados } = require('../validation/contextoEmpresa');
const { huella, validarContexto } = require('../validation/aplicabilidadContextual');
const INDICES = [
  [C, 'contexto_empresa_unico', { organizacion: 1 }],
  [R, 'revision_contexto_unica', { contexto: 1, numero: 1 }],
  [R, 'contexto_operacion_unica', { organizacion: 1, clave_operacion: 1 }]
];
const lectura = q => q.read('primary').maxTimeMS(5000);
const resumen = r => ({ version: r.numero, sha256: r.sha256 });
function metadatos(r) {
  return { numero: r.numero, registradoEn: new Date(r.createdAt).toISOString(),
    autorId: String(r.actor), membresiaAutorId: String(r.membresia_actor), motivo: r.motivo, sha256: r.sha256 };
}
// Adaptador interno: el llamador debe autorizar y cargar la revisión por organización.
function contextoDeRevision(c, r) {
  if (!r || String(r.contexto) !== String(c._id) || String(r.organizacion) !== String(c.organizacion) ||
      r.numero > c.version_actual || !validarHechosGuardados(r.hechos) || huella(r.hechos) !== r.sha256) fallo('SERVICIO_NO_DISPONIBLE');
  const contexto = validarContexto({
    id: 'ctx_' + c._id, version: r.numero, organizacionId: String(c.organizacion),
    objeto: { tipo: 'organizacion', id: String(c.organizacion) },
    registradoEn: new Date(r.createdAt).toISOString(), hechos: r.hechos
  });
  return contexto;
}
function salida(c, r, repetida = false) {
  const contexto = contextoDeRevision(c, r);
  return { contextoId: String(c._id), versionActual: c.version_actual, contexto,
    revision: metadatos(r), repetida, horaServidor: new Date().toISOString() };
}
async function guardarContexto(entrada, actualizacion = false) {
  const d = preparar(entrada.datos, actualizacion, entrada.clave);
  return transaccionAdmin(entrada, INDICES, async ({ session, contexto: permiso }) => {
    const org = permiso.organizacionId;
    const firma = huella({ accion: actualizacion ? 'actualizar' : 'crear', actor: permiso.usuarioId,
      membresia: permiso.membresiaId, datos: d });
    let c = await C.findOne({ organizacion: org }).session(session).lean();
    const anteriorOperacion = await R.findOne({ organizacion: org, clave_operacion: d.clave })
      .select('+huella_operacion').session(session).lean();
    if (anteriorOperacion) {
      if (anteriorOperacion.huella_operacion !== firma) fallo('CLAVE_REUTILIZADA');
      if (!c) fallo('SERVICIO_NO_DISPONIBLE');
      return salida(c, anteriorOperacion, true);
    }
    if (actualizacion && !c) fallo('CONTEXTO_NO_INICIADO');
    if (!actualizacion && c) fallo('CONTEXTO_YA_EXISTE');
    if (actualizacion && c.version_actual !== d.version) fallo('VERSION_DESACTUALIZADA');
    if (actualizacion && c.version_actual >= 999999999) fallo('SERVICIO_NO_DISPONIBLE');
    const anterior = actualizacion ? await R.findOne({
      organizacion: org, contexto: c._id, numero: c.version_actual
    }).session(session).lean() : null;
    if (actualizacion) salida(c, anterior); // Integridad de la revisión base antes de copiarla.
    const numero = actualizacion ? c.version_actual + 1 : 1;
    const cambios = actualizacion ? d.cambios : d.hechos;
    const hechos = combinar(anterior?.hechos || [], cambios, permiso.membresiaId);
    if (!c) {
      [c] = await C.create([{ organizacion: org, version_actual: numero }], { session });
      c = c.toObject();
    } else {
      c = await C.findOneAndUpdate({ _id: c._id, organizacion: org, version_actual: d.version },
        { $set: { version_actual: numero }, $inc: { __v: 1 } }, { session, new: true, runValidators: true }).lean();
      if (!c) fallo('VERSION_DESACTUALIZADA');
    }
    const [revision] = await R.create([{
      organizacion: org, contexto: c._id, numero, hechos,
      actor: permiso.usuarioId, membresia_actor: permiso.membresiaId, motivo: d.motivo,
      sha256: huella(hechos), clave_operacion: d.clave, huella_operacion: firma
    }], { session });
    const r = revision.toObject();
    const previos = new Map((anterior?.hechos || []).map(h => [h.clave, h]));
    const modificadas = hechos.filter(h => !previos.has(h.clave) || huella(h) !== huella(previos.get(h.clave)))
      .map(h => h.clave);
    await E.create([{
      organizacion: org, contexto: c._id, actor: permiso.usuarioId, membresia_actor: permiso.membresiaId,
      accion: actualizacion ? 'contexto_actualizado' : 'contexto_creado',
      antes: anterior ? resumen(anterior) : null,
      despues: { ...resumen(r), claves_cambiadas: modificadas }
    }], { session });
    return salida(c, r);
  });
}
async function admin(entrada) {
  const c = await obtenerContextoOrganizacion(entrada);
  if (c.rol !== 'administrador') fallo('GESTION_DENEGADA');
  return c;
}
async function leer(entrada, operacion) {
  try {
    const permiso = await admin(entrada);
    const c = await lectura(C.findOne({ organizacion: permiso.organizacionId })).lean();
    if (!c) fallo('CONTEXTO_NO_INICIADO');
    const respuesta = await operacion(c);
    const vigente = await admin(entrada);
    if (vigente.membresiaId !== permiso.membresiaId) fallo('GESTION_DENEGADA');
    return respuesta;
  } catch (e) {
    if (e instanceof ErrorOrganizacion || e instanceof ErrorContextoOrganizacion) throw e;
    throw new ErrorOrganizacion('SERVICIO_NO_DISPONIBLE', e);
  }
}
async function obtenerContexto(entrada) {
  const numero = entrada.numero === undefined ? undefined : numeroURL(entrada.numero);
  return leer(entrada, async c => {
    const r = await lectura(R.findOne({
      organizacion: c.organizacion, contexto: c._id, numero: numero ?? c.version_actual
    })).lean();
    if (!r && numero !== undefined) fallo('RECURSO_NO_DISPONIBLE');
    return salida(c, r);
  });
}
async function listarVersiones(entrada) {
  const f = entrada.filtros || {};
  campos(f, ['limite', 'antes']);
  const limite = f.limite === undefined ? 20 : numeroURL(f.limite);
  if (limite > 100) fallo('DATOS_INVALIDOS');
  const antes = f.antes === undefined ? undefined : numeroURL(f.antes);
  return leer(entrada, async c => {
    const revisiones = await lectura(R.find({
      organizacion: c.organizacion, contexto: c._id,
      numero: { $lte: c.version_actual, ...(antes ? { $lt: antes } : {}) }
    }).select('numero actor membresia_actor motivo sha256 createdAt'))
      .sort({ numero: -1 }).limit(limite + 1).lean();
    const filas = revisiones.slice(0, limite), hayMas = revisiones.length > limite;
    return { contextoId: String(c._id), versionActual: c.version_actual, versiones: filas.map(metadatos),
      paginacion: { limite, hayMas, siguienteAntes: hayMas ? filas.at(-1).numero : null } };
  });
}
module.exports = { guardarContexto, obtenerContexto, listarVersiones, contextoDeRevision };
