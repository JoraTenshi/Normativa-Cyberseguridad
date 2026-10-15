'use strict';
const mongoose = require('mongoose');
const { referencia } = require('../services/datosOrganizacion');
const { validarHechosGuardados } = require('../validation/contextoEmpresa');
// Instantáneas completas. El servicio solo inserta; no hay API de edición/borrado.
// No se promete inmutabilidad frente a quien administra directamente MongoDB.
const schema = new mongoose.Schema({
  organizacion: { ...referencia('Organizacion'), required: true, immutable: true },
  contexto: { ...referencia('ContextoEmpresa'), required: true, immutable: true },
  numero: { type: Number, cast: false, required: true, immutable: true, min: 1, max: 999999999, validate: Number.isSafeInteger },
  hechos: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true, validate: validarHechosGuardados },
  actor: { ...referencia('Usuario'), required: true, immutable: true },
  membresia_actor: { ...referencia('Membresia'), required: true, immutable: true },
  motivo: { type: String, cast: false, required: true, immutable: true, maxlength: 300 },
  sha256: { type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/ },
  clave_operacion: { type: String, required: true, immutable: true, select: false, match: /^[a-z0-9_-]{16,100}$/i },
  huella_operacion: { type: String, required: true, immutable: true, select: false, match: /^[a-f0-9]{64}$/ }
}, { collection: 'revisiones_contexto_empresa', timestamps: { createdAt: true, updatedAt: false }, versionKey: false, strict: 'throw' });
schema.index({ contexto: 1, numero: 1 }, { unique: true, name: 'revision_contexto_unica' });
schema.index({ organizacion: 1, clave_operacion: 1 }, { unique: true, name: 'contexto_operacion_unica' });
module.exports = mongoose.model('RevisionContextoEmpresa', schema);
