"use strict";
const crypto = require("node:crypto");
const D = require("../models/DocumentoOrganizacion");
const P = require("../models/MembresiaUnidad");
const U = require("../models/UnidadTrabajo");
const { obtenerContextoOrganizacion } = require("./contextoOrganizacion");
const { fallo, id } = require("./datosOrganizacion");
const lectura = (q) => q.read("primary").maxTimeMS(5000);
async function acceso(entrada) {
  const contexto = await obtenerContextoOrganizacion(entrada);
  const unidades = [];
  if (contexto.rol !== "administrador") {
    const relaciones = await lectura(
      P.find({ membresia: contexto.membresiaId }).select(
        "unidad membresia estado",
      ),
    )
      .limit(501)
      .lean();
    if (relaciones.length > 500) fallo("SERVICIO_NO_DISPONIBLE");
    const vistas = new Set(),
      activas = [];
    for (const r of relaciones) {
      const unidad = id(r.unidad);
      if (vistas.has(unidad) || String(r.membresia) !== contexto.membresiaId)
        fallo("RECURSO_NO_DISPONIBLE");
      vistas.add(unidad);
      if (r.estado === "activa") activas.push(unidad);
    }
    const docs = await lectura(
      U.find({
        _id: { $in: activas },
        organizacion: contexto.organizacionId,
        estado: "activa",
      }).select("_id"),
    )
      .limit(501)
      .lean();
    unidades.push(...docs.map((x) => String(x._id)).sort());
  }
  const filtro = { organizacion: contexto.organizacionId };
  if (contexto.rol !== "administrador") {
    filtro.version_actual = { $gt: 0 };
    filtro.$or = [
      { lectores: contexto.membresiaId },
      { unidades_lectoras: { $in: unidades } },
    ];
  }
  const huella = crypto
    .createHash("sha256")
    .update(JSON.stringify([contexto, unidades]))
    .digest("hex");
  return { contexto, unidades, filtro, huella };
}
async function revalidar(entrada, anterior) {
  const actual = await acceso(entrada);
  if (actual.huella !== anterior.huella) fallo("RECURSO_NO_DISPONIBLE");
  return actual;
}
async function visibles(entrada, a) {
  const docs = await lectura(D.find(a.filtro).select("_id vinculos __v"))
    .limit(501)
    .lean();
  if (docs.length > 500) fallo("SERVICIO_NO_DISPONIBLE");
  return docs;
}
function firmaDocumentos(docs) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        docs
          .map((d) => [
            String(d._id),
            d.__v,
            d.vinculos.map((v) => String(v.subespacio)).sort(),
          ])
          .sort((a, b) => a[0].localeCompare(b[0])),
      ),
    )
    .digest("hex");
}
module.exports = { acceso, revalidar, visibles, firmaDocumentos, lectura };
