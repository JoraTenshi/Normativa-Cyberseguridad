"use strict";
const crypto = require("node:crypto");
const D = require("../models/DocumentoOrganizacion");
const V = require("../models/VersionDocumento");
const S = require("../models/Subespacio");
const M = require("../models/Membresia");
const U = require("../models/UnidadTrabajo");
const E = require("../models/EventoOrganizacion");
const { transaccionAdmin } = require("./transaccionOrganizacion");
const { acceso, revalidar, lectura } = require("./accesoDocumental");
const {
  campos,
  texto,
  id,
  version,
  clave,
  fallo,
} = require("./datosOrganizacion");
const MAX_PDF = 5 * 1024 * 1024;
const CUOTA = 100 * 1024 * 1024; // Incluye versiones históricas. Archivar no libera espacio.
const indices = [
  [D, "documento_creacion_unica", { organizacion: 1, clave_creacion: 1 }],
  [V, "documento_version_unica", { documento: 1, numero: 1 }],
  [V, "documento_reintento_unico", { documento: 1, clave: 1 }],
];
function listaIds(valor) {
  if (!Array.isArray(valor) || valor.length > 50) fallo("DATOS_INVALIDOS");
  const ids = valor.map(id);
  if (new Set(ids).size !== ids.length) fallo("DATOS_INVALIDOS");
  return ids.sort();
}
function datos(v, alta) {
  campos(v, [
    "titulo",
    "categoriaDocumental",
    "vinculos",
    "lectores",
    "unidadesLectoras",
  ]);
  if (!Object.keys(v).length) fallo("DATOS_INVALIDOS");
  const salida = {};
  if (alta || Object.hasOwn(v, "titulo")) salida.titulo = texto(v.titulo, 120);
  if (alta || Object.hasOwn(v, "categoriaDocumental")) {
    if (!["corporativa", "legal"].includes(v.categoriaDocumental))
      fallo("DATOS_INVALIDOS");
    salida.categoria_documental = v.categoriaDocumental;
  }
  for (const [api, bd] of [
    ["lectores", "lectores"],
    ["unidadesLectoras", "unidades_lectoras"],
  ]) {
    if (Object.hasOwn(v, api)) salida[bd] = listaIds(v[api]);
    else if (alta) salida[bd] = [];
  }
  if (Object.hasOwn(v, "vinculos")) {
    if (!Array.isArray(v.vinculos) || v.vinculos.length > 20)
      fallo("DATOS_INVALIDOS");
    salida.vinculos = v.vinculos
      .map((x) => {
        campos(x, ["subespacioId", "motivo"]);
        return { subespacio: id(x.subespacioId), motivo: texto(x.motivo, 300) };
      })
      .sort((a, b) => a.subespacio.localeCompare(b.subespacio));
    if (
      new Set(salida.vinculos.map((x) => x.subespacio)).size !==
      salida.vinculos.length
    )
      fallo("DATOS_INVALIDOS");
  } else if (alta) salida.vinculos = [];
  return salida;
}
function resumen(d) {
  return {
    titulo: d.titulo,
    estado: d.estado,
    numero: d.version_actual,
    version: d.__v,
    lectores: d.lectores,
    unidades_lectoras: d.unidades_lectoras,
    vinculos: d.vinculos.map((v) => ({
      subespacio: v.subespacio,
      motivo: v.motivo,
    })),
  };
}
function dto(d, admin) {
  const r = {
    id: String(d._id),
    organizacionId: String(d.organizacion),
    titulo: d.titulo,
    categoriaDocumental: d.categoria_documental,
    estado: d.estado,
    version: d.__v,
    versionActual: d.version_actual,
    vinculos: d.vinculos.map((v) => ({
      subespacioId: String(v.subespacio),
      motivo: v.motivo,
    })),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
  if (admin) {
    r.lectores = d.lectores.map(String);
    r.unidadesLectoras = d.unidades_lectoras.map(String);
  }
  return r;
}
function versionDto(v) {
  return {
    id: String(v._id),
    numero: v.numero,
    nombre: v.nombre,
    tamano: v.tamano,
    sha256: v.sha256,
    createdAt: v.createdAt,
    analisisMalware: v.analisis_malware,
  };
}
async function referencias(d, ctx) {
  for (const [Modelo, ids] of [
    [M, d.lectores || []],
    [U, d.unidades_lectoras || []],
    [S, (d.vinculos || []).map((v) => v.subespacio)],
  ]) {
    if (!ids.length) continue;
    const estado = Modelo === S ? "activo" : "activa";
    const n = await Modelo.countDocuments({
      _id: { $in: ids },
      organizacion: ctx.contexto.organizacionId,
      estado,
    }).session(ctx.session);
    if (n !== ids.length) fallo("RECURSO_NO_DISPONIBLE");
  }
}
async function registrar(ctx, d, accion, antes, extra = {}) {
  // Eventos documentales son generales de empresa: no publicamos en el historial
  // de una unidad los permisos ni las revisiones de otros destinatarios.
  await E.create(
    [
      {
        organizacion: ctx.contexto.organizacionId,
        actor: ctx.contexto.usuarioId,
        membresia_actor: ctx.contexto.membresiaId,
        documento: d._id,
        accion,
        subespacios: [
          ...new Set(
            [...(antes?.vinculos || []), ...d.vinculos].map((v) =>
              String(v.subespacio),
            ),
          ),
        ],
        antes: antes ? resumen(antes) : null,
        despues: { ...resumen(d), ...extra },
      },
    ],
    { session: ctx.session },
  );
}
async function crearDocumento(e) {
  const d = datos(e.datos, true),
    k = clave(e.clave);
  const huella = crypto
    .createHash("sha256")
    .update(JSON.stringify([id(e.usuarioId), d]))
    .digest("hex");
  return transaccionAdmin(e, indices, async (ctx) => {
    const previo = await D.findOne({
      organizacion: ctx.contexto.organizacionId,
      clave_creacion: k,
    })
      .select("+huella_creacion")
      .session(ctx.session)
      .lean();
    if (previo) {
      if (previo.huella_creacion !== huella) fallo("CLAVE_REUTILIZADA");
      return dto(previo, true);
    }
    await referencias(d, ctx);
    const [nuevo] = await D.create(
      [
        {
          ...d,
          organizacion: ctx.contexto.organizacionId,
          creado_por: ctx.contexto.membresiaId,
          clave_creacion: k,
          huella_creacion: huella,
        },
      ],
      { session: ctx.session },
    );
    await registrar(ctx, nuevo, "documento_creado", null);
    return dto(nuevo, true);
  });
}
async function documentoAdmin(e, ctx) {
  const d = await D.findOne({
    _id: id(e.documentoId),
    organizacion: ctx.contexto.organizacionId,
  })
    .session(ctx.session)
    .lean();
  if (!d) fallo("RECURSO_NO_DISPONIBLE");
  if (d.__v !== version(e.version)) fallo("VERSION_DESACTUALIZADA");
  return d;
}
async function guardar(d, cambios, ctx) {
  const nuevo = await D.findOneAndUpdate(
    { _id: d._id, organizacion: d.organizacion, __v: d.__v },
    { $set: cambios, $inc: { __v: 1 } },
    { session: ctx.session, new: true, runValidators: true },
  ).lean();
  if (!nuevo) fallo("VERSION_DESACTUALIZADA");
  return nuevo;
}
async function modificarDocumento(e) {
  if (!["actualizar", "archivar", "restaurar"].includes(e.accion))
    fallo("DATOS_INVALIDOS");
  const cambios =
    e.accion === "actualizar"
      ? datos(e.datos, false)
      : { estado: e.accion === "archivar" ? "archivado" : "activo" };
  return transaccionAdmin(e, indices, async (ctx) => {
    const d = await documentoAdmin(e, ctx);
    if (
      (e.accion === "restaurar" && d.estado !== "archivado") ||
      (e.accion !== "restaurar" && d.estado !== "activo")
    )
      fallo("TRANSICION_INVALIDA");
    await referencias(cambios, ctx);
    const nuevo = await guardar(d, cambios, ctx);
    const comparticion =
      Object.hasOwn(cambios, "lectores") ||
      Object.hasOwn(cambios, "unidades_lectoras");
    const accion =
      e.accion === "actualizar"
        ? comparticion
          ? "documento_compartido"
          : "documento_actualizado"
        : e.accion === "archivar"
          ? "documento_archivado"
          : "documento_restaurado";
    await registrar(ctx, nuevo, accion, d);
    return dto(nuevo, true);
  });
}
function comprobarPdf(buffer, nombre) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 20 || buffer.length > MAX_PDF)
    fallo("PDF_INVALIDO");
  const n = texto(nombre, 180);
  if (
    !/\.pdf$/i.test(n) ||
    /[\\/\x00-\x1f\x7f]/.test(n) ||
    !/^%PDF-(?:1\.[0-7]|2\.0)/.test(buffer.subarray(0, 9).toString("ascii")) ||
    !buffer
      .subarray(Math.max(0, buffer.length - 2048))
      .toString("latin1")
      .includes("%%EOF")
  )
    fallo("PDF_INVALIDO");
  // Firma/tamaño/extensión, NO análisis antivirus ni validación jurídica.
  return {
    nombre: n,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}
