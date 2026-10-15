'use strict';

const mongoose = require('mongoose');

function soloIdentificador(valor) {
  if (valor == null || mongoose.isObjectIdOrHexString(valor)) return valor;
  throw new TypeError('La referencia debe ser un ObjectId o una cadena hexadecimal de 24 caracteres.');
}

// Vincula una pertenencia EMPRESARIAL con una unidad: no duplica Usuario ni
// organizacion. El servicio comprueba que la empresa de ambas sea la misma.
// Nunca asignar campos directamente desde req.body, incluidos rol y estado.
const MembresiaUnidadSchema = new mongoose.Schema({
  unidad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UnidadTrabajo',
    required: true,
    set: soloIdentificador
  },
  membresia: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Membresia',
    required: true,
    set: soloIdentificador
  },
  rol: {
    type: String,
    cast: false,
    required: true,
    // Responsabilidad SOLO en esta unidad. No sustituye al rol empresarial.
    // Sin asignacion automatica de rol ni elevacion a administrador.
    enum: ['miembro', 'coordinador']
  },
  estado: {
    type: String,
    cast: false,
    required: true,
    enum: ['pendiente', 'activa', 'suspendida', 'revocada'],
    default: 'pendiente'
  }
}, {
  collection: 'membresias_unidad',
  timestamps: true,
  strict: 'throw'
});

// Una relacion por pareja, tambien tras revocacion. No limita a una persona
// a una sola unidad ni impone coordinador unico. No define tareas de grupo.
// Declarar unique no crea/verifica aqui el indice ni comprueba referencias.
MembresiaUnidadSchema.index(
  { unidad: 1, membresia: 1 },
  { unique: true, name: 'membresia_unidad_pareja_unica' }
);

// Resolver las unidades de una membresia sin recorrer toda la coleccion.
MembresiaUnidadSchema.index(
  { membresia: 1, unidad: 1 }, { name: 'pertenencias_por_membresia' }
);

module.exports = mongoose.model('MembresiaUnidad', MembresiaUnidadSchema);
