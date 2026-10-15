"use strict";
const mongoose = require("mongoose");
const { referencia } = require("../services/datosOrganizacion");
// Servicio/producto, nunca unidad de personas. Empresa obligatoria y sin árbol.
const schema = new mongoose.Schema(
  {
    organizacion: { ...referencia("Organizacion"), required: true },
    nombre: {
      type: String,
      cast: false,
      required: true,
      trim: true,
      maxlength: 120,
    },
    tipo: {
      type: String,
      cast: false,
      required: true,
      enum: ["servicio", "producto"],
    },
    descripcion: {
      type: String,
      cast: false,
      required: true,
      trim: true,
      maxlength: 500,
    },
    estado: {
      type: String,
      enum: ["activo", "archivado"],
      default: "activo",
      required: true,
    },
    creado_por: { ...referencia("Membresia"), required: true },
    clave_creacion: { type: String, required: true, select: false },
    huella_creacion: { type: String, required: true, select: false },
  },
  {
    collection: "subespacios",
    timestamps: true,
    strict: "throw",
    optimisticConcurrency: true,
  },
);
schema.index(
  { organizacion: 1, clave_creacion: 1 },
  { unique: true, name: "subespacio_creacion_unica" },
);
schema.index({ organizacion: 1, estado: 1, _id: 1 });
module.exports = mongoose.model("Subespacio", schema);
