const mongoose = require('mongoose');

const PreguntaSchema = new mongoose.Schema({
  id: { type: String, required: true },
  texto: { type: String, required: true },
  peso: { type: Number, required: true, min: 1 }
}, { _id: false });

const BloqueSchema = new mongoose.Schema({
  id: { type: String, required: true },
  nombre: { type: String, required: true },
  preguntas: [PreguntaSchema]
}, { _id: false });

const NormativaSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  nombre: { type: String, required: true },
  descripcion: { type: String },
  bloques: [BloqueSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Normativa', NormativaSchema);
