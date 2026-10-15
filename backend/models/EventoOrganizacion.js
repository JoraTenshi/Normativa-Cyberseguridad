'use strict';

const mongoose = require('mongoose');

function idEstricto(valor) {
  if (valor == null || mongoose.isObjectIdOrHexString(valor)) return valor;
  throw new TypeError('Se requiere un ObjectId o hexadecimal de 24 caracteres.');
}
const referencia = ref => ({
  type: mongoose.Schema.Types.ObjectId, ref, required: true, set: idEstricto
});
const ResumenSchema = new mongoose.Schema({
  tipo: { type: String, cast: false },
  subespacio_id: { type: String, cast: false, match: /^[a-f0-9]{24}$/ },
  regla_id: { type: String, cast: false, match: /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/ },
  version_regla: { type: Number, min: 1, validate: Number.isSafeInteger },
  version_contexto: { type: Number, min: 1, validate: Number.isSafeInteger },
  temporal: { type: String, enum: ['por_determinar', 'futura', 'en_periodo', 'finalizada'] },
  claves_cambiadas: { type: [String], default: undefined, validate: v => v === undefined || (v.length <= 200 && v.every(k => /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(k))) },
  titulo: { type: String, cast: false, maxlength: 120 },
  numero: { type: Number, min: 0 },
  tamano: { type: Number, min: 0 },
  sha256: { type: String, match: /^[a-f0-9]{64}$/ },
  lectores: { type: [mongoose.Schema.Types.ObjectId], default: undefined },
  unidades_lectoras: { type: [mongoose.Schema.Types.ObjectId], default: undefined },
  vinculos: { type: [new mongoose.Schema({
    subespacio: { type: mongoose.Schema.Types.ObjectId, required: true },
    motivo: { type: String, cast: false, required: true, maxlength: 300 }
  }, { _id: false, strict: 'throw' })], default: undefined },
  nombre: { type: String, cast: false, maxlength: 120 },
  descripcion: { type: String, cast: false, maxlength: 500 },
  estado: { type: String, cast: false },
  rol: { type: String, cast: false, enum: ['miembro', 'coordinador'] },
  version: { type: Number, required: true, min: 0, validate: Number.isSafeInteger }
}, { _id: false, strict: 'throw' });

// Historial funcional interno: solo el servicio lo escribe en la MISMA
// transaccion que el cambio. No es evidencia de cumplimiento ni un log
// inalterable frente a un administrador de MongoDB. Sin API de edicion/borrado.
const EventoOrganizacionSchema = new mongoose.Schema({
  organizacion: referencia('Organizacion'),
  registro_normativo: { ...referencia('RegistroNormativo'), required: function() { return /^normativa_/.test(this.accion || ''); }, default: null },
  actor: referencia('Usuario'),
  membresia_actor: referencia('Membresia'),
  // Eventos antiguos conservan unidad; subespacios/documentos no inventan una.
  unidad: { ...referencia('UnidadTrabajo'), required: function() {
    return /^(unidad_|miembro_)/.test(this.accion || '') || this.accion === 'rol_unidad_cambiado';
  }, default: null },
  subespacio: { ...referencia('Subespacio'), required: function() { return /^subespacio_/.test(this.accion || ''); }, default: null },
  documento: { ...referencia('DocumentoOrganizacion'), required: function() { return /^documento_/.test(this.accion || ''); }, default: null },
  contexto: { ...referencia('ContextoEmpresa'), required: function() { return /^(contexto_|decision_aplicabilidad_)/.test(this.accion || ''); }, default: null },
  operacion: { ...referencia('Operacion'), required: function() { return /^(operacion_|decision_operacion_)/.test(this.accion || ''); }, default: null },
  alcance: { ...referencia('AlcanceEvaluacion'), required: function() { return /^alcance_/.test(this.accion || ''); }, default: null },
  decision: { ...referencia('DecisionAplicabilidad'), required: function() { return /^decision_aplicabilidad_/.test(this.accion || ''); }, default: null },
  decision_operacion: { ...referencia('DecisionOperacion'), required: function() { return /^decision_operacion_/.test(this.accion || ''); }, default: null },
  subespacios: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subespacio', set: idEstricto }], default: [] },
  membresia_unidad: {
    ...referencia('MembresiaUnidad'), required: false, default: null
  },
  accion: {
    type: String, cast: false, required: true,
    enum: [
      'unidad_creada', 'unidad_actualizada', 'unidad_activada',
      'unidad_archivada', 'unidad_restaurada',
      'miembro_anadido', 'rol_unidad_cambiado', 'miembro_activado',
      'miembro_suspendido', 'miembro_revocado', 'miembro_restaurado',
      'subespacio_creado', 'subespacio_actualizado', 'subespacio_archivado', 'subespacio_restaurado',
      'documento_creado', 'documento_actualizado', 'documento_compartido',
      'documento_archivado', 'documento_restaurado', 'documento_version_anadida',
      'contexto_creado', 'contexto_actualizado', 'decision_aplicabilidad_creada',
      'operacion_creada', 'operacion_actualizada', 'decision_operacion_creada',
      'alcance_creado', 'alcance_actualizado', 'normativa_registro_creado', 'normativa_registro_actualizado'
    ]
  },
  antes: { type: ResumenSchema, default: null },
  despues: { type: ResumenSchema, required: true }
}, {
  collection: 'eventos_organizacion',
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
  strict: 'throw'
});

