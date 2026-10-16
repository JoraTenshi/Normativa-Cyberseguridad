'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process');
const {compose,project,ORIGIN,SECRET_NAMES}=require('../../infra/local-demo/profile.cjs');
const root=path.resolve(__dirname,'../..');
test('portable profile derives project identity from checkout and uses only current source',()=>{
  const a=compose(root),b=compose(root+'-second');
  assert.notEqual(a.name,b.name);assert.equal(a.name,project(root));
  for(const role of ['backend','web'])assert.ok(a.services[role].build.context.startsWith(root.replaceAll('\\','/')));
  assert.equal(a.services.backend.build.dockerfile,'Dockerfile.integration');
  assert.equal(a.services.web.build.dockerfile,'Dockerfile.integration');
  assert.throws(()=>compose('relative'));
});
test('only local HTTPS published; no backend or Mongo ports, no remote database',()=>{
  const c=compose(root);
  assert.deepEqual(c.services.web.ports,[{target:8443,published:'9445',host_ip:'127.0.0.2',protocol:'tcp'}]);
  assert.equal(c.services.backend.ports,undefined);assert.equal(c.services.mongodb.ports,undefined);
  assert.ok(c.networks.database.internal&&c.networks.application.internal);
  assert.equal(c.networks.ingress.internal,false);
  assert.deepEqual(c.services.web.networks,['application','ingress']);
  assert.deepEqual(c.services.backend.networks,['database','application']);
  assert.deepEqual(c.services.mongodb.networks,['database']);
  assert.equal(c.services.backend.environment.APP_URL,ORIGIN);
  assert.equal(c.services.backend.environment.CORS_ORIGIN,ORIGIN);
  assert.equal(c.services.backend.environment.NC_LOCAL_DEMO,'1');
  assert.ok(!JSON.stringify(c).includes('10.77.77.1'));
});
test('only local generated secret references; no SMTP, fixed credentials or host docker socket',()=>{
  const c=compose(root),text=JSON.stringify(c);
  for(const secret of Object.values(c.secrets))assert.ok(secret.file.includes('/.runtime/local-demo/'));
  assert.deepEqual(c.services.backend.secrets,['mongo_app_password','jwt_secret','totp_key']);
  assert.ok(!text.includes('SMTP'));assert.ok(!text.includes('/var/run/docker.sock'));
  assert.equal(Object.keys(c.secrets).length,SECRET_NAMES.length+2);
});
test('backend and web readonly, minimum worker capabilities, Linux architecture explicit',()=>{
  const c=compose(root);
  for(const s of Object.values(c.services)) {assert.equal(s.platform,'linux/amd64');assert.equal(s.restart,'no');}
  for(const s of [c.services.backend,c.services.web]){assert.ok(s.read_only);assert.deepEqual(s.cap_drop,['ALL']);}
  assert.deepEqual(c.services.web.cap_add,['CHOWN','SETGID','SETUID']);
  assert.equal(c.services.backend.cap_add,undefined);
  for(const s of Object.values(c.services))for(const v of s.volumes||[])if(v.type==='bind'){assert.ok(v.read_only);assert.equal(v.bind.create_host_path,false);}
});
test('operator command help has no setup side effects or Docker requirement',()=>{
  const result=spawnSync(process.execPath,[path.join(root,'scripts/local-demo.cjs'),'help'],{encoding:'utf8'});
  assert.equal(result.status,0);assert.match(result.stdout,/start\|account\|verify\|status\|stop\|prepare/);
});
test('operator has no cleanup/reset/remote daemon commands; preserves data on stop',()=>{
  const source=fs.readFileSync(path.join(root,'scripts/local-demo.cjs'),'utf8');
  assert.doesNotMatch(source,/['"]down['"]|['"]prune['"]|dropDatabase|deleteMany|--privileged|chmod.*666|reset-password/);
  assert.match(source,/REMOTE_DOCKER_REFUSED/);
  assert.match(source,/ACCOUNT_TTY_REQUIRED/);
  assert.match(source,/PROJECT_OWNERSHIP/);
  assert.match(source,/VOLUME_OWNERSHIP/);
  assert.match(source,/NETWORK_OWNERSHIP/);
  assert.match(source,/rejectUnauthorized:true/);
});
test('all referenced source files are in the same tree',()=>{
  for(const name of ['backend/Dockerfile.integration','frontend/Dockerfile.integration',
    'backend/scripts/integration/create-test-workspace.js','infra/integration/nginx.conf',
    'infra/integration/mongo-entrypoint.sh','infra/integration/mongo-init.js','infra/integration/mongo-ready.js','infra/integration/mongo-check.js']) {
    assert.ok(fs.statSync(path.join(root,name)).isFile(),name);
  }
});

test('explicit demo origin leaves integration unchanged and rejects arbitrary hosts',()=>{
  const {loadConfig}=require('../scripts/integration/config');
  const saved=Object.fromEntries(['APP_URL','CORS_ORIGIN','NC_LOCAL_DEMO'].map(k=>[k,process.env[k]]));
  const secrets={mongo_app_password:'a'.repeat(64),jwt_secret:'b'.repeat(64),totp_key:'c'.repeat(64)};
  try{
    delete process.env.NC_LOCAL_DEMO;
    process.env.APP_URL=process.env.CORS_ORIGIN='https://127.0.0.2:9443';
    assert.equal(loadConfig(n=>secrets[n]).origin,'https://127.0.0.2:9443');
    process.env.NC_LOCAL_DEMO='1';
    assert.throws(()=>loadConfig(n=>secrets[n]),/Origen/);
    process.env.APP_URL=process.env.CORS_ORIGIN=ORIGIN;
    assert.equal(loadConfig(n=>secrets[n]).origin,ORIGIN);
    process.env.CORS_ORIGIN='https://attacker.invalid';
    assert.throws(()=>loadConfig(n=>secrets[n]),/Origen/);
    process.env.NC_LOCAL_DEMO='yes';
    assert.throws(()=>loadConfig(n=>secrets[n]),/Perfil/);
  }finally{for(const [k,v] of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
