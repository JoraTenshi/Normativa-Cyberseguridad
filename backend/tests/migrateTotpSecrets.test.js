const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('node:crypto');
const {
  scanUsers,
  migrateLegacySecrets
} = require('../scripts/migrateTotpSecrets');
const { decryptTotpSecret, encryptTotpSecret } = require('../utils/totpEncryption');

const legacySecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const firstId = '507f1f77bcf86cd799439011';
const secondId = '507f1f77bcf86cd799439012';

function fakeUsers(rows) {
  let writes = 0;
  return {
    get writes() { return writes; },
    find() {
      return {
        select() {
          return {
            async *cursor() {
              for (const row of rows) {
                if (row.twoFactorSecret != null) yield { ...row };
              }
            }
          };
        }
      };
    },
    async updateOne(filter, update) {
      const row = rows.find(candidate =>
        candidate._id === filter._id &&
        candidate.twoFactorSecret === filter.twoFactorSecret
      );
      if (!row) return { modifiedCount: 0 };
      row.twoFactorSecret = update.$set.twoFactorSecret;
      writes += 1;
      return { modifiedCount: 1 };
    }
  };
}

test('el análisis cuenta secretos sin escribir y detecta datos cifrados inválidos', async () => {
  const previous = process.env.TOTP_ENCRYPTION_KEY;
  process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  try {
    const users = fakeUsers([
      { _id: firstId, twoFactorSecret: legacySecret },
      { _id: secondId, twoFactorSecret: encryptTotpSecret(legacySecret, secondId) },
      { _id: '507f1f77bcf86cd799439013', twoFactorSecret: 'v1:corrupto' },
      { _id: '507f1f77bcf86cd799439014', twoFactorSecret: null }
    ]);
    assert.deepEqual(await scanUsers(users), { encrypted: 1, legacy: 1, invalid: 1 });
    assert.equal(users.writes, 0);
    await assert.rejects(migrateLegacySecrets(users), /inválidos/);
    assert.equal(users.writes, 0);
  } finally {
    if (previous === undefined) delete process.env.TOTP_ENCRYPTION_KEY;
    else process.env.TOTP_ENCRYPTION_KEY = previous;
  }
});

test('migra secretos antiguos, permite repetir la operación y conserva el valor legible', async () => {
  const previous = process.env.TOTP_ENCRYPTION_KEY;
  process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  try {
    const rows = [
      { _id: firstId, twoFactorSecret: legacySecret },
      { _id: secondId, twoFactorSecret: encryptTotpSecret(legacySecret, secondId) }
    ];
    const users = fakeUsers(rows);
    const first = await migrateLegacySecrets(users);
    assert.deepEqual(first.before, { encrypted: 1, legacy: 1, invalid: 0 });
    assert.equal(first.migrated, 1);
    assert.deepEqual(first.after, { encrypted: 2, legacy: 0, invalid: 0 });
    assert.equal(decryptTotpSecret(rows[0].twoFactorSecret, firstId), legacySecret);

    const second = await migrateLegacySecrets(users);
    assert.equal(second.migrated, 0);
    assert.equal(users.writes, 1);
  } finally {
    if (previous === undefined) delete process.env.TOTP_ENCRYPTION_KEY;
    else process.env.TOTP_ENCRYPTION_KEY = previous;
  }
});
