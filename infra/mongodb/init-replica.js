// Solo DENTRO de cybersec_mongo. No imprimir credenciales ni URI.
const admin = db.getSiblingDB('admin');
if (!admin.auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) {
  throw new Error('No se pudo autenticar con el usuario existente');
}
let iniciado = false;
try {
  const c = admin.runCommand({ replSetGetConfig: 1 });
  if (!c.ok) throw c;
  if (c.config._id !== 'nc-rs' || c.config.members.length !== 1 ||
      c.config.members[0].host !== 'mongodb:27017') {
    throw new Error('Replica existente distinta: requiere revisión manual');
  }
  iniciado = true;
} catch (e) {
  if (e.code !== 94 && e.codeName !== 'NotYetInitialized') throw e;
}
if (!iniciado) {
  const r = admin.runCommand({ replSetInitiate: { _id: 'nc-rs', members: [{ _id: 0, host: 'mongodb:27017' }] } });
  if (!r.ok) throw new Error('No se pudo iniciar replica');
}
let primario = false;
for (let i=0; i<60; i++) {
  const h=admin.runCommand({hello:1});
  if(h.setName==='nc-rs'&&h.isWritablePrimary){primario=true;break;}
  sleep(1000);
}
if(!primario)throw new Error('La replica no eligió primario a tiempo');
const s=db.getMongo().startSession();
try {
  const base=s.getDatabase('cybersec_audit');
  s.startTransaction({writeConcern:{w:'majority'}});
  base.getCollection('_nc_transaction_probe').insertOne({prueba:'se revierte',fecha:new Date()});
  s.abortTransaction();
} finally { s.endSession(); }
print('REPLICA_OK nc-rs; PRIMARY; transacción de prueba abortada.');
