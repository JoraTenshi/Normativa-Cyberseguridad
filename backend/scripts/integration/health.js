'use strict';
const { loadConfig } = require('./config');
const { diagnostic } = require('./diagnostic');
let stage='secretos';
(async () => {
  const config=loadConfig();
  stage='carga_aplicacion';
  const { MongoClient } = require('mongoose').mongo;
  const client = new MongoClient(config.uri, { serverSelectionTimeoutMS: 2000 });
  try {
    stage='conexion_mongodb';
    await client.connect();
    stage='replica';
    const h = await client.db().admin().command({ hello: 1 });
    if (!h.isWritablePrimary || h.setName !== 'nc-integration-rs') throw Error('replica');
    stage='http';
    const res = await fetch('http://127.0.0.1:5000/health', { signal: AbortSignal.timeout(2000) });
    if (!res.ok || !(await res.json()).ok) throw Error('api');
  } finally { await client.close(); }
})().catch(error => {
  console.error('Healthcheck fallido: '+diagnostic(stage,error));
  process.exitCode = 1;
});
