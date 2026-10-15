const mongoose = require('mongoose');

// Entidad empresarial, no solicitud de alta ni acreditacion de representacion.
// No pasar req.body directamente: los campos internos, incluido estado,
// los asignara el servicio de alta tras aplicar sus reglas de autorizacion.
const OrganizacionSchema = new mongoose.Schema({
  razon_social: {
    type: String,
    cast: false,
    required: true,
    trim: true,
    maxlength: 200
  },
  pais: {
    type: String,
    cast: false,
    required: true,
    trim: true,
    uppercase: true,
    enum: ['ES']
  },
  identificador_tipo: {
    type: String,
    cast: false,
    required: true,
    trim: true,
    uppercase: true,
    enum: ['NIF']
  },
  identificador_valor: {
    type: String,
    cast: false,
    required: true,
    trim: true,
    uppercase: true,
    // Solo forma de almacenamiento: no valida el NIF completo, su digito
    // de control, la existencia de la entidad ni la autoridad del solicitante.
    match: /^[A-Z0-9]{9}$/
  },
  estado: {
    type: String,
    cast: false,
    required: true,
    enum: ['en_preparacion', 'activa', 'suspendida', 'cerrada'],
    default: 'en_preparacion'
  }
}, {
  collection: 'organizaciones',
  timestamps: true,
  strict: 'throw'
});

// Unicidad de la entidad, no de solicitudes pendientes: solicitar un alta
// no reserva una empresa ni concede pertenencia. El indice solo se aplica
// cuando se cree en MongoDB; validateSync() no comprueba duplicados.
OrganizacionSchema.index(
  { pais: 1, identificador_tipo: 1, identificador_valor: 1 },
  { unique: true, name: 'organizacion_identificador_unico' }
);

module.exports = mongoose.model('Organizacion', OrganizacionSchema);
