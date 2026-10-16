'use strict';
// Standalone administrative operator. NOT an HTTP route, startup hook, or seed.
// Execution requires explicit authorization for this synthetic organization.
const path = require('node:path');
const EMAIL = 'normativacheck@gmail.com';
const COMPANY = 'Demostración NormativaCheck';
const IDENTIFIER = 'DEMO00001'; // Synthetic storage identifier, NOT a valid NIF.
const RECEIPT = 'private-demonstration-workspace-v1';
const ORIGIN = 'https://10.77.77.1:8443';
const CODES = new Set(['ENVIRONMENT_REFUSED', 'DATABASE_REFUSED', 'ACCOUNT_NOT_FOUND',
  'ACCOUNT_NOT_VERIFIED', 'ACCOUNT_CHANGED', 'AUTHORIZATION_REQUIRED',
  'EXISTING_DATA_REFUSED', 'RECEIPT_STATE_CHANGED', 'INDEX_REQUIRED']);
function fail(code) { throw Object.assign(new Error(code), { code }); }
function safeError(e) { return CODES.has(e?.code) ? e.code : e?.code === 11000
  ? 'CONCURRENT_OR_EXISTING_DATA' : 'OPERATION_FAILED_OR_UNCERTAIN'; }
async function destination(mongoose) {
  const h = await mongoose.connection.db.command({ hello: 1 });
  if (mongoose.connection.name !== 'nc_private' || h.setName !== 'nc-private-rs' ||
      !h.isWritablePrimary) fail('DATABASE_REFUSED');
  return h;
}
async function inspect({ mongoose, Usuario, Membresia }) {
  await destination(mongoose);
  const users = await Usuario.find({ email: EMAIL }).select('_id email emailVerifiedAt twoFactorEnabled rol').lean();
  if (users.length !== 1) fail('ACCOUNT_NOT_FOUND');
  const u = users[0];
  return { status: 'READ_ONLY_ACCOUNT_INSPECTION', userId: String(u._id), email: u.email,
    verified: !!u.emailVerifiedAt, mfa: u.twoFactorEnabled === true,
    activeMemberships: await Membresia.countDocuments({ usuario: u._id, estado: 'activa' }) };
}
async function indexes({ Organizacion, Membresia }) {
  for (const [model, name, key] of [
    [Organizacion, 'organizacion_identificador_unico', { pais: 1, identificador_tipo: 1, identificador_valor: 1 }],
    [Membresia, 'membresia_organizacion_usuario_unica', { organizacion: 1, usuario: 1 }]
  ]) {
    const i = (await model.collection.listIndexes().toArray()).find(i => i.name === name);
    if (!i?.unique || i.sparse || i.partialFilterExpression || JSON.stringify(i.key) !== JSON.stringify(key)) fail('INDEX_REQUIRED');
  }
}
async function provision(deps, { userId, confirmation, authorizationRef }) {
  if (typeof userId !== 'string' || !/^[a-f0-9]{24}$/.test(userId) ||
      confirmation !== 'AUTORIZO DEMO ' + userId || typeof authorizationRef !== 'string' ||
      authorizationRef.trim().length < 20 || authorizationRef.length > 500 ||
      /[\x00-\x1f\x7f<>]/.test(authorizationRef)) fail('AUTHORIZATION_REQUIRED');
  const { mongoose, Usuario, Organizacion, Membresia } = deps;
  await destination(mongoose);
  await indexes(deps);
  // No password/token fields are selected or returned; never set emailVerifiedAt.
  const account = await Usuario.findOne({ _id: userId, email: EMAIL }).select('_id emailVerifiedAt rol').lean();
  if (!account) fail('ACCOUNT_NOT_FOUND');
  if (!account.emailVerifiedAt) fail('ACCOUNT_NOT_VERIFIED');
  if (account.rol !== 'usuario') fail('ACCOUNT_CHANGED');
  const receipts = mongoose.connection.db.collection('_private_demo_setup');
  try { await mongoose.connection.db.createCollection('_private_demo_setup'); }
  catch (e) { if (e.code !== 48) throw e; }
  return mongoose.connection.transaction(async session => {
    // Serialize concurrent changes to verification/account. No credential or role changes.
    const u = await Usuario.findOneAndUpdate({ _id: userId, email: EMAIL,
      emailVerifiedAt: { $type: 'date' }, rol: 'usuario' }, { $inc: { __v: 1 } },
      { session, new: true, timestamps: false }).select('_id').lean();
    if (!u) fail('ACCOUNT_CHANGED');
    const previous = await receipts.findOne({ _id: RECEIPT }, { session });
    if (previous) {
      if (String(previous.usuario) !== userId || previous.kind !== 'authorized-synthetic-workspace' ||
          previous.origin !== ORIGIN) fail('RECEIPT_STATE_CHANGED');
      const org = await Organizacion.findOne({ _id: previous.organizacion, razon_social: COMPANY,
        pais: 'ES', identificador_tipo: 'NIF', identificador_valor: IDENTIFIER, estado: 'activa' }).session(session).lean();
      const member = await Membresia.findOne({ _id: previous.membresia, usuario: u._id,
        organizacion: previous.organizacion, rol: 'administrador', estado: 'activa' }).session(session).lean();
      if (!org || !member) fail('RECEIPT_STATE_CHANGED');
      return { status: 'EXISTS_NO_PERMISSIONS_CHANGED', organizationId: String(org._id), company: COMPANY };
    }
    // Never adopt an existing organization, real or synthetic, or reactivate a membership.
    if (await Organizacion.exists({ $or: [{ identificador_valor: IDENTIFIER }, { razon_social: COMPANY }] }).session(session)) fail('EXISTING_DATA_REFUSED');
    const [org] = await Organizacion.create([{ razon_social: COMPANY, pais: 'ES',
      identificador_tipo: 'NIF', identificador_valor: IDENTIFIER, estado: 'activa' }], { session });
    const [member] = await Membresia.create([{ usuario: u._id, organizacion: org._id,
      rol: 'administrador', estado: 'activa', funcion_profesional: 'Demostración con datos ficticios' }], { session });
    await receipts.insertOne({ _id: RECEIPT, usuario: u._id, organizacion: org._id, membresia: member._id,
      createdAt: new Date(), kind: 'authorized-synthetic-workspace', origin: ORIGIN,
      authorizationRef: authorizationRef.trim(), syntheticIdentifier: true,
      emailVerification: 'existing-real-verification-required',
      scope: 'organization-only-no-global-permissions-no-real-company-approval' }, { session });
    return { status: 'SYNTHETIC_WORKSPACE_CREATED', organizationId: String(org._id), company: COMPANY };
  }, { readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000 });
}
async function cli() {
  const mode = process.argv[2];
  if (process.argv.length !== 3 || !['inspect', 'provision'].includes(mode) || process.cwd() !== '/app' ||
      process.getuid?.() !== 1000 || process.env.NODE_ENV !== 'production' ||
      process.env.NC_HTTPS_ORIGIN !== ORIGIN ||
      (mode === 'provision' && (!process.stdin.isTTY || !process.stdout.isTTY))) fail('ENVIRONMENT_REFUSED');
  const req = file => require(path.resolve('/app', file));
  const config = req('scripts/private/config.js').loadConfig();
  if (config.origin !== ORIGIN) fail('ENVIRONMENT_REFUSED');
  const mongoose = req('node_modules/mongoose');
  // A read-only inspection must not implicitly create collections or indexes.
  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);
  let rl;
  try {
    await mongoose.connect(config.uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 3 });
    const deps = { mongoose, Usuario: req('models/Usuario.js'), Organizacion: req('models/Organizacion.js'), Membresia: req('models/Membresia.js') };
    const state = await inspect(deps);
    console.log(JSON.stringify(state));
    if (mode === 'inspect') return;
    if (!state.verified) fail('ACCOUNT_NOT_VERIFIED');
    rl = require('node:readline/promises').createInterface({ input: process.stdin, output: process.stdout });
    console.log('Solo organización ficticia ' + COMPANY + '. No modifica contraseñas, verificación ni permisos globales.');
    const confirmation = await rl.question('Para autorizar escribe AUTORIZO DEMO ' + state.userId + ': ');
    const authorizationRef = await rl.question('Motivo y referencia de autorización (20–500 caracteres, sin secretos): ');
    console.log(JSON.stringify(await provision(deps, { userId: state.userId, confirmation, authorizationRef })));
  } finally { rl?.close(); await mongoose.disconnect(); }
}
if (require.main === module) cli().catch(e => {
  console.error(safeError(e) + ': no repetir ni restablecer datos ante resultado incierto.');
  process.exitCode = 1;
});
module.exports = { inspect, provision, destination, safeError, EMAIL, COMPANY, IDENTIFIER, RECEIPT };