// Cada familia exige su referencia; no basta con quitar required a unidad.
EventoOrganizacionSchema.pre('validate', function(next) {
  const a=this.accion || '';
  if (a.startsWith('normativa_') && (!this.registro_normativo || this.unidad || this.contexto || this.operacion || this.alcance || this.documento))
    this.invalidate('registro_normativo', 'Evento normativo sin referencia propia o con ámbito ajeno');
  if (!a.startsWith('normativa_') && this.registro_normativo) this.invalidate('registro_normativo', 'Referencia fuera de su familia');
  const unidad=a.startsWith('unidad_') || a.startsWith('miembro_') || a==='rol_unidad_cambiado';
  if(unidad && !this.unidad) this.invalidate('unidad','Evento de unidad sin unidad');
  if(a.startsWith('subespacio_') && !this.subespacio) this.invalidate('subespacio','Falta subespacio');
  if(a.startsWith('alcance_') && (!this.alcance || this.unidad || this.contexto || this.operacion || this.decision || this.decision_operacion))
    this.invalidate('alcance','Evento de alcance sin referencia propia o con ámbito ajeno');
  if(!a.startsWith('alcance_') && this.alcance) this.invalidate('alcance','Referencia fuera de su familia');
  if(a.startsWith('documento_') && !this.documento) this.invalidate('documento','Falta documento');
  if(a.startsWith('operacion_') && !this.operacion) this.invalidate('operacion','Falta operación');
  if(a.startsWith('operacion_') && (this.contexto || this.decision)) this.invalidate('operacion','No atribuir la operación al contexto general');
  if(a.startsWith('decision_operacion_') && (!this.operacion || !this.decision_operacion || this.contexto || this.decision))
    this.invalidate('decision_operacion','Decisión de operación sin ámbito propio o con contexto general');
  if(!a.startsWith('decision_operacion_') && this.decision_operacion)
    this.invalidate('decision_operacion','Referencia fuera de su familia');
  if(a.startsWith('decision_aplicabilidad_') && !this.decision) this.invalidate('decision','Falta decisión');
  if(/^(contexto_|decision_aplicabilidad_)/.test(a) && !this.contexto) this.invalidate('contexto','Falta contexto');
  if(!unidad && this.unidad) this.invalidate('unidad','No atribuir un evento general a una unidad');
  next();
});
EventoOrganizacionSchema.index({ organizacion: 1, operacion: 1, createdAt: -1, _id: -1 });
EventoOrganizacionSchema.index({ organizacion: 1, alcance: 1, createdAt: -1, _id: -1 });
EventoOrganizacionSchema.index({ organizacion: 1, decision_operacion: 1, createdAt: -1, _id: -1 });
EventoOrganizacionSchema.index({ organizacion: 1, decision: 1, createdAt: -1, _id: -1 });
EventoOrganizacionSchema.index({ organizacion: 1, 'despues.regla_id': 1, createdAt: -1, _id: -1 });
EventoOrganizacionSchema.index({ organizacion: 1, contexto: 1, createdAt: -1, _id: -1 });
EventoOrganizacionSchema.index({ organizacion: 1, subespacio: 1, createdAt: -1, _id: -1 });
EventoOrganizacionSchema.index({ organizacion: 1, documento: 1, createdAt: -1, _id: -1 });
EventoOrganizacionSchema.index(
  { organizacion: 1, unidad: 1, createdAt: -1, _id: -1 },
  { name: 'eventos_unidad_fecha' }
);

// Consultas paginadas de la organizacion y por autor; no son indices unicos.
EventoOrganizacionSchema.index(
  { organizacion: 1, createdAt: -1, _id: -1 }, { name: 'eventos_organizacion_fecha' }
);
EventoOrganizacionSchema.index(
  { organizacion: 1, actor: 1, createdAt: -1, _id: -1 }, { name: 'eventos_actor_fecha' }
);

module.exports = mongoose.model('EventoOrganizacion', EventoOrganizacionSchema);
