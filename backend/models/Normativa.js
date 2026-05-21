const mongoose = require('mongoose');
const TEMAS_VALIDOS = require('../constants/temas');

const PreguntaSchema = new mongoose.Schema({
  id:                  { type: String, required: true },
  texto:               { type: String, required: true },
  peso:                { type: Number, required: true, min: 1 },
  nivel:               { type: String, enum: ['bajo', 'medio', 'alto', 'critico'], default: null },
  remediacion:         { type: String, default: null },
  fase_pds:            { type: Number, min: 1, max: 5, default: null },
  ayuda:               { type: String, default: null },
  requisito_original:  { type: String, default: null },
  tipo:                { type: String, enum: ['obligatorio', 'recomendado', 'condicional'], default: null },
  aplicabilidad:       { type: [String], default: [] },
  referencia_articulo: { type: String, default: null }
}, { _id: false });

const BloqueSchema = new mongoose.Schema({
  id:          { type: String, required: true },
  nombre:      { type: String, required: true },
  descripcion:         { type: String, default: null },
  peso_bloque:         { type: Number, min: 0, max: 100, default: null },
  fecha_aplicabilidad: { type: String, default: null },
  temas:               { type: [String], enum: TEMAS_VALIDOS, default: [] },
  seccion_normativa:   { type: String, default: null },
  preguntas:           [PreguntaSchema]
}, { _id: false });

const NormativaSchema = new mongoose.Schema({
  id:                  { type: String, required: true, unique: true },
  nombre:              { type: String, required: true },
  descripcion:                 { type: String },
  referencia_oficial:          { type: String, default: null },
  sectores_aplicables:         { type: [String], default: [] },
  fecha_aplicabilidad_general: { type: String, default: null },
  bloques:                     [BloqueSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Normativa', NormativaSchema);
