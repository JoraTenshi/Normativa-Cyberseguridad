'use strict';

const mongoose = require('mongoose');
const { VERSION_POLITICA, DURACION_MAXIMA_MS } = require('../services/politicaSesion');

const fechaValida = valor => valor instanceof Date && Number.isFinite(valor.getTime());

// Una sesión autenticada concreta, NO una empresa ni un rol.
// Los servicios deberán crearla después del login completo (incluido MFA si procede).
// No pasar req.body al modelo. No se guardan contraseña, JWT, cookie ni secreto 2FA.
const SesionUsuarioSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, immutable: true },
  identificadorHash: {
    type: String, cast: false, required: true, immutable: true, select: false,
    match: /^[a-f0-9]{64}$/
  },
  versionCredenciales: {
    type: Number, cast: false, required: true, immutable: true, min: 0,
    validate: { validator: Number.isSafeInteger, message: 'Versión de credenciales inválida' }
  },
  versionPolitica: {
    type: Number, cast: false, required: true, immutable: true,
    enum: [VERSION_POLITICA], default: VERSION_POLITICA
  },
  autenticadaEn: { type: Date, required: true, immutable: true },
  ultimaActividadEn: {
    type: Date, required: true,
    validate: {
      validator(valor) {
        return fechaValida(valor) && fechaValida(this.autenticadaEn) && fechaValida(this.expiraEn) &&
          valor.getTime() >= this.autenticadaEn.getTime() && valor.getTime() < this.expiraEn.getTime();
      },
      message: 'La actividad debe estar dentro de la vida de la sesión'
    }
  },
  expiraEn: {
    type: Date, required: true, immutable: true,
    validate: {
      validator(valor) {
        return fechaValida(valor) && fechaValida(this.autenticadaEn) &&
          valor.getTime() === this.autenticadaEn.getTime() + DURACION_MAXIMA_MS;
      },
      message: 'El límite absoluto debe ser ocho horas desde la autenticación'
    }
  },
  mantenerSesion: { type: Boolean, cast: false, required: true, immutable: true, default: false },
  revocadaEn: {
    type: Date, default: null,
    validate: {
      validator(valor) {
        return valor === null || (fechaValida(valor) && fechaValida(this.autenticadaEn) &&
          valor.getTime() >= this.autenticadaEn.getTime());
      },
      message: 'La revocación no puede preceder a la autenticación'
    }
  }
}, {
  collection: 'sesiones_usuario',
  timestamps: true,
  strict: 'throw'
});

// Los índices se declaran aquí, pero solo existirán tras crearlos en Mongo.
// No se activa TTL ni se borran registros: limpieza/retención se decide aparte.
// La autorización nunca debe depender de que Mongo haya eliminado un documento.
SesionUsuarioSchema.index({ identificadorHash: 1 }, { unique: true, name: 'sesion_identificador_unico' });
SesionUsuarioSchema.index({ usuario: 1, revocadaEn: 1, expiraEn: 1 }, { name: 'sesiones_por_usuario' });

module.exports = mongoose.model('SesionUsuario', SesionUsuarioSchema);
