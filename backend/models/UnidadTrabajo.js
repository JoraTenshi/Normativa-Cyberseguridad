'use strict';

const mongoose = require('mongoose');

function soloIdentificador(valor) {
  if (valor == null || mongoose.isObjectIdOrHexString(valor)) return valor;
  throw new TypeError('La referencia debe ser un ObjectId o una cadena hexadecimal de 24 caracteres.');
}

// Una unidad es opcional y pertenece a una sola empresa. No crea una unidad
// por defecto ni modifica Organizacion. No construir desde req.body sin filtrar.
const UnidadTrabajoSchema = new mongoose.Schema({
  organizacion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organizacion',
    required: true,
    set: soloIdentificador
  },
  nombre: {
    type: String,
    cast: false,
    required: true,
    trim: true,
    maxlength: 120
  },
  descripcion: {
    type: String,
    cast: false,
    trim: true,
    maxlength: 500,
    default: null
  },
  estado: {
    type: String,
    cast: false,
    required: true,
    enum: ['en_preparacion', 'activa', 'archivada'],
    default: 'en_preparacion'
  }
}, {
  collection: 'unidades_trabajo',
  timestamps: true,
  strict: 'throw'
});

// Indice de consulta, no unicidad del nombre ni verificacion de la empresa.
// El servicio de escritura debera autorizar altas, cambios y transiciones.
// Archivar no borra este registro ni sus referencias; aun no hay ese flujo.
UnidadTrabajoSchema.index(
  { organizacion: 1, estado: 1 },
  { name: 'unidad_organizacion_estado' }
);

module.exports = mongoose.model('UnidadTrabajo', UnidadTrabajoSchema);
