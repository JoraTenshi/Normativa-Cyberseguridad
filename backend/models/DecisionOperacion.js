'use strict';
const mongoose = require('mongoose');
const { referencia, id } = require('../services/datosOrganizacion');
const { resultadoValido } = require('../validation/decisionAplicabilidad');
const ref = nombre => ({ ...referencia(nombre), required: true, immutable: true });
const positivo = { type: Number, cast: false, required: true, immutable: true, min: 1, max: 999999999, validate: Number.isSafeInteger };
// Solo inserciones desde el servicio. No representa certificación ni revisión humana.
const schema = new mongoose.Schema({
  organizacion: ref('Organizacion'), operacion: ref('Operacion'),
  revision_contexto: ref('RevisionOperacion'), version_contexto: positivo,
  numero: positivo,
  regla_id: { type: String, cast: false, required: true, immutable: true, match: /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/ },
  version_regla: positivo,
  anterior: { ...referencia('DecisionOperacion'), set: v => v == null ? null : id(v), immutable: true, default: null },
  actor: ref('Usuario'), membresia_actor: ref('Membresia'),
  motivo: { type: String, cast: false, required: true, immutable: true, maxlength: 300 },
  resultado: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true, validate: resultadoValido },
  sha256: { type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/ },
  clave_operacion: { type: String, required: true, immutable: true, select: false, match: /^[a-z0-9_-]{16,100}$/i },
  huella_operacion: { type: String, required: true, immutable: true, select: false, match: /^[a-f0-9]{64}$/ }
}, { collection: 'decisiones_operacion', timestamps: { createdAt: true, updatedAt: false },
  versionKey: false, strict: 'throw' });
schema.index({ operacion: 1, numero: 1 }, { unique: true, name: 'decision_por_operacion_numero_unico' });
schema.index({ organizacion: 1, clave_operacion: 1 }, { unique: true, name: 'decision_por_operacion_reintento_unico' });
schema.index({ organizacion: 1, operacion: 1, regla_id: 1, numero: -1 });
module.exports = mongoose.model('DecisionOperacion', schema);
