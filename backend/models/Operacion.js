'use strict';
const mongoose = require('mongoose');
const { referencia, id } = require('../services/datosOrganizacion');
// Cabecera actual. No es una unidad ni exige contexto general/subespacio.
const schema = new mongoose.Schema({
  organizacion: { ...referencia('Organizacion'), required: true, immutable: true },
  nombre: { type: String, cast: false, required: true, maxlength: 120 },
  descripcion: { type: String, cast: false, required: true, maxlength: 500 },
  subespacio: { ...referencia('Subespacio'), default: null, set: v => v == null ? null : id(v) },
  version_actual: { type: Number, cast: false, required: true, min: 1, max: 999999999, validate: Number.isSafeInteger }
}, { collection: 'operaciones', timestamps: true, strict: 'throw', optimisticConcurrency: true });
schema.index({ organizacion: 1, _id: -1 });
schema.index({ organizacion: 1, subespacio: 1, _id: -1 });
module.exports = mongoose.model('Operacion', schema);
