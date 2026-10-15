'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { safeError, EMAIL, IDENTIFIER } = require('../scripts/integration/create-test-workspace');
test('bootstrap sintético: identidad no real y error sin datos sensibles', () => {
  assert.equal(EMAIL, 'admin.workspace@example.invalid');
  assert.equal(IDENTIFIER, 'TEST00001');
  assert.equal(safeError({ code: 'DATABASE_NOT_EMPTY' }), 'DATABASE_NOT_EMPTY');
  assert.equal(safeError({ code: 11000, message: 'secret' }), 'CONCURRENT_OR_EXISTING_DATA');
  assert.equal(safeError({ code: 'mongodb://password', message: 'secret', stack: 'secret' }), 'BOOTSTRAP_FAILED');
});
test('bootstrap sintético: CLI falla fuera del contenedor antes de leer secretos o conectar', () => {
  const r = spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/integration/create-test-workspace.js')],
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 5000 });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ENVIRONMENT_REFUSED/);
  assert.equal(r.stdout, '');
});
test('bootstrap sintético: no se ejecuta automáticamente al arrancar ni crea ruta demo', () => {
  const start = fs.readFileSync(path.resolve(__dirname, '../scripts/integration/start.js'), 'utf8');
  assert.doesNotMatch(start, /create-test-workspace|NC_INTEGRATION_TEST_ACCOUNT/);
  const source = fs.readFileSync(path.resolve(__dirname, '../scripts/integration/create-test-workspace.js'), 'utf8');
  assert.doesNotMatch(source, /dotenv|updateOne|updateMany|deleteMany|dropDatabase|rateLimits/);
  assert.match(source, /user\.save\(\{ session \}\)/);
  assert.match(source, /withTransaction/);
});
