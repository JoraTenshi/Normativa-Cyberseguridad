'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadConfig}=require('../scripts/integration/config');
const secrets={mongo_app_password:'a'.repeat(64),jwt_secret:'b'.repeat(64),totp_key:'c'.repeat(64)};
test('integración: configuración cerrada y secretos separados',()=>{
  const saved={APP_URL:process.env.APP_URL,CORS_ORIGIN:process.env.CORS_ORIGIN};
  try {
    process.env.APP_URL=process.env.CORS_ORIGIN='https://127.0.0.2:9443';
    const c=loadConfig(name=>secrets[name]);
    assert.equal(new URL(c.uri).hostname,'mongodb');
    assert.equal(new URL(c.uri).pathname,'/nc_integracion');
    assert.equal(new URL(c.uri).searchParams.get('authSource'),'nc_integracion');
    assert.equal(new URL(c.uri).searchParams.get('replicaSet'),'nc-integration-rs');
    assert.throws(()=>loadConfig(()=>'x'),/inválido/);
    assert.throws(()=>loadConfig(()=>secrets.jwt_secret),/distintos/);
    assert.throws(()=>loadConfig(()=>{throw Error('missing')}),/missing/);
    process.env.CORS_ORIGIN='http://localhost:3000';
    assert.throws(()=>loadConfig(name=>secrets[name]),/Origen/);
  } finally {for(const [k,v] of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
test('integración: Dockerfiles usan lockfiles y no copian todo el contexto',()=>{
  for(const folder of ['backend','frontend']) {
    const text=fs.readFileSync(path.resolve(__dirname,'../../',folder,'Dockerfile.integration'),'utf8');
    assert.match(text,/npm ci/);assert.doesNotMatch(text,/COPY \. \./);
    assert.doesNotMatch(text,/npm install/);assert.match(text,/@sha256:[a-f0-9]{64}/);
  }
});
test('integración: entrada no habilita la política de pruebas ni carga .env',()=>{
  const text=fs.readFileSync(path.resolve(__dirname,'../scripts/integration/start.js'),'utf8');
  assert.match(text,/const app = createApp\(\)/);
  assert.doesNotMatch(text,/require\(['"]dotenv/);
  assert.doesNotMatch(text,/rateLimits:\s*false|politicaSesiones:\s*['"]legado/);
});

test('integración: la imagen carga la aplicación como usuario no root durante el build',()=>{
  const docker=fs.readFileSync(path.resolve(__dirname,'../Dockerfile.integration'),'utf8');
  const ignore=fs.readFileSync(path.resolve(__dirname,'../Dockerfile.integration.dockerignore'),'utf8');
  assert.match(docker,/COPY constants \.\/constants/);
  assert.match(ignore,/^!constants\/\*\*$/m);
  assert.ok(docker.indexOf('USER node')<docker.indexOf('RUN node scripts/integration/check-image.js'));
});
function packagedLoad(omitConstants=false) {
  const {spawnSync}=require('node:child_process');
  const root=path.resolve(__dirname,'..');
  // Contrasta imports ejecutados con los COPY, sin copiar archivos ni usar Mongo.
  // No pretende emular todo Docker/.dockerignore.
  const script=String.raw`
    const fs=require('fs'),path=require('path'),Module=require('module');
    const root=process.cwd();
    let sources=fs.readFileSync('Dockerfile.integration','utf8').split('\n')
      .filter(l=>l.startsWith('COPY ')).flatMap(l=>l.split(/\s+/).slice(1,-1));
    if(process.env.NC_TEST_OMIT_CONSTANTS==='1')sources=sources.filter(s=>s!=='constants');
    const original=Module._resolveFilename;
    Module._resolveFilename=function(...args) {
      const file=original.apply(this,args);
      const rel=typeof file==='string'&&path.isAbsolute(file)?path.relative(root,file).split(path.sep).join('/'):null;
      if(rel&&!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('../')&&!rel.startsWith('node_modules/')) {
        if(!sources.some(s=>rel===s||rel.startsWith(s+'/'))) {
          const e=Error('BUILD_CONTEXT_OMISSION: '+rel);e.code='MODULE_NOT_FOUND';throw e;
        }
      }
      return file;
    };
    require('./scripts/integration/check-image').checkImage();
  `;
  return spawnSync(process.execPath,['-e',script],{
    cwd:root,encoding:'utf8',timeout:30000,
    env:{...process.env,NC_TEST_OMIT_CONSTANTS:omitConstants?'1':'0'}
  });
}
test('integración: carga real de imports incluida en el manifiesto COPY',()=>{
  const r=packagedLoad();assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/IMAGE_APP_LOAD_OK/);
});
test('integración: reproduce el fallo anterior si falta constants',()=>{
  const r=packagedLoad(true);assert.notEqual(r.status,0);assert.match(r.stderr,/BUILD_CONTEXT_OMISSION: constants\/temas\.js/);
});
test('integración: diagnóstico muestra etapa y código sin secretos o stack',()=>{
  const {diagnostic}=require('../scripts/integration/diagnostic');
  const e=Object.assign(Error('mongodb://usuario:secreto@host'),{code:'MODULE_NOT_FOUND'});
  assert.equal(diagnostic('carga_aplicacion',e),'etapa=carga_aplicacion tipo=Error codigo=MODULE_NOT_FOUND');
  const value=diagnostic('mongodb://secreto',{name:'secreto',code:'secreto',stack:'secreto'});
  assert.equal(value,'etapa=desconocida tipo=Error codigo=NO_CLASIFICADO');
  assert.equal(diagnostic('indices',{name:'MongoServerError',code:85}),'etapa=indices tipo=MongoServerError codigo=85');
  assert.doesNotMatch(diagnostic('conexion_mongodb',e),/usuario|secreto|mongodb:|stack/);
});
