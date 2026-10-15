'use strict';

// Herramienta administrativa LOCAL, no endpoint ni seed del producto.
// El CLI solo se conecta a nc_integracion con el usuario limitado existente.
const crypto = require('node:crypto');
const path = require('node:path');
const EMAIL = 'admin.workspace@example.invalid';
const NAME = 'Administrador de prueba';
const COMPANY = 'Empresa de prueba - NormativaCheck';
const IDENTIFIER = 'TEST00001'; // Identificador sintético, NO NIF real o validado.
const RECEIPT = 'workspace-test-v1';

function fail(code) { const e = new Error(code); e.code = code; return e; }

async function provision({ mongoose, Usuario, Organizacion, Membresia }) {
  const receipt = mongoose.connection.db.collection('_integration_setup');
  // Crear colección antes de la transacción; repetir no modifica documentos.
  try { await mongoose.connection.db.createCollection('_integration_setup'); }
  catch (error) { if (error.code !== 48) throw error; }
  await Promise.all([Usuario.init(), Organizacion.init(), Membresia.init()]);
  const session = await mongoose.startSession();
  const password = 'Nc9!' + crypto.randomBytes(24).toString('base64url');
  let result;
  try {
    await session.withTransaction(async () => {
      result = undefined;
      const previous = await receipt.findOne({ _id: RECEIPT }, { session });
      if (previous) {
        const user = await Usuario.findOne({ _id: previous.usuario, email: EMAIL }).session(session);
        const org = await Organizacion.findOne({ _id: previous.organizacion,
          identificador_valor: IDENTIFIER }).session(session);
        const member = await Membresia.findOne({ _id: previous.membresia,
          usuario: previous.usuario, organizacion: previous.organizacion }).session(session);
        if (!user || !org || !member) throw fail('TEST_STATE_INCOMPLETE');
        // Nunca reactivar, elevar permisos, verificar otra vez o resetear claves.
        if (user.rol !== 'usuario' || !user.emailVerifiedAt || org.estado !== 'activa' ||
            member.estado !== 'activa' || member.rol !== 'administrador') throw fail('TEST_STATE_CHANGED');
        result = { status: 'exists', email: EMAIL, organization: COMPANY };
        return;
      }
      // Bootstrap solo de la base nueva. No adoptar ni editar datos existentes.
      if (await Usuario.exists({}).session(session) || await Organizacion.exists({}).session(session) ||
          await Membresia.exists({}).session(session)) throw fail('DATABASE_NOT_EMPTY');
      const now = new Date();
      const user = new Usuario({ nombre: NAME, email: EMAIL, password,
        rol: 'usuario', emailVerifiedAt: now, twoFactorEnabled: false });
      await user.save({ session }); // Hook normal: bcrypt, nunca contraseña en claro en Mongo.
      const org = new Organizacion({ razon_social: COMPANY, pais: 'ES',
        identificador_tipo: 'NIF', identificador_valor: IDENTIFIER, estado: 'activa' });
      await org.save({ session });
      const member = new Membresia({ usuario: user._id, organizacion: org._id,
        rol: 'administrador', estado: 'activa', funcion_profesional: 'Cuenta sintética de pruebas' });
      await member.save({ session });
      // Recibo técnico del bootstrap; no inventar eventos de negocio soportados.
      await receipt.insertOne({ _id: RECEIPT, usuario: user._id, organizacion: org._id,
        membresia: member._id, createdAt: now, kind: 'synthetic-workspace-bootstrap',
        emailVerification: 'preverified-for-local-test-no-email-sent' }, { session });
      result = { status: 'created', email: EMAIL, organization: COMPANY, password };
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
    return result;
  } finally { await session.endSession(); }
}

async function cli() {
  // Funciona desde /app tanto como archivo como mediante node -e; no requiere rebuild.
  if (process.cwd() !== '/app' || process.getuid?.() !== 1000 ||
      process.env.NODE_ENV !== 'production' || process.argv.slice(2).length) throw fail('ENVIRONMENT_REFUSED');
  const { loadConfig } = require(path.resolve('scripts/integration/config.js'));
  const config = loadConfig(); // URI fija; no .env, argumentos URI ni contraseña administrativa.
  const mongoose = require('mongoose');
  try {
    await mongoose.connect(config.uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 3 });
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (mongoose.connection.name !== 'nc_integracion' || hello.setName !== 'nc-integration-rs' ||
        !hello.isWritablePrimary) throw fail('DATABASE_REFUSED');
    const result = await provision({ mongoose,
      Usuario: require(path.resolve('models/Usuario.js')),
      Organizacion: require(path.resolve('models/Organizacion.js')),
      Membresia: require(path.resolve('models/Membresia.js')) });
    if (result.status === 'exists') {
      console.log('La cuenta de prueba ya existe. No se ha cambiado su contraseña ni sus permisos.');
      console.log('Correo: ' + result.email);
      return;
    }
    console.log('CREADA cuenta sintética y empresa de prueba en nc_integracion.');
    console.log('Administrador solo de su empresa; sin permisos globales.');
    console.log('Correo prevalidado exclusivamente para esta prueba; no se ha enviado ningún email.');
    console.log('Correo: ' + result.email);
    console.log('Contraseña (guárdala; no se volverá a mostrar): ' + result.password);
    console.log('Empresa: ' + result.organization);
    console.log('Acceso normal: https://127.0.0.2:9443/espacio-de-trabajo');
  } finally { await mongoose.disconnect(); }
}

function safeError(error) {
  const codes = new Set(['TEST_STATE_INCOMPLETE', 'TEST_STATE_CHANGED', 'DATABASE_NOT_EMPTY',
    'ENVIRONMENT_REFUSED', 'DATABASE_REFUSED']);
  if (codes.has(error?.code)) return error.code;
  if (error?.code === 11000) return 'CONCURRENT_OR_EXISTING_DATA';
  return 'BOOTSTRAP_FAILED'; // No message, stack, URI, contraseña o valores de Mongo.
}
if (require.main === module || process.env.NC_INTEGRATION_TEST_ACCOUNT === '1') {
  cli().catch(error => {
    console.error('Cuenta no creada o resultado incierto: ' + safeError(error) +
      '. No se restablecen claves ni se borran datos. Si ya existe, se conserva.');
    process.exitCode = 1;
  });
}
module.exports = { provision, safeError, EMAIL, IDENTIFIER };
