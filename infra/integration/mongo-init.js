// Solo se llama explícitamente por scripts/integracion.sh. Idempotente, no borra datos.
const fs = require('fs');
const rootPassword = fs.readFileSync('/run/secrets/mongo_root_password', 'utf8').trim();
const appPassword = fs.readFileSync('/run/secrets/mongo_app_password', 'utf8').trim();
const admin = db.getSiblingDB('admin');
const deadline = Date.now() + 120000;
let ready = false;
while (Date.now() < deadline) {
  try {
    if (!admin.auth('nc_bootstrap', rootPassword)) throw Error('auth');
    const h = admin.runCommand({ hello: 1 });
    // No inicializar contra el mongod standalone temporal de la imagen oficial.
    if (h.setName === 'nc-integration-rs') { ready = true; break; }
    if (h.isreplicaset) {
      const result = admin.runCommand({ replSetInitiate: {
        _id: 'nc-integration-rs', members: [{ _id: 0, host: 'mongodb:27017' }]
      } });
      if (result.ok !== 1 && result.codeName !== 'AlreadyInitialized') throw Error('init');
    }
  } catch (_) { /* Esperar al proceso definitivo, sin revelar secretos. */ }
  sleep(1000);
}
if (!ready) { print('ERROR: Mongo no está listo; no se han borrado datos.'); quit(1); }
while (Date.now() < deadline && !admin.runCommand({ hello: 1 }).isWritablePrimary) sleep(500);
const h = admin.runCommand({ hello: 1 });
if (!h.isWritablePrimary || h.setName !== 'nc-integration-rs') quit(1);
const config = admin.runCommand({ replSetGetConfig: 1 }).config;
if (!config || config.members.length !== 1 || config.members[0].host !== 'mongodb:27017') {
  print('ERROR: configuración de réplica inesperada; revisión manual.'); quit(1);
}
const target = db.getSiblingDB('nc_integracion');
const current = target.getUser('nc_app');
if (!current) {
  target.createUser({ user: 'nc_app', pwd: appPassword, roles: [{ role: 'readWrite', db: 'nc_integracion' }] });
} else if (current.roles.length !== 1 || current.roles[0].role !== 'readWrite' || current.roles[0].db !== 'nc_integracion') {
  print('ERROR: permisos de nc_app inesperados; no se han cambiado.'); quit(1);
}
const probe = new Mongo('mongodb://127.0.0.1:27017/?directConnection=true');
if (!probe.getDB('nc_integracion').auth('nc_app', appPassword)) {
  print('ERROR: credencial de aplicación no coincide; no se ha regenerado.'); quit(1);
}
print('OK: réplica primaria y usuario de aplicación limitado a nc_integracion.');
