const mongoose = require('mongoose');

// Las referencias se asignan por ID, no mediante objetos ni arrays recibidos.
// Validar la forma no comprueba existencia, estado ni pertenencia.
function soloIdentificador(valor) {
  if (valor == null || mongoose.isObjectIdOrHexString(valor)) return valor;
  throw new TypeError('La referencia debe ser un ObjectId o una cadena hexadecimal de 24 caracteres.');
}

// Relacion interna entre cuenta y empresa. No pasar req.body directamente:
// el futuro servicio comprobara referencias, actor, rol y transiciones.
const MembresiaSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    set: soloIdentificador
  },
  organizacion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organizacion',
    required: true,
    set: soloIdentificador
  },
  rol: {
    type: String,
    cast: false,
    required: true,
    // Rol de ESTA organizacion, distinto de Usuario.rol (administracion global).
    // Sin valor por defecto: debe asignarlo explicitamente el servicio.
    enum: ['administrador', 'colaborador', 'consulta']
  },
  estado: {
    type: String,
    cast: false,
    required: true,
    enum: ['pendiente', 'activa', 'suspendida', 'revocada'],
    default: 'pendiente'
  },
  funcion_profesional: {
    type: String,
    cast: false,
    trim: true,
    maxlength: 120,
    default: null
    // Dato descriptivo: nunca es una fuente de permisos.
  }
}, {
  collection: 'membresias',
  timestamps: true,
  strict: 'throw'
});

// Una relacion por pareja, incluso suspendida o revocada. El historial y las
// invitaciones seran registros aparte, no membresias duplicadas por cada rol.
// Solo sera efectivo cuando el indice exista en MongoDB; validateSync() no
// comprueba duplicados. El enum tampoco autoriza altas ni cambios de estado.
MembresiaSchema.index(
  { organizacion: 1, usuario: 1 },
  { unique: true, name: 'membresia_organizacion_usuario_unica' }
);

module.exports = mongoose.model('Membresia', MembresiaSchema);
