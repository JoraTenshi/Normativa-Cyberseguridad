const mongoose = require('mongoose');

const PreguntaSchema = new mongoose.Schema({
  id:          { type: String, required: true },
  texto:       { type: String, required: true },
  peso:        { type: Number, required: true, min: 1 },
  nivel:       { type: String, enum: ['bajo', 'medio', 'alto', 'critico'], default: null },
  remediacion: { type: String, default: null },
  fase_pds:    { type: Number, min: 1, max: 5, default: null }
}, { _id: false });

const BloqueSchema = new mongoose.Schema({
  id: { type: String, required: true },
  nombre: { type: String, required: true },
  preguntas: [PreguntaSchema]
}, { _id: false });

const NormativaSchema = new mongoose.Schema({
  id:                   { type: String, required: true, unique: true },
  nombre:               { type: String, required: true },
  descripcion:          { type: String },
  sectores_aplicables:  { type: [String], default: [] },
  bloques:              [BloqueSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Normativa', NormativaSchema);
