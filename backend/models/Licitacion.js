const mongoose = require('mongoose');

const LicitacionSchema = new mongoose.Schema({
  _id:                 { type: String },
  titulo:              { type: String, default: '' },
  resumen:             { type: String, default: '' },
  estado:              { type: String, default: '' },
  importe:             { type: String, default: '' },
  moneda:              { type: String, default: '' },
  organo_contratacion: { type: String, default: '' },
  cpv:                 { type: String, default: '' },
  fecha_actualizacion: { type: String, default: '' },
  enlace:              { type: String, default: '' },
  fichero_origen:      { type: String, default: '' },
  motivos_match:       { type: [String], default: [] },
  anio:                { type: Number },
  mes:                 { type: Number },
  scraped_at:          { type: Date }
}, { collection: 'licitaciones' });

LicitacionSchema.index({ anio: 1, mes: 1 });
LicitacionSchema.index({ estado: 1 });
LicitacionSchema.index({ titulo: 'text', resumen: 'text' });

module.exports = mongoose.model('Licitacion', LicitacionSchema);
