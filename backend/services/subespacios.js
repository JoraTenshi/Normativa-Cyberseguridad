"use strict";
const crypto = require("node:crypto");
const S = require("../models/Subespacio");
const E = require("../models/EventoOrganizacion");
const { transaccionAdmin } = require("./transaccionOrganizacion");
const {
  acceso,
  revalidar,
  visibles,
  firmaDocumentos,
  lectura,
} = require("./accesoDocumental");
const {
  campos,
  texto,
  id,
  version,
  clave,
  fallo,
} = require("./datosOrganizacion");
const indices = [
  [S, "subespacio_creacion_unica", { organizacion: 1, clave_creacion: 1 }],
];
function datos(v, alta) {
  campos(v, ["nombre", "tipo", "descripcion"]);
  if (!Object.keys(v).length) fallo("DATOS_INVALIDOS");
  const salida = {};
  for (const [k, max] of [
    ["nombre", 120],
    ["descripcion", 500],
  ]) {
    if (alta || Object.hasOwn(v, k)) salida[k] = texto(v[k], max);
  }
  if (alta || Object.hasOwn(v, "tipo")) {
    if (!["servicio", "producto"].includes(v.tipo)) fallo("DATOS_INVALIDOS");
    salida.tipo = v.tipo;
  }
  return salida;
}
function resumen(d) {
  return {
    nombre: d.nombre,
    tipo: d.tipo,
    descripcion: d.descripcion,
    estado: d.estado,
    version: d.__v,
  };
}
const dto = (d) => ({
  id: String(d._id),
  organizacionId: String(d.organizacion),
  ...resumen(d),
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});
async function evento(ctx, d, accion, antes) {
  await E.create(
    [
      {
        organizacion: ctx.contexto.organizacionId,
        actor: ctx.contexto.usuarioId,
        membresia_actor: ctx.contexto.membresiaId,
        subespacio: d._id,
        accion,
        antes: antes ? resumen(antes) : null,
        despues: resumen(d),
      },
    ],
    { session: ctx.session },
  );
}
async function crearSubespacio(e) {
  const d = datos(e.datos, true),
    k = clave(e.clave);
  const huella = crypto
    .createHash("sha256")
    .update(JSON.stringify([id(e.usuarioId), d]))
    .digest("hex");
  return transaccionAdmin(e, indices, async (ctx) => {
    const previo = await S.findOne({
      organizacion: ctx.contexto.organizacionId,
      clave_creacion: k,
    })
      .select("+huella_creacion")
      .session(ctx.session)
      .lean();
    if (previo) {
      if (previo.huella_creacion !== huella) fallo("CLAVE_REUTILIZADA");
      return dto(previo);
    }
    const [nuevo] = await S.create(
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
    await evento(ctx, nuevo, "subespacio_creado", null);
    return dto(nuevo);
  });
}
async function modificarSubespacio(e) {
  const identificador = id(e.subespacioId),
    revision = version(e.version);
  if (!["actualizar", "archivar", "restaurar"].includes(e.accion))
    fallo("DATOS_INVALIDOS");
  const cambios =
    e.accion === "actualizar"
      ? datos(e.datos, false)
      : { estado: e.accion === "archivar" ? "archivado" : "activo" };
  return transaccionAdmin(e, indices, async (ctx) => {
    const d = await S.findOne({
      _id: identificador,
      organizacion: ctx.contexto.organizacionId,
    })
      .session(ctx.session)
      .lean();
    if (!d) fallo("RECURSO_NO_DISPONIBLE");
    if (d.__v !== revision) fallo("VERSION_DESACTUALIZADA");
    if (
      (e.accion === "restaurar" && d.estado !== "archivado") ||
      (e.accion !== "restaurar" && d.estado !== "activo")
    )
      fallo("TRANSICION_INVALIDA");
    const nuevo = await S.findOneAndUpdate(
      { _id: d._id, organizacion: d.organizacion, __v: revision },
      { $set: cambios, $inc: { __v: 1 } },
      { session: ctx.session, new: true, runValidators: true },
    ).lean();
    if (!nuevo) fallo("VERSION_DESACTUALIZADA");
    await evento(
      ctx,
      nuevo,
      {
        actualizar: "subespacio_actualizado",
        archivar: "subespacio_archivado",
        restaurar: "subespacio_restaurado",
      }[e.accion],
      d,
    );
    return dto(nuevo);
  });
}
async function listarSubespacios(e) {
  campos(e.filtros || {}, ["estado", "despues", "limite"]);
  const f = e.filtros || {};
  if (f.estado && !["activo", "archivado"].includes(f.estado))
    fallo("DATOS_INVALIDOS");
  const limite = f.limite === undefined ? 50 : Number(f.limite);
  if (
    f.limite !== undefined &&
    (typeof f.limite !== "string" || !/^([1-9][0-9]?|100)$/.test(f.limite))
  )
    fallo("DATOS_INVALIDOS");
  const a = await acceso(e),
    q = { organizacion: a.contexto.organizacionId };
  let recursos = [];
  if (a.contexto.rol !== "administrador") {
    recursos = await visibles(e, a);
    q._id = {
      $in: [
        ...new Set(
          recursos.flatMap((d) => d.vinculos.map((v) => String(v.subespacio))),
        ),
      ],
    };
  }
  if (f.estado) q.estado = f.estado;
  if (f.despues) q._id = { ...(q._id || {}), $gt: id(f.despues) };
  const docs = await lectura(S.find(q))
    .sort({ _id: 1 })
    .limit(limite + 1)
    .lean();
  await revalidar(e, a);
  if (
    a.contexto.rol !== "administrador" &&
    firmaDocumentos(recursos) !== firmaDocumentos(await visibles(e, a))
  )
    fallo("RECURSO_NO_DISPONIBLE");
  return {
    subespacios: docs.slice(0, limite).map(dto),
    siguiente: docs.length > limite ? String(docs[limite - 1]._id) : null,
  };
}
async function obtenerSubespacio(e) {
  const identificador = id(e.subespacioId),
    a = await acceso(e);
  let recursos = [];
  if (a.contexto.rol !== "administrador") {
    recursos = await visibles(e, a);
    if (
      !recursos.some((d) =>
        d.vinculos.some((v) => String(v.subespacio) === identificador),
      )
    )
      fallo("RECURSO_NO_DISPONIBLE");
  }
  const d = await lectura(
    S.findOne({ _id: identificador, organizacion: a.contexto.organizacionId }),
  ).lean();
  if (!d) fallo("RECURSO_NO_DISPONIBLE");
  await revalidar(e, a);
  if (
    a.contexto.rol !== "administrador" &&
    firmaDocumentos(recursos) !== firmaDocumentos(await visibles(e, a))
  )
    fallo("RECURSO_NO_DISPONIBLE");
  return dto(d);
}
module.exports = {
  crearSubespacio,
  modificarSubespacio,
  listarSubespacios,
  obtenerSubespacio,
  datos,
};
