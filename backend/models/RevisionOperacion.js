'use strict';
const mongoose = require('mongoose');
const { referencia } = require('../services/datosOrganizacion');
const { validarContenido } = require('../validation/operacion');
const schema = new mongoose.Schema({
  organizacion: { ...referencia('Organizacion'), required: true, immutable: true },
  operacion: { ...referencia('Operacion'), required: true, immutable: true },
  numero: { type: Number, cast: false, required: true, immutable: true, min: 1, max: 999999999, validate: Number.isSafeInteger },
  contenido: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true, validate: validarContenido },
  actor: { ...referencia('Usuario'), required: true, immutable: true },
  membresia_actor: { ...referencia('Membresia'), required: true, immutable: true },
  motivo: { type: String, cast: false, required: true, immutable: true, maxlength: 300 },
  sha256: { type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/ },
  clave_operacion: { type: String, required: true, immutable: true, select: false, match: /^[a-z0-9_-]{16,100}$/i },
  huella_operacion: { type: String, required: true, immutable: true, select: false, match: /^[a-f0-9]{64}$/ }
}, { collection: 'revisiones_operacion', timestamps: { createdAt: true, updatedAt: false }, versionKey: false, strict: 'throw' });
schema.index({ operacion: 1, numero: 1 }, { unique: true, name: 'revision_operacion_numero_unico' });
schema.index({ organizacion: 1, clave_operacion: 1 }, { unique: true, name: 'revision_operacion_reintento_unico' });
module.exports = mongoose.model('RevisionOperacion', schema);
