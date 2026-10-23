'use strict';
// bcrypt solo usa los primeros 72 bytes de la contraseña: dos contraseñas que compartan esos 72 bytes
// serían equivalentes. Se rechazan las que los superan (se cuentan bytes UTF-8, no caracteres).
const MAX_PASSWORD_BYTES = 72;

const excedeLimiteBcrypt = password =>
  typeof password === 'string' && Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES;

const MENSAJE_PASSWORD_LARGA =
  'La contraseña no puede superar 72 bytes (72 caracteres sin tildes, eñes ni otros símbolos especiales)';

module.exports = { MAX_PASSWORD_BYTES, excedeLimiteBcrypt, MENSAJE_PASSWORD_LARGA };
