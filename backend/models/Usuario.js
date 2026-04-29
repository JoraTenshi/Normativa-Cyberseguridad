const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UsuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 100 },
  email:  { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }
}, { timestamps: true });

UsuarioSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UsuarioSchema.methods.verificarPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('Usuario', UsuarioSchema);
