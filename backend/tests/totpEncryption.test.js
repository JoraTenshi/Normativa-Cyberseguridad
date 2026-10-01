const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('node:crypto');
const {
  encryptTotpSecret,
  decryptTotpSecret,
  isLegacyTotpSecret,
  readTotpSecret
} = require('../utils/totpEncryption');

const secret = 'JBSWY3DPEHPK3PXP';
const userId = '507f1f77bcf86cd799439011';
const otherUserId = '507f1f77bcf86cd799439012';

function withKey(key, run) {
  const previous = process.env.TOTP_ENCRYPTION_KEY;
  if (key === undefined) delete process.env.TOTP_ENCRYPTION_KEY;
  else process.env.TOTP_ENCRYPTION_KEY = key;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.TOTP_ENCRYPTION_KEY;
    else process.env.TOTP_ENCRYPTION_KEY = previous;
  }
}

test('cifra y recupera el secreto 2FA sin guardarlo en texto', () => {
  withKey(crypto.randomBytes(32).toString('hex'), () => {
    const encrypted = encryptTotpSecret(secret, userId);
    assert.match(encrypted, /^v1:/);
    assert.equal(encrypted.includes(secret), false);
    assert.equal(decryptTotpSecret(encrypted, userId), secret);
    assert.equal(readTotpSecret(encrypted, userId), secret);
  });
});

test('dos cifrados del mismo secreto usan valores aleatorios distintos', () => {
  withKey(crypto.randomBytes(32).toString('hex'), () => {
    const first = encryptTotpSecret(secret, userId);
    const second = encryptTotpSecret(secret, userId);
    assert.notEqual(first, second);
    assert.equal(decryptTotpSecret(first, userId), decryptTotpSecret(second, userId));
  });
});

test('rechaza datos alterados y una clave distinta', () => {
  const firstKey = crypto.randomBytes(32).toString('hex');
  const secondKey = crypto.randomBytes(32).toString('hex');
  let encrypted;
  withKey(firstKey, () => {
    encrypted = encryptTotpSecret(secret, userId);
    const parts = encrypted.split(':');
    for (const index of [1, 2, 3]) {
      const changed = [...parts];
      changed[index] = `${changed[index][0] === '0' ? '1' : '0'}${changed[index].slice(1)}`;
      assert.throws(() => decryptTotpSecret(changed.join(':'), userId));
    }
    assert.throws(() => decryptTotpSecret(encrypted, otherUserId));
  });
  withKey(secondKey, () => assert.throws(() => decryptTotpSecret(encrypted, userId)));
});

test('rechaza claves ausentes, entradas vacías y formatos desconocidos', () => {
  withKey(undefined, () => assert.throws(() => encryptTotpSecret(secret, userId), /TOTP_ENCRYPTION_KEY/));
  withKey(crypto.randomBytes(32).toString('hex'), () => {
    assert.throws(() => encryptTotpSecret('', userId), /Base32/);
    assert.throws(() => encryptTotpSecret(secret, 'otro'), /identificador/);
    assert.throws(() => decryptTotpSecret(secret, userId), /Formato/);
    assert.throws(() => decryptTotpSecret('v2:abc', userId), /Formato/);
  });
});

test('reconoce secretos antiguos para migrarlos, pero impide usarlos al iniciar sesión', () => {
  const oldSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  assert.equal(isLegacyTotpSecret(oldSecret), true);
  assert.throws(() => readTotpSecret(oldSecret, userId), /Formato/);
  assert.equal(isLegacyTotpSecret('v2:abc'), false);
  assert.throws(() => readTotpSecret('v2:abc', userId), /Formato/);
  assert.throws(() => readTotpSecret('v1:abc', userId), /Formato/);
});
