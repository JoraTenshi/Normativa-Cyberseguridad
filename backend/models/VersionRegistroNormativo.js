'use strict';
const mongoose = require('mongoose');
const { referencia } = require('../services/datosOrganizacion');
const schema = new mongoose.Schema({
  organizacion: { ...referencia('Organizacion'), required: true, immutable: true },
  registro: { ...referencia('RegistroNormativo'), required: true, immutable: true },
  numero: { type: Number, cast: false, required: true, immutable: true, min: 1, max: 999999999, validate: Number.isSafeInteger },
  contenido: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  sha256: { type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/ },
  actor: { ...referencia('Usuario'), required: true, immutable: true },
  membresia_actor: { ...referencia('Membresia'), required: true, immutable: true },
  motivo: { type: String, cast: false, required: true, immutable: true, maxlength: 2000 },
  clave_operacion: { type: String, required: true, immutable: true, select: false, match: /^[a-z0-9_-]{16,100}$/i },
  huella_operacion: { type: String, required: true, immutable: true, select: false, match: /^[a-f0-9]{64}$/ }
}, { collection: 'versiones_registro_normativo', timestamps: { createdAt: true, updatedAt: false }, versionKey: false, strict: 'throw' });
schema.index({ registro: 1, numero: 1 }, { unique: true, name: 'registro_normativo_version_unica' });
schema.index({ organizacion: 1, clave_operacion: 1 }, { unique: true, name: 'registro_normativo_reintento_unico' });
module.exports = mongoose.model('VersionRegistroNormativo', schema);
