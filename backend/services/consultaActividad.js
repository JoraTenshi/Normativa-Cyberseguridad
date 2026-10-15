'use strict';

const crypto = require('node:crypto');
const Evento = require('../models/EventoOrganizacion');
const Unidad = require('../models/UnidadTrabajo');
const Pertenencia = require('../models/MembresiaUnidad');
const Membresia = require('../models/Membresia');
const { obtenerContextoOrganizacion, ErrorContextoOrganizacion } = require('./contextoOrganizacion');

const ACCIONES = Object.freeze([...Evento.schema.path('accion').enumValues]);
const DISPONIBLES = Object.freeze([
  'unidadId', 'subespacioId', 'documentoId', 'contextoId', 'operacionId', 'alcanceId', 'registroNormativoId', 'decisionId', 'decisionOperacionId', 'reglaId', 'actorId', 'miembroId', 'categoria', 'accion',
  'desde', 'hasta', 'orden', 'limite', 'cursor'
]);
const PENDIENTES = Object.freeze(['clienteId', 'normativaId', 'estandarId', 'categoriaTarea']);
const MAX_RELACIONES = 200;
const ERRORES = Object.freeze({
  FILTROS_INVALIDOS: [400, 'Filtros de actividad inválidos'],
  FILTRO_NO_IMPLEMENTADO: [400, 'Este filtro aún no dispone de eventos registrados'],
  CURSOR_INVALIDO: [400, 'Página no válida; inicia de nuevo la búsqueda'],
  ACTIVIDAD_DENEGADA: [403, 'No tienes acceso a este historial'],
  ACTIVIDAD_NO_DISPONIBLE: [503, 'Historial no disponible temporalmente']
});
class ErrorActividad extends Error {
  constructor(codigo, opciones) {
    const [status, mensaje] = ERRORES[codigo];
    super(mensaje, opciones);
    this.name = 'ErrorActividad';
    this.codigo = codigo;
    this.status = status;
  }
}
const fallo = codigo => { throw new ErrorActividad(codigo); };
const plano = v => v !== null && typeof v === 'object' && !Array.isArray(v) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(v));
const id = v => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v) ? v.toLowerCase() : null;
const categoria = accion => accion.startsWith('normativa_') ? 'normativa' : accion.startsWith('alcance_') ? 'alcances' : accion.startsWith('unidad_') ? 'unidades' :
  accion.startsWith('decision_operacion_') ? 'decisiones_operacion' : accion.startsWith('operacion_') ? 'operaciones' : accion.startsWith('decision_aplicabilidad_') ? 'decisiones_aplicabilidad' : accion.startsWith('contexto_') ? 'contextos' : accion.startsWith('subespacio_') ? 'subespacios' : accion.startsWith('documento_') ? 'documentos' : 'miembros';

// El contrato acepta instantes UTC, no fechas locales ambiguas. El frontend
// convierte la zona elegida a UTC. "hasta" es exclusivo.
function instante(valor, codigo = 'FILTROS_INVALIDOS') {
  if (typeof valor !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(valor)) fallo(codigo);
  const fecha = new Date(valor);
  const canonico = valor.includes('.') ? valor : valor.replace('Z', '.000Z');
  if (!Number.isFinite(fecha.getTime()) || fecha.toISOString() !== canonico) fallo(codigo);
  return canonico;
}

