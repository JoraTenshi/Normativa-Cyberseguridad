// Verifica permisos y transacciones con el usuario real de aplicación.
// Solo usa documentos sintéticos de una colección técnica propia.
let stage='secreto';
try {
  const password=require('fs').readFileSync('/run/secrets/mongo_app_password','utf8').trim();
  stage='autenticacion';
  const conn=new Mongo('mongodb://127.0.0.1:27017/?directConnection=true');
  const target=conn.getDB('nc_integracion');
  if(!target.auth('nc_app',password))throw Error('auth');
  stage='aislamiento';
  let denied=false;
  try { conn.getDB('admin').getCollection('_integration_probe').findOne({}); }
  catch(e) { denied=e.code===13; }
  if(!denied)throw Error('scope');
  stage='coleccion_tecnica';
  if(!target.getCollectionNames().includes('_integration_probe'))target.createCollection('_integration_probe');
  // mongosh reserva propiedades que empiezan por _: no usar target._integration_probe.
  const probe=target.getCollection('_integration_probe');
  const id=new ObjectId(), aborted=new ObjectId();
  const session=conn.startSession();
  let verified=false;
  try {
    const c=session.getDatabase('nc_integracion').getCollection('_integration_probe');
    stage='commit';
    session.startTransaction({writeConcern:{w:'majority'}});
    c.insertOne({_id:id,kind:'startup-check',createdAt:new Date()});
    session.commitTransaction();
    stage='verificar_commit';
    if(!probe.findOne({_id:id}))throw Error('commit');
    stage='abort';
    session.startTransaction();
    c.insertOne({_id:aborted,kind:'must-not-persist'});
    session.abortTransaction();
    stage='verificar_abort';
    if(probe.findOne({_id:aborted}))throw Error('abort');
    verified=true;
  } finally {
    session.endSession();
    if(verified)stage='limpieza_tecnica';
    probe.deleteOne({_id:id}); // Solo el marcador generado por esta ejecución.
  }
  print('OK Mongo: aplicación sin privilegios administrativos; commit y abort reales.');
} catch(e) {
  const code=Number.isSafeInteger(e.code)?String(e.code):'NO_CLASIFICADO';
  const type=['Error','TypeError','MongoServerError','MongoNetworkError'].includes(e.name)?e.name:'Error';
  print('ERROR Mongo: etapa='+stage+' tipo='+type+' codigo='+code+'. No se han tocado datos de usuarios.');
  quit(1);
}
