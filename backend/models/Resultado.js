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
  porcentaje:       { type: Number },
  expiresAt:        { type: Date, default: null }
}, { timestamps: true });

ResultadoSchema.index({ usuario: 1, createdAt: -1 });
ResultadoSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: 'date' } } });

module.exports = mongoose.model('Resultado', ResultadoSchema);
