const mongoose = require('mongoose');

const RevokedTokenSchema = new mongoose.Schema({
  jti:       { type: String, required: true, unique: true },
  expiresAt: { type: Date,   required: true }
});

RevokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RevokedToken', RevokedTokenSchema);
