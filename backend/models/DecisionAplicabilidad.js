'use strict';
const mongoose = require('mongoose');
const { referencia, id } = require('../services/datosOrganizacion');
const { resultadoValido } = require('../validation/decisionAplicabilidad');
const ref = nombre => ({ ...referencia(nombre), required: true, immutable: true });
const positivo = { type: Number, cast: false, required: true, immutable: true, min: 1, max: 999999999, validate: Number.isSafeInteger };
// Solo inserciones desde el servicio. No representa certificación ni revisión humana.
const schema = new mongoose.Schema({
  organizacion: ref('Organizacion'), contexto: ref('ContextoEmpresa'),
  revision_contexto: ref('RevisionContextoEmpresa'), version_contexto: positivo,
  numero: positivo,
  regla_id: { type: String, cast: false, required: true, immutable: true, match: /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/ },
  version_regla: positivo,
  anterior: { ...referencia('DecisionAplicabilidad'), set: v => v == null ? null : id(v), immutable: true, default: null },
  actor: ref('Usuario'), membresia_actor: ref('Membresia'),
  motivo: { type: String, cast: false, required: true, immutable: true, maxlength: 300 },
  resultado: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true, validate: resultadoValido },
  sha256: { type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/ },
  clave_operacion: { type: String, required: true, immutable: true, select: false, match: /^[a-z0-9_-]{16,100}$/i },
  huella_operacion: { type: String, required: true, immutable: true, select: false, match: /^[a-f0-9]{64}$/ }
}, { collection: 'decisiones_aplicabilidad', timestamps: { createdAt: true, updatedAt: false },
  versionKey: false, strict: 'throw' });
schema.index({ contexto: 1, numero: 1 }, { unique: true, name: 'decision_contexto_numero_unico' });
schema.index({ organizacion: 1, clave_operacion: 1 }, { unique: true, name: 'decision_operacion_unica' });
schema.index({ organizacion: 1, contexto: 1, regla_id: 1, numero: -1 });
module.exports = mongoose.model('DecisionAplicabilidad', schema);
