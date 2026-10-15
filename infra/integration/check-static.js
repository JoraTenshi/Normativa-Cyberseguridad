'use strict';
// Checks sin daemon Docker; no levanta ni cambia servicios.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'infra/integration');
const command=(bin,args)=>execFileSync(bin,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const c=JSON.parse(command('docker',['--host','unix:///var/run/docker.sock','compose','--env-file','/dev/null','-p','normativacheck_integracion','-f',dir+'/compose.yaml','config','--format','json']));
assert.equal(c.name,'normativacheck_integracion');
assert.deepEqual(Object.keys(c.services).sort(),['backend','mongodb','web']);
assert.equal(c.services.web.ports.length,1);
assert.deepEqual([c.services.web.ports[0].host_ip,c.services.web.ports[0].published,c.services.web.ports[0].target],['127.0.0.2','9443',8443]);
for(const name of ['backend','mongodb'])assert.equal(c.services[name].ports,undefined);
assert.equal(c.networks.database.internal,true);
for(const [name,s] of Object.entries(c.services)){
  assert.equal(s.container_name,undefined);assert.equal(s.privileged,undefined);
  for(const v of s.volumes||[])if(v.type==='bind')assert.ok(v.source.startsWith(root+'/infra/integration'));
}
for(const [key,v] of Object.entries(c.volumes)){assert.equal(v.external,undefined);assert.equal(v.name,'normativacheck_integracion_'+key);}
assert.deepEqual(Object.keys(c.services.backend.environment).sort(),['APP_URL','CORS_ORIGIN','NODE_ENV']);
assert.equal(c.services.backend.secrets.some(s=>s.source==='mongo_root_password'),false);
for(const s of Object.values(c.secrets)){
  assert.ok(s.file.startsWith(root+'/.runtime/integration/'));
  assert.equal(fs.statSync(s.file).mode&0o077,0);
}
assert.equal(fs.statSync(root+'/.runtime/integration').mode&0o077,0);
for(const name of ['mongo-init.js','mongo-ready.js','mongo-health.js','mongo-check.js','prepare.js','verify-https.js'])command('node',['--check',dir+'/'+name]);
command('bash',['-n',root+'/scripts/integracion.sh']);
command('bash',['-n',dir+'/mongo-entrypoint.sh']);
console.log('OK: Compose aislado, único puerto loopback, red de datos privada, volúmenes propios, secretos fuera de entorno/imágenes y sintaxis.');
// nginx -t valida con rutas temporales, sin parar o arrancar el Nginx existente.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'nc-integration-config-'));
try {
  let nginx=fs.readFileSync(dir+'/nginx.conf','utf8')
    .replace('user nginx;','')
    .replace('pid /var/run/nginx.pid;','pid '+temp+'/nginx.pid;')
    .replace('error_log /dev/stderr warn;','error_log stderr warn;')
    .replace('access_log /dev/stdout integration;','access_log '+temp+'/access.log integration;')
    .replace('/run/secrets/tls_certificate',root+'/.runtime/integration/tls/server.crt')
    .replace('/run/secrets/tls_key',root+'/.runtime/integration/tls/server.key')
    .replace('http {','http {\n  client_body_temp_path '+temp+'/body;\n  proxy_temp_path '+temp+'/proxy;\n  fastcgi_temp_path '+temp+'/fastcgi;\n  uwsgi_temp_path '+temp+'/uwsgi;\n  scgi_temp_path '+temp+'/scgi;');
  fs.writeFileSync(temp+'/nginx.conf',nginx,{flag:'wx',mode:0o600});
  command('nginx',['-t','-e','stderr','-p',temp+'/', '-c',temp+'/nginx.conf']);
  console.log('OK: sintaxis Nginx (binario nativo); no acredita el build del contenedor.');
} finally {
  if(path.dirname(fs.realpathSync(temp))!==fs.realpathSync(os.tmpdir())||!path.basename(temp).startsWith('nc-integration-config-'))throw Error('Ruta temporal inválida');
  fs.rmSync(temp,{recursive:true});
}
