'use strict';
const O = require('../models/Operacion'), R = require('../models/RevisionOperacion');
const S = require('../models/Subespacio'), E = require('../models/EventoOrganizacion');
const { transaccionAdmin } = require('./transaccionOrganizacion');
const { obtenerContextoOrganizacion, ErrorContextoOrganizacion } = require('./contextoOrganizacion');
const { ErrorOrganizacion, fallo, campos, id } = require('./datosOrganizacion');
const { preparar, validarContenido } = require('../validation/operacion');
const { combinar, numeroURL, numero } = require('../validation/contextoEmpresa');
const { huella, validarContexto } = require('../validation/aplicabilidadContextual');
const INDICES = [
  [R, 'revision_operacion_numero_unico', { operacion: 1, numero: 1 }],
  [R, 'revision_operacion_reintento_unico', { organizacion: 1, clave_operacion: 1 }]
];
const lectura = q => q.read('primary').maxTimeMS(5000);
function metadatos(r) {
  return { id: String(r._id), numero: r.numero, registradoEn: new Date(r.createdAt).toISOString(),
    autorId: String(r.actor), membresiaAutorId: String(r.membresia_actor), motivo: r.motivo, sha256: r.sha256 };
}
// Adaptador interno: no autoriza, no busca objetos ni hereda hechos generales.
function contextoDeRevisionOperacion(o, r) {
  try {
    numero(o.version_actual);
    if (!r || String(r.operacion) !== String(o._id) || String(r.organizacion) !== String(o.organizacion) ||
        r.numero > o.version_actual || !validarContenido(r.contenido) || huella(r.contenido) !== r.sha256)
      fallo('SERVICIO_NO_DISPONIBLE');
    if (r.numero === o.version_actual && (r.contenido.nombre !== o.nombre ||
        r.contenido.descripcion !== o.descripcion || r.contenido.subespacioId !== (o.subespacio ? String(o.subespacio) : null)))
      fallo('SERVICIO_NO_DISPONIBLE');
    return validarContexto({ id: 'ctx_op_' + o._id, version: r.numero, organizacionId: String(o.organizacion),
      objeto: { tipo: 'operacion', id: String(o._id) }, registradoEn: new Date(r.createdAt).toISOString(),
      hechos: r.contenido.hechos });
  } catch (e) { throw new ErrorOrganizacion('SERVICIO_NO_DISPONIBLE', e); }
}
function salida(o, r, repetida = false) {
  const contexto = contextoDeRevisionOperacion(o, r);
  return { operacion: { id: String(o._id), organizacionId: String(o.organizacion),
    nombre: r.contenido.nombre, descripcion: r.contenido.descripcion, subespacioId: r.contenido.subespacioId },
    versionActual: o.version_actual, contexto, revision: metadatos(r), repetida,
    horaServidor: new Date().toISOString() };
}
const resumen = r => ({ version: r.numero, nombre: r.contenido.nombre,
  subespacio_id: r.contenido.subespacioId, sha256: r.sha256 });
