"use strict";
const mongoose = require("mongoose");
const { referencia } = require("../services/datosOrganizacion");
// Cada versión es un documento BSON < 16 MiB: límite deliberado de PDF 5 MiB.
// No hay actualizaciones ni borrados de versiones mediante la API.
const schema = new mongoose.Schema(
  {
    organizacion: { ...referencia("Organizacion"), required: true },
    documento: { ...referencia("DocumentoOrganizacion"), required: true },
    numero: { type: Number, required: true, min: 1 },
    nombre: { type: String, cast: false, required: true, maxlength: 180 },
    tamano: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
    sha256: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    contenido: { type: Buffer, required: true, select: false },
    creado_por: { ...referencia("Membresia"), required: true },
    clave: { type: String, required: true, select: false },
    // No equivale a documento validado, evidencia suficiente ni fichero seguro.
    analisis_malware: {
      type: String,
      enum: ["no_realizado"],
      default: "no_realizado",
    },
  },
  {
    collection: "versiones_documento",
    timestamps: { createdAt: true, updatedAt: false },
    strict: "throw",
    versionKey: false,
  },
);
schema.index(
  { documento: 1, numero: 1 },
  { unique: true, name: "documento_version_unica" },
);
schema.index(
  { documento: 1, clave: 1 },
  { unique: true, name: "documento_reintento_unico" },
);
schema.index({ organizacion: 1, createdAt: -1 });
module.exports = mongoose.model("VersionDocumento", schema);
