const mongoose = require('mongoose');

const RespuestaSchema = new mongoose.Schema({
  pregunta_id: { type: String, required: true },
  valor: { type: Number, required: true, enum: [0, 0.5, 1] }
}, { _id: false });

const ResultadoSchema = new mongoose.Schema({
  usuario:          { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  normativa:        { type: String, required: true },
  respuestas:       [RespuestaSchema],
  puntuacion_total: { type: Number },
  puntuacion_maxima:{ type: Number },
  porcentaje:       { type: Number }
}, { timestamps: true });

// Index to make per-user history queries fast
ResultadoSchema.index({ usuario: 1, createdAt: -1 });

module.exports = mongoose.model('Resultado', ResultadoSchema);
