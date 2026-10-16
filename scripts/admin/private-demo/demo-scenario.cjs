'use strict';
// Administrative synthetic data loader. Not a public API or automatic seed.
const path = require('node:path');
const access = require('./workspace-demo.cjs');
const SCENARIO = 'private-demonstration-scenario-v1';
const motive = 'DEMO FICTICIA: carga administrativa autorizada para grabación; no acredita cumplimiento real.';
const known = (clave, valor) => ({ clave, estado: 'conocido', valor });
const unknown = clave => ({ clave, estado: 'desconocido', motivo: 'por_consultar' });
function refuse(code) { throw Object.assign(Error(code), { code }); }
function services(base) {
  return { context: require(path.join(base, 'services/contextoEmpresa.js')),
    operations: require(path.join(base, 'services/operaciones.js')),
    scopes: require(path.join(base, 'services/alcancesEvaluacion.js')),
    records: require(path.join(base, 'services/registrosNormativos.js')) };
}
async function target(deps) {
  const { mongoose, Usuario, Organizacion, Membresia } = deps;
  await access.destination(mongoose);
  const receipt = await mongoose.connection.db.collection('_private_demo_setup').findOne({ _id: access.RECEIPT });
  if (!receipt || receipt.kind !== 'authorized-synthetic-workspace' || receipt.origin !== 'https://10.77.77.1:8443') refuse('DEMO_RECEIPT_REQUIRED');
  const user = await Usuario.findOne({ _id: receipt.usuario, email: access.EMAIL, rol: 'usuario', emailVerifiedAt: { $type: 'date' } }).select('_id').lean();
  const org = await Organizacion.findOne({ _id: receipt.organizacion, razon_social: access.COMPANY,
    identificador_valor: access.IDENTIFIER, estado: 'activa' }).select('_id').lean();
  const member = await Membresia.findOne({ _id: receipt.membresia, usuario: receipt.usuario,
    organizacion: receipt.organizacion, rol: 'administrador', estado: 'activa' }).select('_id').lean();
  if (!user || !org || !member) refuse('DEMO_STATE_CHANGED');
  return { usuarioId: String(user._id), organizacionId: String(org._id), membershipId: String(member._id) };
}
async function load(deps, api, confirmation) {
  const t = await target(deps);
  if (confirmation !== 'CARGAR DEMO ' + t.organizacionId) refuse('DEMO_CONFIRMATION_REQUIRED');
  const receipt = deps.mongoose.connection.db.collection('_private_demo_setup');
  const previous = await receipt.findOne({ _id: SCENARIO });
  if (previous) {
    if (previous.organizationId === t.organizacionId && previous.status === 'complete')
      return { status: 'SCENARIO_ALREADY_LOADED_NO_CHANGES', organizationId: t.organizacionId };
    refuse('SCENARIO_PARTIAL_REQUIRES_REVIEW');
  }
  // Never mix with a populated Workspace. The fixed technical receipt gates this loader.
  for (const name of ['contextos_empresa', 'operaciones', 'subespacios', 'alcances_evaluacion', 'registros_normativos']) {
    if (await deps.mongoose.connection.db.collection(name).countDocuments({ organizacion: new deps.mongoose.Types.ObjectId(t.organizacionId) })) refuse('WORKSPACE_NOT_EMPTY');
  }
  await receipt.insertOne({ _id: SCENARIO, organizationId: t.organizacionId, userId: t.usuarioId,
    status: 'started', stage: 'operations', startedAt: new Date(), synthetic: true, authorization: motive });
  // Each service performs its normal transaction, validation and history write.
  // On interruption retain partial data and refuse replay; never overwrite user edits.
  const entry = { usuarioId: t.usuarioId, organizacionId: t.organizacionId };
  const offerings = [
    { id: 'nube', nombre: 'DEMO · NubeDesk — soporte SaaS', tipo: 'servicio',
      descripcion: 'Caso ficticio: plataforma de tickets para pymes, alojamiento europeo y soporte remoto. No contiene clientes ni datos personales reales.',
      functions: ['desarrollo', 'alojamiento', 'operacion'], ia: false },
    { id: 'soc', nombre: 'DEMO · Vigía — ciberseguridad gestionada', tipo: 'servicio',
      descripcion: 'Caso ficticio: monitorización de alertas y respuesta coordinada para una entidad pública simulada. Contrato DEMO-ENS-01 pendiente de revisión.',
      functions: ['operacion', 'mantenimiento'], ia: false },
    { id: 'asistente', nombre: 'DEMO · Asistente de clasificación de tickets', tipo: 'producto',
      descripcion: 'Caso ficticio: clasificación asistida por IA con revisión humana. Piloto sin decisiones autónomas ni datos reales; roles y transferencias por analizar.',
      functions: ['desarrollo', 'distribucion'], ia: true }
  ];
  const operations = [];
  for (const item of offerings) {
    const result = await api.operations.guardarOperacion({ ...entry, clave: 'demo20261016_operation_' + item.id,
      datos: { nombre: item.nombre, descripcion: item.descripcion, hechos: [
        known('datos_terceros', true), known('sistemas_terceros', true), known('dp_establecimiento_es', true),
        known('dp_fase', item.ia ? 'prevista' : 'activa'), unknown('dp_ambito_rgpd'), unknown('dp_rol'),
        unknown('dp_regimen_general'), unknown('dp_entidad_privada')], motivo: motive } });
    operations.push(result);
  }
  await receipt.updateOne({ _id: SCENARIO, status: 'started' }, { $set: { stage: 'context', operationIds: operations.map(o => o.operacion.id) } });
  const facts = [known('pais_establecimiento', 'España'), known('mercados', ['España', 'Unión Europea']),
    known('clientes', ['Pymes privadas', 'Entidad pública ficticia']), known('plantilla', 14),
    known('publico_directo', true), known('cadena_publica', false), known('exigencia_ens', true),
    known('referencia_contrato_ens', 'DEMO-ENS-01: contrato ficticio, cláusula pendiente de revisión'),
    known('voluntario_iso', true), known('voluntario_ens', false), known('perfil_actividades', offerings.map(x => x.id))];
  offerings.forEach((item, i) => {
    const prefix = 'actividad_' + item.id + '_';
    for (const [k, v] of Object.entries({ nombre: item.nombre, tipo: item.tipo, funciones: item.functions,
      datos_terceros: true, sistemas_terceros: true, usa_ia: item.ia, desarrolla_ia: item.ia,
      descargable: item.tipo === 'producto', marca_propia: true, publico_directo: item.id === 'soc',
      exigencia_ens: item.id === 'soc', operaciones: [operations[i].operacion.id] })) facts.push(known(prefix + k, v));
    facts.push(unknown(prefix + 'por_cuenta_cliente'));
  });
  await api.context.guardarContexto({ ...entry, clave: 'demo20261016_company_context', datos: { hechos: facts, motivo: motive } });
  const proposal = await api.scopes.obtenerPropuestas(entry);
  const materialized = await api.scopes.materializar({ ...entry, clave: 'demo20261016_materialize', datos: {
    contextoVersion: proposal.contextoVersion, propuestaHuella: proposal.propuestaHuella, confirmar: true, motivo: motive,
    espacios: offerings.map(item => ({ actividadId: item.id, nuevo: { nombre: item.nombre, tipo: item.tipo, descripcion: item.descripcion } })),
    alcances: offerings.map(item => ({ clave: item.id, nombre: 'DEMO · Alcance ' + item.id,
      actividadIds: [item.id], sistemas: [item.nombre], informacion: ['Información sintética de demostración'],
      limites: 'Escenario didáctico; revisar alcance y aplicabilidad antes de cualquier uso real.',
      exclusiones: [{ elemento: 'Datos reales de terceros', motivo: 'Solo se utilizan ejemplos ficticios.' }],
      dependencias: ['Proveedor de infraestructura ficticio; condiciones pendientes de analizar'] }))
  } });
  await receipt.updateOne({ _id: SCENARIO, status: 'started' }, { $set: { stage: 'requirements-and-tasks', scopeIds: materialized.alcances.map(a => a.id) } });
  const tasks = [];
  for (let i = 0; i < offerings.length; i++) {
    const item = offerings[i], scope = materialized.alcances.find(a => a.clave === item.id);
    const requirement = await api.records.guardar({ ...entry, clave: 'demo20261016_requirement_' + item.id,
      datos: { alcance: { id: scope.id, version: scope.version, sha256: scope.sha256 },
        objeto: { tipo: 'operacion', id: operations[i].operacion.id, version: 1 },
        ficha: { id: 'RGPD28_FORMALIZACION_CONTENIDO', version: 3 }, motivo: motive } }, 'requisito');
    const task = await api.records.guardar({ ...entry, clave: 'demo20261016_task_' + item.id,
      datos: { titulo: ['DEMO · Delimitar los datos y el papel de NubeDesk', 'DEMO · Revisar el anexo del servicio Vigía', 'DEMO · Inventariar proveedores del asistente'][i],
        descripcion: 'Actividad ficticia de preparación. Contrastar los datos, responsables y documentación del escenario; no representa una revisión favorable ni un cumplimiento acreditado.',
        estado: ['pendiente', 'en_curso', 'terminada'][i], requisitos: [requirement.referencia], responsableMembresiaId: t.membershipId, motivo: motive } }, 'actuacion');
    tasks.push(task.id);
  }
  await receipt.updateOne({ _id: SCENARIO, status: 'started' }, { $set: { status: 'complete', stage: 'complete', taskIds: tasks, completedAt: new Date() } });
  return { status: 'SYNTHETIC_SCENARIO_LOADED', organizationId: t.organizacionId,
    operations: 3, subspaces: 3, scopes: 3, requirements: 3, tasks: 3,
    favorableReviews: 0, certification: false, fictional: true };
}
async function cli() {
  if (process.argv.length !== 2 || process.cwd() !== '/app' || process.getuid?.() !== 1000 ||
      process.env.NODE_ENV !== 'production' || process.env.NC_HTTPS_ORIGIN !== 'https://10.77.77.1:8443' ||
      !process.stdin.isTTY || !process.stdout.isTTY) refuse('ENVIRONMENT_REFUSED');
  const req = file => require(path.resolve('/app', file));
  const config = req('scripts/private/config.js').loadConfig();
  if (config.origin !== 'https://10.77.77.1:8443') refuse('ENVIRONMENT_REFUSED');
  const mongoose = req('node_modules/mongoose');
  mongoose.set('autoIndex', false); mongoose.set('autoCreate', false);
  let rl;
  try {
    await mongoose.connect(config.uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 3 });
    const deps = { mongoose, Usuario: req('models/Usuario.js'), Organizacion: req('models/Organizacion.js'), Membresia: req('models/Membresia.js') };
    const t = await target(deps);
    console.log('Destino exclusivo: ' + access.COMPANY + ' / ' + t.organizacionId);
    console.log('Carga de ejemplos ficticios; no revisiones favorables, certificaciones ni cambios de credenciales.');
    rl = require('node:readline/promises').createInterface({ input: process.stdin, output: process.stdout });
    const confirmation = await rl.question('Para confirmar escribe CARGAR DEMO ' + t.organizacionId + ': ');
    console.log(JSON.stringify(await load(deps, services('/app'), confirmation)));
  } finally { rl?.close(); await mongoose.disconnect(); }
}
if (require.main === module) cli().catch(e => {
  const allowed = new Set(['ENVIRONMENT_REFUSED', 'DEMO_RECEIPT_REQUIRED', 'DEMO_STATE_CHANGED',
    'DEMO_CONFIRMATION_REQUIRED', 'SCENARIO_PARTIAL_REQUIRES_REVIEW', 'WORKSPACE_NOT_EMPTY']);
  console.error((allowed.has(e?.code) ? e.code : 'SCENARIO_FAILED_OR_UNCERTAIN') + ': conservar datos; no repetir sin revisar recibo.');
  process.exitCode = 1;
});
module.exports = { services, target, load, SCENARIO };
