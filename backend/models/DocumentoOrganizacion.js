"use strict";
const mongoose = require("mongoose");
const { referencia } = require("../services/datosOrganizacion");
const vinculo = new mongoose.Schema(
  {
    subespacio: { ...referencia("Subespacio"), required: true },
    motivo: { type: String, cast: false, required: true, maxlength: 300 },
  },
  { _id: false, strict: "throw" },
);
// Metadatos separados de los bytes: ningún listado devuelve contenido binario.
const schema = new mongoose.Schema(
  {
    organizacion: { ...referencia("Organizacion"), required: true },
    titulo: { type: String, cast: false, required: true, maxlength: 120 },
    categoria_documental: {
      type: String,
      enum: ["corporativa", "legal"],
      required: true,
    },
    estado: { type: String, enum: ["activo", "archivado"], default: "activo" },
    vinculos: { type: [vinculo], default: [] },
    lectores: { type: [referencia("Membresia")], default: [] },
    unidades_lectoras: { type: [referencia("UnidadTrabajo")], default: [] },
    version_actual: { type: Number, default: 0, min: 0 },
    creado_por: { ...referencia("Membresia"), required: true },
    clave_creacion: { type: String, required: true, select: false },
    huella_creacion: { type: String, required: true, select: false },
  },
  {
    collection: "documentos_organizacion",
    timestamps: true,
    strict: "throw",
    optimisticConcurrency: true,
  },
);
schema.index(
  { organizacion: 1, clave_creacion: 1 },
  { unique: true, name: "documento_creacion_unica" },
);
schema.index({ organizacion: 1, "vinculos.subespacio": 1 });
schema.index({ organizacion: 1, lectores: 1 });
schema.index({ organizacion: 1, unidades_lectoras: 1 });
module.exports = mongoose.model("DocumentoOrganizacion", schema);
