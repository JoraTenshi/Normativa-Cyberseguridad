const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const validJwt = crypto.randomBytes(32).toString('hex');
const validTotpKey = crypto.randomBytes(32).toString('hex');

function checkSecrets(jwtSecret, totpKey) {
  const env = { ...process.env };
  if (jwtSecret === undefined) {
    delete env.JWT_SECRET;
  } else {
    env.JWT_SECRET = jwtSecret;
  }
  if (totpKey === undefined) {
    delete env.TOTP_ENCRYPTION_KEY;
  } else {
    env.TOTP_ENCRYPTION_KEY = totpKey;
  }

  return spawnSync(process.execPath, ['-e', "require('./utils/initSecrets')"], {
    cwd: path.join(__dirname, '..'),
    env,
    encoding: 'utf8'
  });
}

test('el arranque rechaza claves ausentes, de ejemplo o mal formadas', () => {
  for (const secret of [undefined, '', 'change_this_to_a_long_random_secret', 'a'.repeat(63), 'a'.repeat(65)]) {
    const result = checkSecrets(secret, validTotpKey);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /JWT_SECRET/);
  }
});

test('el arranque acepta claves hexadecimales de 32 bytes o más', () => {
  for (const byteCount of [32, 64]) {
    const secret = crypto.randomBytes(byteCount).toString('hex');
    const result = checkSecrets(secret, validTotpKey);
    assert.equal(result.status, 0, result.stderr);
  }
});

test('el arranque rechaza una clave 2FA ausente, mal formada o igual a JWT_SECRET', () => {
  for (const key of [undefined, '', 'a'.repeat(63), 'g'.repeat(64), validJwt, validJwt.toUpperCase()]) {
    const result = checkSecrets(validJwt, key);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /TOTP_ENCRYPTION_KEY/);
  }
});

test('el arranque acepta una clave 2FA aleatoria e independiente', () => {
  const result = checkSecrets(validJwt, validTotpKey);
  assert.equal(result.status, 0, result.stderr);
});