function validarFiltros(entrada = {}) {
  if (!plano(entrada)) fallo('FILTROS_INVALIDOS');
  const salida = { orden: 'desc', limite: 50 };
  for (const campo of Reflect.ownKeys(entrada)) {
    if (PENDIENTES.includes(campo)) fallo('FILTRO_NO_IMPLEMENTADO');
    if (!DISPONIBLES.includes(campo)) fallo('FILTROS_INVALIDOS');
    const valor = entrada[campo];
    // Rechaza operadores, objetos, arrays y parámetros repetidos de Express.
    if (typeof valor !== 'string' || !valor || valor.length > (campo === 'cursor' ? 1200 : 100)) {
      fallo('FILTROS_INVALIDOS');
    }
    if (['unidadId', 'subespacioId', 'documentoId', 'contextoId', 'operacionId', 'alcanceId', 'registroNormativoId', 'decisionId', 'decisionOperacionId', 'actorId', 'miembroId'].includes(campo)) {
      salida[campo] = id(valor);
      if (!salida[campo]) fallo('FILTROS_INVALIDOS');
    } else if (campo === 'reglaId') {
      if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(valor) || ['constructor', 'prototype', '__proto__', 'toJSON'].includes(valor)) fallo('FILTROS_INVALIDOS');
      salida[campo] = valor;
    } else if (campo === 'categoria') {
      if (!['unidades', 'miembros', 'subespacios', 'documentos', 'contextos', 'operaciones', 'alcances', 'normativa', 'decisiones_operacion', 'decisiones_aplicabilidad'].includes(valor)) fallo('FILTROS_INVALIDOS');
      salida[campo] = valor;
    } else if (campo === 'accion') {
      if (!ACCIONES.includes(valor)) fallo('FILTROS_INVALIDOS');
      salida[campo] = valor;
    } else if (campo === 'orden') {
      if (!['asc', 'desc'].includes(valor)) fallo('FILTROS_INVALIDOS');
      salida[campo] = valor;
    } else if (campo === 'limite') {
      if (!/^[1-9]\d{0,2}$/.test(valor) || Number(valor) > 100) fallo('FILTROS_INVALIDOS');
      salida[campo] = Number(valor);
    } else if (campo === 'cursor') {
      if (!/^[A-Za-z0-9_-]+$/.test(valor)) fallo('CURSOR_INVALIDO');
      salida[campo] = valor;
    } else {
      salida[campo] = instante(valor);
    }
  }
  if (salida.desde && salida.hasta && salida.desde >= salida.hasta) fallo('FILTROS_INVALIDOS');
  if (salida.accion && salida.categoria && categoria(salida.accion) !== salida.categoria) {
    fallo('FILTROS_INVALIDOS');
  }
  return salida;
}

const lectura = query => query.read('primary').maxTimeMS(5000);
function resumen(valor) {
  if (!valor) return null;
  // Lista explícita: nunca se envía el documento crudo ni campos futuros.
  return Object.fromEntries(['nombre', 'descripcion', 'subespacio_id', 'estado', 'rol', 'version', 'tipo', 'titulo', 'numero', 'tamano', 'sha256', 'claves_cambiadas', 'regla_id', 'version_regla', 'version_contexto', 'temporal', 'lectores', 'unidades_lectoras', 'vinculos']
    .filter(campo => Object.hasOwn(valor, campo)).map(campo => [campo, valor[campo]]));
}
function huella(contexto, unidades, filtros) {
  const pares = Object.entries(filtros).filter(([k]) => k !== 'cursor').sort(([a], [b]) => a.localeCompare(b));
  return crypto.createHash('sha256').update(JSON.stringify([
    contexto.usuarioId, contexto.organizacionId, contexto.membresiaId, contexto.rol, unidades, pares
  ])).digest('hex');
}
function leerCursor(valor, firma, ahora) {
  let c;
  try { c = JSON.parse(Buffer.from(valor, 'base64url').toString('utf8')); }
  catch { fallo('CURSOR_INVALIDO'); }
  if (!plano(c) || Object.keys(c).sort().join(',') !== 'corte,fecha,firma,id,v' ||
      c.v !== 1 || c.firma !== firma || !id(c.id)) fallo('CURSOR_INVALIDO');
  c.corte = instante(c.corte, 'CURSOR_INVALIDO');
  c.fecha = instante(c.fecha, 'CURSOR_INVALIDO');
  if (c.fecha > c.corte || c.corte > ahora) fallo('CURSOR_INVALIDO');
  return c;
}

