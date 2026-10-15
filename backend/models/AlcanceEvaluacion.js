'use strict';
const mongoose = require('mongoose');
const { referencia } = require('../services/datosOrganizacion');
const schema = new mongoose.Schema({
  organizacion: { ...referencia('Organizacion'), required: true, immutable: true },
  nombre: { type: String, cast: false, required: true, maxlength: 120 },
  version_actual: { type: Number, cast: false, required: true, min: 1, max: 999999999, validate: Number.isSafeInteger },
  estado: { type: String, enum: ['preliminar'], default: 'preliminar' }
}, { collection: 'alcances_evaluacion', timestamps: true, strict: 'throw', optimisticConcurrency: true });
schema.index({ organizacion: 1, _id: -1 });
module.exports = mongoose.model('AlcanceEvaluacion', schema);
