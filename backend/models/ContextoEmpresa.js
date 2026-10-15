'use strict';
const mongoose = require('mongoose');
const { referencia } = require('../services/datosOrganizacion');
const schema = new mongoose.Schema({
  organizacion: { ...referencia('Organizacion'), required: true, immutable: true },
  version_actual: { type: Number, cast: false, required: true, min: 1, max: 999999999, validate: Number.isSafeInteger }
}, { collection: 'contextos_empresa', timestamps: true, strict: 'throw', optimisticConcurrency: true });
schema.index({ organizacion: 1 }, { unique: true, name: 'contexto_empresa_unico' });
module.exports = mongoose.model('ContextoEmpresa', schema);
