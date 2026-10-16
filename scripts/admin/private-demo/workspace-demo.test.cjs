'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const operator = require('./workspace-demo.cjs');
// This file belongs at <repository>/scripts/admin/private-demo/.
const base = path.resolve(__dirname, '../../../backend');
if (process.env.NODE_PATH) throw Error('QA_NODE_PATH_REFUSED');
const binary = process.env.NC_DEMO_QA_MONGOD;
if (!binary || !path.isAbsolute(binary) || !fs.statSync(binary).isFile())
  throw Error('QA_EXPLICIT_MONGOD_BINARY_REQUIRED');
const mongoose = require(path.join(base, 'node_modules/mongoose'));
const Usuario = require(path.join(base, 'models/Usuario'));
const Organizacion = require(path.join(base, 'models/Organizacion'));
const Membresia = require(path.join(base, 'models/Membresia'));
const deps = { mongoose, Usuario, Organizacion, Membresia };
const pause = ms => new Promise(r => setTimeout(r, ms));
test('CLI rejects wrong execution environment without reading credentials', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'workspace-demo.cjs'), 'provision'], { encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stderr, /ENVIRONMENT_REFUSED/); assert.equal(r.stdout, '');
  const s = spawnSync(process.execPath, [path.join(__dirname, 'demo-scenario.cjs')], { encoding: 'utf8' });
  assert.equal(s.status, 1); assert.match(s.stderr, /ENVIRONMENT_REFUSED/); assert.equal(s.stdout, '');
});
test('Errors never return raw message, URI or stack', () => {
  assert.equal(operator.safeError({ message: 'secret', stack: 'secret' }), 'OPERATION_FAILED_OR_UNCERTAIN');
  assert.equal(operator.safeError({ code: 11000, message: 'secret' }), 'CONCURRENT_OR_EXISTING_DATA');
});
test('Missing explicit authorization refuses before database access', async () => {
  await assert.rejects(operator.provision({}, { userId: 'a'.repeat(24), confirmation: 'yes', authorizationRef: 'A valid reference with no secret' }), { code: 'AUTHORIZATION_REQUIRED' });
});
test('Wrong database refuses before account reads', async () => {
  await assert.rejects(operator.destination({ connection: { name: 'another', db: { command: async () => ({ setName: 'nc-private-rs', isWritablePrimary: true }) } } }), { code: 'DATABASE_REFUSED' });
});
test('Real isolated replica: atomic limited grant, preservation and refusal paths', { timeout: 90000 }, async t => {
  const listener = net.createServer();
  await new Promise(r => listener.listen(0, '127.0.0.1', r));
  const port = listener.address().port;
  await new Promise(r => listener.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-private-demo-qa-'));
  const proc = spawn(binary, ['--bind_ip', '127.0.0.1', '--port', String(port), '--dbpath', dir,
    '--replSet', 'nc-private-rs', '--logpath', path.join(dir, 'mongo.log')], { stdio: 'ignore', windowsHide: true });
  let spawnError;
  const closed = new Promise(resolve => {
    proc.once('error', error => { spawnError = error; resolve(); });
    proc.once('close', resolve);
  });
  let client;
  try {
    for (let i = 0; i < 35; i++) {
      if (spawnError || proc.exitCode !== null || proc.signalCode !== null)
        throw Error('QA_OWN_MONGOD_START_FAILED');
      client = new mongoose.mongo.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, { serverSelectionTimeoutMS: 500 });
      try { await client.connect(); break; } catch (e) { await client.close(); if (i === 34) throw e; await pause(250); }
    }
    // The released ephemeral port might have been taken by another process.
    // Check the responding process before ANY Mongo write.
    const status = await client.db('admin').command({ serverStatus: 1 });
    assert.equal(Number(status.pid), proc.pid, 'QA_MONGOD_PROCESS_IDENTITY');
    assert.ok(!spawnError && proc.exitCode === null && proc.signalCode === null);
    await client.db('admin').command({ replSetInitiate: { _id: 'nc-private-rs', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
    for (let i = 0; i < 60; i++) {
      if ((await client.db('admin').command({ hello: 1 })).isWritablePrimary) break;
      await pause(250);
    }
    await mongoose.connect(`mongodb://127.0.0.1:${port}/nc_private?replicaSet=nc-private-rs`, { serverSelectionTimeoutMS: 5000 });
    await Promise.all([Usuario.init(), Organizacion.init(), Membresia.init()]);
    const user = await Usuario.create({ nombre: 'QA synthetic account', email: operator.EMAIL, password: 'Synthetic-QA-Only-Not-A-Real-Credential-781!' });
    const args = { userId: String(user._id), confirmation: 'AUTORIZO DEMO ' + user._id,
      authorizationRef: 'Isolated synthetic QA; authorization fixture only' };
    await t.test('read-only inspection does not mutate account or create memberships', async () => {
      const before = await Usuario.findById(user._id).lean();
      const state = await operator.inspect(deps);
      assert.equal(state.verified, false); assert.equal(state.activeMemberships, 0);
      assert.deepEqual(await Usuario.findById(user._id).lean(), before);
    });
    await t.test('unverified account denied without creating organization', async () => {
      await assert.rejects(operator.provision(deps, args), { code: 'ACCOUNT_NOT_VERIFIED' });
      assert.equal(await Organizacion.countDocuments(), 0);
    });
    await t.test('missing unique index refuses before any organization write', async () => {
      const unsafe = { ...deps, Organizacion: { collection: { listIndexes: () => ({ toArray: async () => [] }) } } };
      await assert.rejects(operator.provision(unsafe, args), { code: 'INDEX_REQUIRED' });
      assert.equal(await Organizacion.countDocuments(), 0);
    });
    // Fixture only: emulate a completed email verification in this disposable replica.
    await Usuario.updateOne({ _id: user._id }, { $set: { emailVerifiedAt: new Date() } });
    const credentialSnapshot = await Usuario.findById(user._id).lean();
    await t.test('transaction rolls back organization when membership creation fails', async () => {
      const original = Membresia.create;
      Membresia.create = async () => { throw Error('synthetic injected membership failure'); };
      try { await assert.rejects(operator.provision(deps, args), /synthetic injected/); }
      finally { Membresia.create = original; }
      assert.equal(await Organizacion.countDocuments(), 0);
      assert.equal(await Membresia.countDocuments(), 0);
      assert.equal(await mongoose.connection.db.collection('_private_demo_setup').countDocuments(), 0);
      assert.deepEqual(await Usuario.findById(user._id).lean(), credentialSnapshot);
    });
    await t.test('existing organization is refused, never adopted', async () => {
      const original = Organizacion.exists;
      Organizacion.exists = () => ({ session: async () => ({ _id: 'existing' }) });
      try { await assert.rejects(operator.provision(deps, args), { code: 'EXISTING_DATA_REFUSED' }); }
      finally { Organizacion.exists = original; }
      assert.equal(await Organizacion.countDocuments(), 0);
    });
    await t.test('concurrent requests create exactly one organization and membership', async () => {
      const results = await Promise.allSettled([operator.provision(deps, args), operator.provision(deps, args)]);
      assert.ok(results.some(r => r.status === 'fulfilled' && r.value.status === 'SYNTHETIC_WORKSPACE_CREATED'));
      assert.equal(await Organizacion.countDocuments(), 1);
      assert.equal(await Membresia.countDocuments(), 1);
      assert.equal(await mongoose.connection.db.collection('_private_demo_setup').countDocuments(), 1);
    });
    await t.test('repeating preserves data, credentials and global permissions', async () => {
      const org = await Organizacion.findOne().lean(); const membership = await Membresia.findOne().lean();
      assert.equal((await operator.provision(deps, args)).status, 'EXISTS_NO_PERMISSIONS_CHANGED');
      const now = await Usuario.findById(user._id).lean();
      for (const k of Object.keys(credentialSnapshot).filter(k => k !== '__v')) assert.deepEqual(now[k], credentialSnapshot[k], k);
      assert.deepEqual(await Organizacion.findOne().lean(), org);
      assert.deepEqual(await Membresia.findOne().lean(), membership);
      assert.equal(await mongoose.connection.db.collection('permisos_altas_plataforma').countDocuments(), 0);
    });
    await t.test('realistic synthetic scenario uses normal services, history and no favorable reviews', async () => {
      for (const file of fs.readdirSync(path.join(base, 'models')).filter(f => f.endsWith('.js'))) require(path.join(base, 'models', file));
      await Promise.all(Object.values(mongoose.models).map(m => m.init()));
      const scenario = require('./demo-scenario.cjs');
      const org = await Organizacion.findOne().lean();
      await assert.rejects(scenario.load(deps, scenario.services(base), 'yes'), { code: 'DEMO_CONFIRMATION_REQUIRED' });
      assert.equal(await mongoose.models.Operacion.countDocuments(), 0);
      const result = await scenario.load(deps, scenario.services(base), 'CARGAR DEMO ' + org._id);
      assert.equal(result.status, 'SYNTHETIC_SCENARIO_LOADED');
      assert.equal(await mongoose.models.Operacion.countDocuments(), 3);
      assert.equal(await mongoose.models.Subespacio.countDocuments(), 3);
      assert.equal(await mongoose.models.AlcanceEvaluacion.countDocuments(), 3);
      assert.equal(await mongoose.models.RegistroNormativo.countDocuments({ tipo: 'actuacion' }), 3);
      assert.equal(await mongoose.models.RegistroNormativo.countDocuments({ tipo: 'requisito' }), 3);
      assert.equal(await mongoose.models.RegistroNormativo.countDocuments({ tipo: 'revision' }), 0);
      const events = await mongoose.models.EventoOrganizacion.countDocuments();
      assert.ok(events >= 16);
      assert.equal((await scenario.load(deps, scenario.services(base), 'CARGAR DEMO ' + org._id)).status, 'SCENARIO_ALREADY_LOADED_NO_CHANGES');
      assert.equal(await mongoose.models.EventoOrganizacion.countDocuments(), events);
    });
    await t.test('revoked membership is refused, never reactivated', async () => {
      await Membresia.updateOne({}, { $set: { estado: 'revocada' } });
      await assert.rejects(operator.provision(deps, args), { code: 'RECEIPT_STATE_CHANGED' });
      assert.equal((await Membresia.findOne().lean()).estado, 'revocada');
      await assert.rejects(require('./demo-scenario.cjs').target(deps), { code: 'DEMO_STATE_CHANGED' });
    });
    await t.test('changed account global role is refused, never reset', async () => {
      await Usuario.updateOne({ _id: user._id }, { $set: { rol: 'admin' } });
      await assert.rejects(operator.provision(deps, args), { code: 'ACCOUNT_CHANGED' });
      assert.equal((await Usuario.findById(user._id).lean()).rol, 'admin');
    });
  } finally {
    try {
      await mongoose.disconnect(); await client?.close();
    } finally {
      // Stop only our child. Never delete the temporary evidence directory.
      if (proc.pid && proc.exitCode === null && proc.signalCode === null) proc.kill();
      const ended = await Promise.race([closed.then(() => true), pause(10000).then(() => false)]);
      if (!ended) {
        proc.kill('SIGKILL');
        assert.equal(await Promise.race([closed.then(() => true), pause(5000).then(() => false)]),
          true, 'QA_OWN_MONGOD_STOP_FAILED');
      }
    }
  }
});

