const mongoose = require('mongoose');

const RespuestaSchema = new mongoose.Schema({
  pregunta_id: { type: String, required: true },
  valor: { type: Number, required: true, enum: [0, 0.5, 1] }
}, { _id: false });

const PuntuacionBloqueSchema = new mongoose.Schema({
  bloque_id:         { type: String, required: true },
  nombre:            { type: String, required: true },
  peso_bloque:       { type: Number },
  evaluable:         { type: Boolean },
  porcentaje_exacto: { type: Number, default: null },
  porcentaje:        { type: Number, default: null },
  puntuacion:        { type: Number },
  max_puntuacion:    { type: Number }
}, { _id: false });

// Copia de lo que se calculó al enviar el cuestionario: el historial y el PDS la leen tal cual,
// aunque la normativa cambie después.
const RemediacionSchema = new mongoose.Schema({
  pregunta_id:  { type: String, required: true },
  bloque_id:    { type: String, required: true },
  bloque:       { type: String },
  pregunta:     { type: String },
  nivel:        { type: String, default: null },
  fase_pds:     { type: Number, default: null },
  remediacion:  { type: String, default: null },
  valor_actual: { type: Number },
  prioridad:    { type: Number }
}, { _id: false });

const PreguntaSnapshotSchema = new mongoose.Schema({
  id:    { type: String, required: true },
  texto: { type: String, required: true },
  peso:  { type: Number, required: true }
}, { _id: false });

const BloqueSnapshotSchema = new mongoose.Schema({
  id:        { type: String, required: true },
  nombre:    { type: String, required: true },
  preguntas: [PreguntaSnapshotSchema]
}, { _id: false });

const ResultadoSchema = new mongoose.Schema({
  usuario:             { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  normativa:           { type: String, required: true },
  normativa_nombre:    { type: String, required: true },
  cuestionario:        [BloqueSnapshotSchema],
  respuestas:          [RespuestaSchema],
  algoritmo_version:   { type: String, required: true },
  porcentaje_exacto:   { type: Number, default: null },
  porcentaje:          { type: Number, default: null },
  nivel:               { type: String, enum: ['Crítico', 'Bajo', 'Medio', 'Alto', null], default: null },
  puntuaciones_bloques: [PuntuacionBloqueSchema],
  remediaciones:       [RemediacionSchema],
  cobertura_estimada:  { type: [mongoose.Schema.Types.Mixed], default: [] },
  expiresAt:           { type: Date, default: null }
}, { timestamps: true });

ResultadoSchema.index({ usuario: 1, createdAt: -1 });
ResultadoSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: 'date' } } });

module.exports = mongoose.model('Resultado', ResultadoSchema);
