const mongoose = require('mongoose');

const RespuestaSchema = new mongoose.Schema({
  pregunta_id: { type: String, required: true },
  valor: { type: Number, required: true, enum: [0, 0.5, 1] }
}, { _id: false });

const PuntuacionBloqueSchema = new mongoose.Schema({
  bloque_id: { type: String, required: true },
  nombre: { type: String, required: true },
  peso_bloque: Number,
  evaluable: Boolean,
  porcentaje_exacto: { type: Number, default: null },
  porcentaje: { type: Number, default: null },
  puntuacion: Number,
  max_puntuacion: Number
}, { _id: false });

const RemediacionSchema = new mongoose.Schema({
  pregunta_id: { type: String, required: true },
  bloque_id: { type: String, required: true },
  bloque: String,
  pregunta: String,
  nivel: { type: String, default: null },
  fase_pds: { type: Number, default: null },
  remediacion: { type: String, default: null },
  valor_actual: { type: Number, enum: [0, 0.5] },
  prioridad: Number
}, { _id: false });

const PreguntaSnapshotSchema = new mongoose.Schema({
  id: { type: String, required: true },
  texto: { type: String, required: true },
  peso: { type: Number, required: true },
  nivel: { type: String, default: null },
  fase_pds: { type: Number, default: null },
  remediacion: { type: String, default: null },
  ayuda: String,
  requisito_original: String,
  referencia_articulo: String,
  tipo: String,
  aplicabilidad: { type: [String], default: undefined }
}, { _id: false });

const BloqueSnapshotSchema = new mongoose.Schema({
  id: { type: String, required: true },
  nombre: { type: String, required: true },
  descripcion: String,
  fecha_aplicabilidad: String,
  seccion_normativa: String,
  peso_bloque: { type: Number, default: null },
  temas: { type: [String], default: [] },
  preguntas: { type: [PreguntaSnapshotSchema], default: [] }
}, { _id: false });

const NormativaSnapshotSchema = new mongoose.Schema({
  version: { type: Number, required: true, enum: [1] },
  id: { type: String, required: true },
  nombre: { type: String, required: true },
  referencia_oficial: String,
  fecha_aplicabilidad_general: String,
  huella_sha256: String,
  bloques: { type: [BloqueSnapshotSchema], default: [] }
}, { _id: false });

const ResultadoSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  normativa: { type: String, required: true },
  normativa_nombre: String,
  normativa_snapshot: { type: NormativaSnapshotSchema, default: undefined },
  respuestas: [RespuestaSchema],
  // Sin valor por defecto: un documento sin versión sigue siendo v1.
  algoritmo_version: { type: String, enum: ['1', '2'] },
  sin_base_evaluable: Boolean,
  porcentaje_exacto: { type: Number, default: null },
  porcentaje: { type: Number, default: null },
  nivel: { type: String, enum: ['Crítico', 'Bajo', 'Medio', 'Alto', null], default: null },
  puntuaciones_bloques: { type: [PuntuacionBloqueSchema], default: undefined },
  remediaciones: { type: [RemediacionSchema], default: undefined },
  cobertura_estimada: { type: [mongoose.Schema.Types.Mixed], default: undefined },
  // Compatibilidad de lectura: no reescribir ni recalcular históricos anteriores.
  puntuacion_total: Number,
  puntuacion_maxima: Number,
  bloques: { type: [PuntuacionBloqueSchema], default: undefined },
  cuestionario: { type: [BloqueSnapshotSchema], default: undefined },
  remediaciones_snapshot: { type: [RemediacionSchema], default: undefined },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

ResultadoSchema.index({ usuario: 1, createdAt: -1 });
ResultadoSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: 'date' } } });

module.exports = mongoose.model('Resultado', ResultadoSchema);
