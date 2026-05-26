const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const OrganizacionSchema = new mongoose.Schema({
  sector: {
    type: String,
    enum: ['publica', 'sanitaria', 'energia', 'transporte', 'financiero', 'educacion', 'privada', 'otro'],
    default: null
  },
  tamano: {
    type: String,
    enum: ['micro', 'pequena', 'mediana', 'grande'],
    default: null
  },
  tipo_actividad: { type: String, trim: true, maxlength: 200, default: null }
}, { _id: false });

const UsuarioSchema = new mongoose.Schema({
  nombre:        { type: String, required: true, trim: true, maxlength: 100, match: /^[^<>]+$/ },
  email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:      { type: String, required: true },
  organizacion:     { type: OrganizacionSchema, default: () => ({}) },
  loginAttempts:    { type: Number,  default: 0 },
  lockUntil:        { type: Date,    default: null },
  twoFactorSecret:  { type: String,  default: null, select: false },
  twoFactorEnabled: { type: Boolean, default: false },
  resetPasswordToken:   { type: String, default: null, select: false },
  resetPasswordExpires: { type: Date,   default: null, select: false }
}, { timestamps: true });

UsuarioSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UsuarioSchema.methods.verificarPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

UsuarioSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

UsuarioSchema.methods.recordFailedLogin = function () {
  const attempts = this.loginAttempts + 1;
  const update = { loginAttempts: attempts };
  if (attempts >= MAX_ATTEMPTS) {
    update.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
  }
  return this.updateOne(update);
};

UsuarioSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({ loginAttempts: 0, lockUntil: null });
};

module.exports = mongoose.model('Usuario', UsuarioSchema);
