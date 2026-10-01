const crypto = require('node:crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ENCRYPTED_FORMAT = /^v1:([0-9a-f]{24}):([0-9a-f]{32}):((?:[0-9a-f]{2})+)$/;
const LEGACY_FORMAT = /^[a-z2-7]{32}$/i;

function associatedData(userId) {
  const id = userId?.toString();
  if (!/^[0-9a-f]{24}$/i.test(id || '')) {
    throw new Error('El identificador del usuario 2FA es inválido');
  }
  return Buffer.from(`normativa-check:totp:v1:${id.toLowerCase()}`, 'utf8');
}

function getEncryptionKey() {
  const keyHex = process.env.TOTP_ENCRYPTION_KEY;
  if (typeof keyHex !== 'string' || !/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw new Error('TOTP_ENCRYPTION_KEY debe ser hexadecimal y tener 32 bytes');
  }
  return Buffer.from(keyHex, 'hex');
}

function encryptTotpSecret(secret, userId) {
  if (typeof secret !== 'string' || !/^[a-z2-7]+$/i.test(secret)) {
    throw new Error('El secreto 2FA debe ser una cadena Base32 no vacía');
  }

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: TAG_BYTES
  });
  cipher.setAAD(associatedData(userId));
  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptTotpSecret(value, userId) {
  const parts = typeof value === 'string' ? ENCRYPTED_FORMAT.exec(value) : null;
  if (!parts) {
    throw new Error('Formato de secreto 2FA cifrado inválido');
  }

  const iv = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');
  const encrypted = Buffer.from(parts[3], 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: TAG_BYTES
  });
  decipher.setAAD(associatedData(userId));
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]).toString('utf8');
}

function isLegacyTotpSecret(value) {
  return typeof value === 'string' && LEGACY_FORMAT.test(value);
}

function readTotpSecret(value, userId) {
  return decryptTotpSecret(value, userId);
}

module.exports = {
  encryptTotpSecret,
  decryptTotpSecret,
  isLegacyTotpSecret,
  readTotpSecret
};
