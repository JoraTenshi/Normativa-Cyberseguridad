try {
  const a = db.getSiblingDB('admin');
  if (!a.auth('nc_bootstrap', require('fs').readFileSync('/run/secrets/mongo_root_password', 'utf8').trim())) quit(1);
  const h = a.runCommand({ hello: 1 });
  quit(h.isreplicaset || h.setName === 'nc-integration-rs' ? 0 : 1);
} catch (_) { quit(1); }