// Solo lectura. usuarioId debe proceder de requireAuth, nunca del navegador.
// La fábrica se utiliza para pruebas internas, no recibe dependencias por HTTP.
function crearServicioActividad({
  EventoModel = Evento, UnidadModel = Unidad, PertenenciaModel = Pertenencia,
  MembresiaModel = Membresia, resolverOrganizacion = obtenerContextoOrganizacion,
  reloj = () => new Date()
} = {}) {
  async function alcance(entrada) {
    const contexto = await resolverOrganizacion(entrada);
    if (contexto.rol === 'administrador') return { contexto, unidades: null };
    if (contexto.rol !== 'colaborador') fallo('ACTIVIDAD_DENEGADA');
    const relaciones = await lectura(PertenenciaModel.find({ membresia: contexto.membresiaId })
      .select('_id unidad membresia rol estado')).limit(MAX_RELACIONES + 1).lean();
    if (relaciones.length > MAX_RELACIONES) fallo('ACTIVIDAD_NO_DISPONIBLE');
    const vistas = new Set(), candidatas = [];
    for (const r of relaciones) {
      const unidad = id(String(r.unidad));
      if (!unidad || String(r.membresia) !== contexto.membresiaId || vistas.has(unidad)) {
        fallo('ACTIVIDAD_DENEGADA');
      }
      vistas.add(unidad);
      if (r.rol === 'coordinador' && r.estado === 'activa') candidatas.push(unidad);
    }
    if (!candidatas.length) fallo('ACTIVIDAD_DENEGADA');
    const docs = await lectura(UnidadModel.find({
      _id: { $in: candidatas }, organizacion: contexto.organizacionId, estado: 'activa'
    }).select('_id organizacion estado')).limit(MAX_RELACIONES).lean();
    const unidades = docs.filter(u => String(u.organizacion) === contexto.organizacionId &&
      u.estado === 'activa' && candidatas.includes(String(u._id))).map(u => String(u._id)).sort();
    if (!unidades.length) fallo('ACTIVIDAD_DENEGADA');
    return { contexto, unidades };
  }

  async function listarActividad({ usuarioId, organizacionId, filtros = {} } = {}) {
    try {
      // Primero autenticar/autorizar el ámbito; ningún filtro concede acceso.
      const entrada = { usuarioId, organizacionId };
      const { contexto, unidades } = await alcance(entrada);
      const f = validarFiltros(filtros);
      if (unidades && f.unidadId && !unidades.includes(f.unidadId)) fallo('ACTIVIDAD_DENEGADA');
      const ahora = reloj().toISOString();
      const firma = huella(contexto, unidades, f);
      const cursor = f.cursor ? leerCursor(f.cursor, firma, ahora) : null;
      const corte = cursor?.corte || ahora;
      const consulta = {
        organizacion: contexto.organizacionId,
        accion: f.accion || { $in: ACCIONES.filter(a => !f.categoria || categoria(a) === f.categoria) },
        createdAt: { $lte: new Date(corte) }
      };
      if (f.unidadId) consulta.unidad = f.unidadId;
      else if (unidades) consulta.unidad = { $in: unidades };
      if (f.subespacioId) consulta.$and = [{ $or: [{ subespacio: f.subespacioId }, { subespacios: f.subespacioId }] }];
      if (f.documentoId) consulta.documento = f.documentoId;
      if (f.contextoId) consulta.contexto = f.contextoId;
      if (f.registroNormativoId) consulta.registro_normativo = f.registroNormativoId;
      if (f.operacionId) consulta.operacion = f.operacionId;
      if (f.alcanceId) consulta.alcance = f.alcanceId;
      if (f.decisionOperacionId) consulta.decision_operacion = f.decisionOperacionId;
      if (f.decisionId) consulta.decision = f.decisionId;
      if (f.reglaId) consulta['despues.regla_id'] = f.reglaId;
      if (f.actorId) consulta.actor = f.actorId;
      if (f.desde) consulta.createdAt.$gte = new Date(f.desde);
      if (f.hasta) consulta.createdAt.$lt = new Date(f.hasta);
      if (f.miembroId) {
        // miembroId = membresía empresarial afectada; NO el autor del cambio.
        // Se incluyen relaciones revocadas para conservar el historial.
        const miembro = await lectura(MembresiaModel.findOne({
          _id: f.miembroId, organizacion: contexto.organizacionId
        }).select('_id')).lean();
        let ids = [];
        if (miembro) {
          const relaciones = await lectura(PertenenciaModel.find({
            membresia: f.miembroId, ...(consulta.unidad ? { unidad: consulta.unidad } : {})
          }).select('_id')).limit(MAX_RELACIONES + 1).lean();
          if (relaciones.length > MAX_RELACIONES) fallo('ACTIVIDAD_NO_DISPONIBLE');
          ids = relaciones.map(r => r._id);
        }
        consulta.membresia_unidad = { $in: ids };
      }
      if (cursor) {
        const op = f.orden === 'asc' ? '$gt' : '$lt';
        consulta.$or = [
          { createdAt: { [op]: new Date(cursor.fecha) } },
          { createdAt: new Date(cursor.fecha), _id: { [op]: cursor.id } }
        ];
      }
      const direccion = f.orden === 'asc' ? 1 : -1;
      const docs = await lectura(EventoModel.find(consulta).select(
        '_id organizacion actor membresia_actor unidad membresia_unidad subespacio subespacios documento contexto operacion alcance registro_normativo decision decision_operacion accion antes despues createdAt'
      )).sort({ createdAt: direccion, _id: direccion }).limit(f.limite + 1).lean();

      // Revocaciones/cambios de alcance durante la lectura descartan la respuesta.
      // No mantiene bloqueos ni promete instantánea entre peticiones HTTP.
      const vigente = await alcance(entrada);
      if (huella(vigente.contexto, vigente.unidades, f) !== firma) fallo('ACTIVIDAD_DENEGADA');
      const hayMas = docs.length > f.limite;
      const eventos = docs.slice(0, f.limite).map(doc => {
        if (String(doc.organizacion) !== contexto.organizacionId ||
            (unidades && !unidades.includes(String(doc.unidad)))) fallo('ACTIVIDAD_DENEGADA');
        return {
          id: String(doc._id), fecha: new Date(doc.createdAt).toISOString(),
          actorId: String(doc.actor), membresiaActorId: String(doc.membresia_actor),
          unidadId: doc.unidad ? String(doc.unidad) : null,
          subespacioId: doc.subespacio ? String(doc.subespacio) : null,
          subespaciosRelacionados: (doc.subespacios || []).map(String),
          decisionOperacionId: doc.decision_operacion ? String(doc.decision_operacion) : null,
          decisionId: doc.decision ? String(doc.decision) : null,
          reglaId: doc.despues?.regla_id || null,
          contextoId: doc.contexto ? String(doc.contexto) : null,
          operacionId: doc.operacion ? String(doc.operacion) : null,
          alcanceId: doc.alcance ? String(doc.alcance) : null,
          registroNormativoId: doc.registro_normativo ? String(doc.registro_normativo) : null,
          documentoId: doc.documento ? String(doc.documento) : null,
          membresiaUnidadId: doc.membresia_unidad ? String(doc.membresia_unidad) : null,
          categoria: categoria(doc.accion), accion: doc.accion,
          antes: resumen(doc.antes), despues: resumen(doc.despues)
        };
      });
      const ultimo = eventos.at(-1);
      // Cursor de posición, NO credencial ni permiso. Se revalida el acceso
      // siempre, incluso si el cliente modifica o fabrica su propio cursor.
      const siguienteCursor = hayMas && ultimo ? Buffer.from(JSON.stringify({
        v: 1, corte, fecha: ultimo.fecha, id: ultimo.id, firma
      })).toString('base64url') : null;
      const { cursor: _cursor, ...aplicados } = f;
      return {
        eventos, filtros: aplicados,
        paginacion: { limite: f.limite, hayMas, siguienteCursor, corte },
        alcance: { tipo: unidades ? 'unidades_coordinadas' : 'organizacion', unidades },
        horaServidor: reloj().toISOString(),
        capacidades: { filtros: DISPONIBLES, filtrosPendientes: PENDIENTES, exportacion: true,
          formatosExportacion: ['csv', 'xlsx'], maxFilasExportacion: 5000,
          cobertura: ['unidades', 'miembros', 'subespacios', 'documentos', 'contextos', 'operaciones', 'alcances', 'normativa', 'decisiones_operacion', 'decisiones_aplicabilidad'],
          aviso: 'Incluye decisiones orientativas registradas; no actividad de tareas, clientes ni cobertura normativa completa.' }
      };
    } catch (error) {
      if (error instanceof ErrorActividad || error instanceof ErrorContextoOrganizacion) throw error;
      throw new ErrorActividad('ACTIVIDAD_NO_DISPONIBLE', { cause: error });
    }
  }
  return { listarActividad };
}

module.exports = {
  ...crearServicioActividad(), crearServicioActividad, validarFiltros, ErrorActividad
};