async function subirVersion(e) {
  const info = comprobarPdf(e.contenido, e.nombre),
    k = clave(e.clave),
    docId = id(e.documentoId);
  version(e.version);
  return transaccionAdmin(e, indices, async (ctx) => {
    const d = await D.findOne({
      _id: docId,
      organizacion: ctx.contexto.organizacionId,
    })
      .session(ctx.session)
      .lean();
    if (!d) fallo("RECURSO_NO_DISPONIBLE");
    const previo = await V.findOne({
      documento: docId,
      clave: k,
      organizacion: d.organizacion,
    })
      .session(ctx.session)
      .lean();
    if (previo) {
      if (previo.sha256 !== info.sha256 || previo.nombre !== info.nombre)
        fallo("CLAVE_REUTILIZADA");
      return versionDto(previo);
    }
    if (d.__v !== e.version) fallo("VERSION_DESACTUALIZADA");
    if (d.estado !== "activo") fallo("TRANSICION_INVALIDA");
    const [suma] = await V.aggregate([
      { $match: { organizacion: d.organizacion } },
      { $group: { _id: null, total: { $sum: "$tamano" } } },
    ]).session(ctx.session);
    if ((suma?.total || 0) + e.contenido.length > CUOTA)
      fallo("CUOTA_DOCUMENTOS");
    const [v] = await V.create(
      [
        {
          ...info,
          organizacion: d.organizacion,
          documento: d._id,
          numero: d.version_actual + 1,
          tamano: e.contenido.length,
          contenido: e.contenido,
          creado_por: ctx.contexto.membresiaId,
          clave: k,
        },
      ],
      { session: ctx.session },
    );
    const nuevo = await guardar(d, { version_actual: v.numero }, ctx);
    await registrar(ctx, nuevo, "documento_version_anadida", d, {
      tamano: v.tamano,
      sha256: v.sha256,
    });
    return versionDto(v);
  });
}
async function autorizado(e, a) {
  const d = await lectura(
    D.findOne({ ...a.filtro, _id: id(e.documentoId) }),
  ).lean();
  if (!d) fallo("RECURSO_NO_DISPONIBLE");
  return d;
}
async function comprobarLectura(e, a, d) {
  const actual = await revalidar(e, a);
  const vigente = await autorizado(e, actual);
  if (vigente.__v !== d.__v) fallo("VERSION_DESACTUALIZADA");
}
async function obtenerDocumento(e) {
  const a = await acceso(e),
    d = await autorizado(e, a);
  await comprobarLectura(e, a, d);
  return dto(d, a.contexto.rol === "administrador");
}
async function listarDocumentos(e) {
  const f = e.filtros || {};
  campos(f, ["subespacioId", "estado", "despues", "limite"]);
  if (f.estado && !["activo", "archivado"].includes(f.estado))
    fallo("DATOS_INVALIDOS");
  if (
    f.limite !== undefined &&
    (typeof f.limite !== "string" || !/^([1-9][0-9]?|100)$/.test(f.limite))
  )
    fallo("DATOS_INVALIDOS");
  const limite = Number(f.limite || 50),
    a = await acceso(e),
    q = { ...a.filtro };
  if (f.estado) q.estado = f.estado;
  if (f.subespacioId) q["vinculos.subespacio"] = id(f.subespacioId);
  if (f.despues) q._id = { $gt: id(f.despues) };
  const docs = await lectura(D.find(q))
    .sort({ _id: 1 })
    .limit(limite + 1)
    .lean();
  const vigente = await revalidar(e, a);
  const comprobados = await lectura(
    D.find({ ...vigente.filtro, _id: { $in: docs.map((d) => d._id) } }).select(
      "_id __v",
    ),
  )
    .limit(limite + 1)
    .lean();
  if (
    comprobados.length !== docs.length ||
    docs.some(
      (d) =>
        !comprobados.some(
          (c) => String(c._id) === String(d._id) && c.__v === d.__v,
        ),
    )
  )
    fallo("VERSION_DESACTUALIZADA");
  return {
    documentos: docs
      .slice(0, limite)
      .map((d) => dto(d, a.contexto.rol === "administrador")),
    siguiente: docs.length > limite ? String(docs[limite - 1]._id) : null,
  };
}
async function versionesDocumento(e) {
  const a = await acceso(e),
    d = await autorizado(e, a);
  const f = e.filtros || {};
  campos(f, ["antes"]);
  const q = { documento: d._id, organizacion: d.organizacion };
  if (f.antes !== undefined) {
    if (typeof f.antes !== "string" || !/^\d{1,9}$/.test(f.antes))
      fallo("DATOS_INVALIDOS");
    q.numero = { $lt: Number(f.antes) };
  }
  const docs = await lectura(V.find(q)).sort({ numero: -1 }).limit(51).lean();
  await comprobarLectura(e, a, d);
  return {
    versiones: docs.slice(0, 50).map(versionDto),
    siguiente: docs.length > 50 ? docs[49].numero : null,
  };
}
async function descargarVersion(e) {
  const a = await acceso(e),
    d = await autorizado(e, a);
  if (typeof e.numero !== "string" || !/^[1-9]\d{0,8}$/.test(e.numero))
    fallo("DATOS_INVALIDOS");
  const v = await lectura(
    V.findOne({
      documento: d._id,
      organizacion: d.organizacion,
      numero: Number(e.numero),
    }).select("+contenido"),
  ).lean();
  if (!v) fallo("RECURSO_NO_DISPONIBLE");
  await comprobarLectura(e, a, d);
  const buffer = Buffer.isBuffer(v.contenido)
    ? v.contenido
    : Buffer.from(v.contenido.buffer);
  if (
    buffer.length !== v.tamano ||
    crypto.createHash("sha256").update(buffer).digest("hex") !== v.sha256
  )
    fallo("SERVICIO_NO_DISPONIBLE");
  return { ...versionDto(v), contenido: buffer };
}
module.exports = {
  crearDocumento,
  modificarDocumento,
  subirVersion,
  obtenerDocumento,
  listarDocumentos,
  versionesDocumento,
  descargarVersion,
  comprobarPdf,
  datos,
  MAX_PDF,
  CUOTA,
};
