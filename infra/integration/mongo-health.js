// Sin credenciales en argv ni salida. Se ejecuta como root del contenedor.
try {
  const fs = require('fs');
  const admin = db.getSiblingDB('admin');
  if (!admin.auth('nc_bootstrap', fs.readFileSync('/run/secrets/mongo_root_password', 'utf8').trim())) quit(1);
  const h = admin.runCommand({ hello: 1 });
  quit(h.setName === 'nc-integration-rs' && h.isWritablePrimary ? 0 : 1);
} catch (_) { quit(1); }
