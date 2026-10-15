'use strict';
const mongoose = require('mongoose');
const { referencia } = require('../services/datosOrganizacion');
const schema = new mongoose.Schema({
  organizacion: { ...referencia('Organizacion'), required: true, immutable: true },
  actor: { ...referencia('Usuario'), required: true, immutable: true },
  propuesta_sha256: { type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/ },
  clave_operacion: { type: String, required: true, immutable: true, select: false, match: /^[a-z0-9_-]{16,100}$/i },
  huella_operacion: { type: String, required: true, immutable: true, select: false, match: /^[a-f0-9]{64}$/ },
  resultado: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  resultado_sha256: { type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/ }
}, { collection: 'materializaciones_perfil', timestamps: { createdAt: true, updatedAt: false }, versionKey: false, strict: 'throw' });
schema.index({ organizacion: 1, clave_operacion: 1 }, { unique: true, name: 'perfil_reintento_unico' });
schema.index({ organizacion: 1, propuesta_sha256: 1 }, { unique: true, name: 'perfil_propuesta_unica' });
module.exports = mongoose.model('MaterializacionPerfil', schema);