async function guardarOperacion(entrada, actualizacion = false) {
  const d = preparar(entrada.datos, actualizacion, entrada.clave);
  const operacionId = actualizacion ? id(entrada.operacionId) : null;
  return transaccionAdmin(entrada, INDICES, async ({ session, contexto: permiso }) => {
    const org = permiso.organizacionId;
    const firma = huella({ accion: actualizacion ? 'actualizar' : 'crear', operacionId,
      actor: permiso.usuarioId, membresia: permiso.membresiaId, datos: d });
    let o = actualizacion ? await O.findOne({ _id: operacionId, organizacion: org }).session(session).lean() : null;
    if (actualizacion && !o) fallo('RECURSO_NO_DISPONIBLE');
    const repetida = await R.findOne({ organizacion: org, clave_operacion: d.clave })
      .select('+huella_operacion').session(session).lean();
    if (repetida) {
      if (repetida.huella_operacion !== firma) fallo('CLAVE_REUTILIZADA');
      o ||= await O.findOne({ _id: repetida.operacion, organizacion: org }).session(session).lean();
      if (!o) fallo('SERVICIO_NO_DISPONIBLE');
      return salida(o, repetida, true);
    }
    if (actualizacion && o.version_actual !== d.version) fallo('VERSION_DESACTUALIZADA');
    if (actualizacion && o.version_actual >= 999999999) fallo('SERVICIO_NO_DISPONIBLE');
    const anterior = actualizacion ? await R.findOne({
      organizacion: org, operacion: o._id, numero: o.version_actual
    }).session(session).lean() : null;
    if (actualizacion) contextoDeRevisionOperacion(o, anterior);
    const contenido = {
      nombre: d.nombre ?? anterior?.contenido.nombre,
      descripcion: d.descripcion ?? anterior?.contenido.descripcion,
      subespacioId: Object.hasOwn(d, 'subespacioId') ? d.subespacioId : anterior.contenido.subespacioId,
      hechos: combinar(anterior?.contenido.hechos || [], actualizacion ? d.cambios : d.hechos, permiso.membresiaId)
    };
    if (!validarContenido(contenido)) fallo('DATOS_INVALIDOS');
    if (contenido.subespacioId) {
      const vinculo = await S.findOne({ _id: contenido.subespacioId, organizacion: org, estado: 'activo' })
        .select('_id').session(session).lean();
      if (!vinculo) fallo('RECURSO_NO_DISPONIBLE');
    }
    const n = actualizacion ? o.version_actual + 1 : 1;
    const cabecera = { nombre: contenido.nombre, descripcion: contenido.descripcion,
      subespacio: contenido.subespacioId, version_actual: n };
    if (!o) {
      [o] = await O.create([{ organizacion: org, ...cabecera }], { session }); o = o.toObject();
    } else {
      o = await O.findOneAndUpdate({ _id: o._id, organizacion: org, version_actual: d.version },
        { $set: cabecera, $inc: { __v: 1 } }, { session, new: true, runValidators: true }).lean();
      if (!o) fallo('VERSION_DESACTUALIZADA');
    }
    const [doc] = await R.create([{
      organizacion: org, operacion: o._id, numero: n, contenido,
      actor: permiso.usuarioId, membresia_actor: permiso.membresiaId, motivo: d.motivo,
      sha256: huella(contenido), clave_operacion: d.clave, huella_operacion: firma
    }], { session });
    const r = doc.toObject(), previos = new Map((anterior?.contenido.hechos || []).map(h => [h.clave, h]));
    const modificadas = contenido.hechos.filter(h => !previos.has(h.clave) || huella(h) !== huella(previos.get(h.clave)))
      .map(h => h.clave);
    await E.create([{
      organizacion: org, operacion: o._id, actor: permiso.usuarioId, membresia_actor: permiso.membresiaId,
      subespacios: [...new Set([anterior?.contenido.subespacioId, contenido.subespacioId].filter(Boolean))],
      accion: actualizacion ? 'operacion_actualizada' : 'operacion_creada',
      antes: anterior ? resumen(anterior) : null, despues: { ...resumen(r), claves_cambiadas: modificadas }
    }], { session });
    return salida(o, r);
  });
}
async function admin(entrada) {
  const permiso = await obtenerContextoOrganizacion(entrada);
  if (permiso.rol !== 'administrador') fallo('GESTION_DENEGADA');
  return permiso;
}
async function leer(entrada, operacion) {
  try {
    const permiso = await admin(entrada);
    const datos = await operacion(permiso.organizacionId);
    const vigente = await admin(entrada);
    if (vigente.membresiaId !== permiso.membresiaId) fallo('GESTION_DENEGADA');
    return datos;
  } catch (e) {
    if (e instanceof ErrorOrganizacion || e instanceof ErrorContextoOrganizacion) throw e;
    throw new ErrorOrganizacion('SERVICIO_NO_DISPONIBLE', e);
  }
}
async function cabecera(org, operacionId) {
  const o = await lectura(O.findOne({ _id: operacionId, organizacion: org })).lean();
  if (!o) fallo('RECURSO_NO_DISPONIBLE');
  return o;
}
async function obtenerOperacion(entrada) {
  const operacionId = id(entrada.operacionId);
  const n = entrada.numero === undefined ? undefined : numeroURL(entrada.numero);
  return leer(entrada, async org => {
    const o = await cabecera(org, operacionId);
    const r = await lectura(R.findOne({ organizacion: org, operacion: o._id, numero: n ?? o.version_actual })).lean();
    if (!r && n !== undefined) fallo('RECURSO_NO_DISPONIBLE');
    return salida(o, r);
  });
}
function paginacion(f, revision) {
  campos(f, revision ? ['limite', 'antes'] : ['limite', 'antes', 'subespacioId']);
  const limite = f.limite === undefined ? 20 : numeroURL(f.limite);
  if (limite > 100) fallo('DATOS_INVALIDOS');
  const antes = f.antes === undefined ? undefined : revision ? numeroURL(f.antes) : id(f.antes);
  const subespacioId = f.subespacioId === undefined ? undefined : id(f.subespacioId);
  return { limite, antes, subespacioId };
}
async function listarOperaciones(entrada) {
  const f = paginacion(entrada.filtros || {}, false);
  return leer(entrada, async org => {
    const docs = await lectura(O.find({ organizacion: org,
      ...(f.antes ? { _id: { $lt: f.antes } } : {}), ...(f.subespacioId ? { subespacio: f.subespacioId } : {})
    })).sort({ _id: -1 }).limit(f.limite + 1).lean();
    const filas = docs.slice(0, f.limite);
    const revisiones = filas.length ? await lectura(R.find({ organizacion: org,
      $or: filas.map(o => ({ operacion: o._id, numero: o.version_actual }))
    })).lean() : [];
    const mapa = new Map(revisiones.map(r => [String(r.operacion), r]));
    const operaciones = filas.map(o => {
      const r = mapa.get(String(o._id)); contextoDeRevisionOperacion(o, r);
      return { id: String(o._id), nombre: r.contenido.nombre, descripcion: r.contenido.descripcion,
        subespacioId: r.contenido.subespacioId, versionActual: o.version_actual, revision: metadatos(r) };
    });
    const hayMas = docs.length > f.limite;
    return { operaciones, paginacion: { limite: f.limite, hayMas, siguienteAntes: hayMas ? String(filas.at(-1)._id) : null } };
  });
}
async function listarVersiones(entrada) {
  const operacionId = id(entrada.operacionId), f = paginacion(entrada.filtros || {}, true);
  return leer(entrada, async org => {
    const o = await cabecera(org, operacionId);
    const revisiones = await lectura(R.find({ organizacion: org, operacion: o._id,
      numero: { $lte: o.version_actual, ...(f.antes ? { $lt: f.antes } : {}) }
    }).select('numero actor membresia_actor motivo sha256 createdAt'))
      .sort({ numero: -1 }).limit(f.limite + 1).lean();
    const filas = revisiones.slice(0, f.limite), hayMas = revisiones.length > f.limite;
    return { operacionId, versionActual: o.version_actual, versiones: filas.map(metadatos),
      paginacion: { limite: f.limite, hayMas, siguienteAntes: hayMas ? filas.at(-1).numero : null } };
  });
}
module.exports = { guardarOperacion, obtenerOperacion, listarOperaciones, listarVersiones, contextoDeRevisionOperacion };
