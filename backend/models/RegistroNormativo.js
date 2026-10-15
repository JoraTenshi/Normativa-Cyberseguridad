'use strict';
const mongoose = require('mongoose');
const { referencia } = require('../services/datosOrganizacion');
// Cabeceras del módulo C2. El contenido tipado vive en versiones inmutables;
// no sustituye Operacion, AlcanceEvaluacion, documentos ni permisos existentes.
const tipos = ['sistema', 'requisito', 'actuacion', 'evidencia', 'revision', 'sujeto_funcional', 'designacion'];
const schema = new mongoose.Schema({
  organizacion: { ...referencia('Organizacion'), required: true, immutable: true },
  tipo: { type: String, enum: tipos, required: true, immutable: true },
  clave_negocio: { type: String, required: true, immutable: true, maxlength: 300 },
  version_actual: { type: Number, cast: false, required: true, min: 1, max: 999999999, validate: Number.isSafeInteger },
  titulo: { type: String, cast: false, required: true, maxlength: 300 },
  alcance_ids: { type: [{ ...referencia('AlcanceEvaluacion') }], default: [] },
  requisito_ids: { type: [{ ...referencia('RegistroNormativo') }], default: [] },
  ultima_revision: { ...referencia('RegistroNormativo'), default: null }
}, { collection: 'registros_normativos', timestamps: true, strict: 'throw', optimisticConcurrency: true });
schema.index({ organizacion: 1, tipo: 1, clave_negocio: 1 }, { unique: true, name: 'registro_normativo_identidad_unica' });
schema.index({ organizacion: 1, tipo: 1, _id: -1 });
schema.index({ organizacion: 1, tipo: 1, alcance_ids: 1, _id: -1 });
schema.index({ organizacion: 1, tipo: 1, requisito_ids: 1, _id: -1 });
module.exports = mongoose.model('RegistroNormativo', schema);
