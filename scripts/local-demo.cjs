#!/usr/bin/env node
'use strict';
// Local, explicit operator. Never uses the private-server profile, remote Docker,
// host .env, Gmail, fixed passwords, destructive down/reset, or automatic CA trust.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const net=require('node:net'),https=require('node:https');
const {ORIGIN,SECRET_NAMES,project,compose}=require('../infra/local-demo/profile.cjs');
const ROOT=fs.realpathSync(path.resolve(__dirname,'..'));
const RUNTIME=path.join(ROOT,'.runtime','local-demo');
const CONFIG=path.join(RUNTIME,'compose.json');
const PROJECT=project(ROOT);
const ENV={...process.env};
for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','COMPOSE_FILE','COMPOSE_PROJECT_NAME','COMPOSE_PROFILES','NODE_EXTRA_CA_CERTS','NODE_TLS_REJECT_UNAUTHORIZED']) delete ENV[key];
let context;
function need(ok,code){if(!ok)throw Error(code);}
function safeCode(error,fallback='LOCAL_DEMO_FAILED'){
  const transport=new Set(['ECONNRESET','ECONNREFUSED','ETIMEDOUT','EPIPE','ERR_TLS_CERT_ALTNAME_INVALID',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','DEPTH_ZERO_SELF_SIGNED_CERT','CERT_HAS_EXPIRED']);
  if(transport.has(error?.code))return error.code;
  return /^[A-Z][A-Z0-9_]{2,80}$/.test(error?.message||'')?error.message:fallback;
}
function run(binary,args,{show=false,timeout=180000,input}={}){
  const result=spawnSync(binary,args,{env:ENV,cwd:ROOT,encoding:'utf8',timeout,input,
    stdio:show?['inherit','inherit','inherit']:['pipe','pipe','pipe'],maxBuffer:16*1024*1024,windowsHide:true});
  need(!result.error&&result.status===0,'COMMAND_FAILED');
  return result.stdout||'';
}
function docker(args,options){return run('docker',['--context',context,...args],options);}
function c(args,options){return docker(['compose','--env-file',path.join(RUNTIME,'empty.env'),
  '--project-name',PROJECT,'--file',CONFIG,...args],options);}
function localDocker(){
  context=run('docker',['context','show']).trim();
  need(/^[a-zA-Z0-9_.-]+$/.test(context),'DOCKER_CONTEXT_INVALID');
  const endpoint=JSON.parse(run('docker',['context','inspect',context]))[0]?.Endpoints?.docker?.Host;
  need(typeof endpoint==='string'&&(endpoint.startsWith('unix:///')||endpoint.startsWith('npipe:////./pipe/')),'REMOTE_DOCKER_REFUSED');
  need(docker(['info','--format','{{.OSType}}']).trim()==='linux','LINUX_DOCKER_REQUIRED');
  const version=docker(['compose','version','--short']).trim();
  need(/^v?2\./.test(version),'COMPOSE_V2_REQUIRED');
}
function ordinary(file,directory=false){
  const s=fs.lstatSync(file);
  need(!s.isSymbolicLink()&&(directory?s.isDirectory():s.isFile()),'UNEXPECTED_PATH');
  if(process.platform!=='win32'){
    need(s.uid===process.getuid(),'RUNTIME_OWNER');
    if(directory)need((s.mode&0o077)===0,'RUNTIME_PERMISSIONS');
  }
}
function write(file,value,mode=0o600){fs.writeFileSync(file,value,{flag:'wx',mode});}
function nginxConfig(){
  const source=fs.readFileSync(path.join(ROOT,'infra','integration','nginx.conf'),'utf8');
  need(source.split('127.0.0.2:9443').length===2,'NGINX_TEMPLATE_CHANGED');
  return source.replace('127.0.0.2:9443','127.0.0.2:9445');
}
function openssl(args){
  const candidates=process.platform==='win32'?['openssl','C:/Program Files/Git/usr/bin/openssl.exe']:['openssl'];
  const binary=candidates.find(name=>spawnSync(name,['version'],{env:ENV,encoding:'utf8',windowsHide:true}).status===0);
  need(binary,'OPENSSL_REQUIRED');
  return run(binary,args,{timeout:30000});
}
function validateRuntime(){
  ordinary(path.join(ROOT,'.runtime'),true);ordinary(RUNTIME,true);
  ordinary(path.join(RUNTIME,'secrets'),true);ordinary(path.join(RUNTIME,'tls'),true);
  ordinary(path.join(RUNTIME,'installation.json'));
  const installation=JSON.parse(fs.readFileSync(path.join(RUNTIME,'installation.json'),'utf8'));
  need(installation.root===ROOT&&installation.project===PROJECT&&installation.kind==='local-demo-v1','INSTALLATION_MISMATCH');
  for(const name of SECRET_NAMES){
    const file=path.join(RUNTIME,'secrets',name);ordinary(file);
    const value=fs.readFileSync(file,'utf8').trim();
    need((name==='mongo_keyfile'?/^[A-Za-z0-9+/=]{1000,1024}$/:/^[a-f0-9]{64}$/).test(value),'SECRET_FORMAT');
  }
  for(const name of ['ca.crt','ca.key','server.crt','server.key'])ordinary(path.join(RUNTIME,'tls',name));
  ordinary(CONFIG);ordinary(path.join(RUNTIME,'empty.env'));
  const expected=compose(ROOT);
  need(fs.readFileSync(CONFIG,'utf8')===JSON.stringify(expected,null,2)+'\n','CONFIG_DRIFT');
  need(fs.readFileSync(path.join(RUNTIME,'empty.env'),'utf8')==='','ENV_DRIFT');
  ordinary(path.join(RUNTIME,'nginx.conf'));
  need(fs.readFileSync(path.join(RUNTIME,'nginx.conf'),'utf8')===nginxConfig(),'NGINX_DRIFT');
  openssl(['verify','-CAfile',path.join(RUNTIME,'tls','ca.crt'),'-purpose','sslserver','-verify_ip','127.0.0.2',path.join(RUNTIME,'tls','server.crt')]);
  openssl(['x509','-in',path.join(RUNTIME,'tls','server.crt'),'-checkend','604800','-noout']);
  const cert=openssl(['x509','-in',path.join(RUNTIME,'tls','server.crt'),'-pubkey','-noout']);
  need(cert===openssl(['pkey','-in',path.join(RUNTIME,'tls','server.key'),'-pubout']),'TLS_KEY_MISMATCH');
}
function prepare(){
  if(fs.existsSync(RUNTIME)){validateRuntime();return;}
  // Check the executable before creating any runtime; do not leave half a setup
  // just because OpenSSL is missing on the host.
  openssl(['version']);
  const parent=path.join(ROOT,'.runtime');
  if(!fs.existsSync(parent))fs.mkdirSync(parent,{mode:0o700});
  ordinary(parent,true);
  fs.mkdirSync(RUNTIME,{mode:0o700});
  for(const dir of ['secrets','tls'])fs.mkdirSync(path.join(RUNTIME,dir),{mode:0o700});
  for(const name of SECRET_NAMES){
    // Bind-mounted files need to be readable by container UID1000 independently
    // of host UID. The containing host directories remain private (0700).
    const file=path.join(RUNTIME,'secrets',name);
    write(file,crypto.randomBytes(name==='mongo_keyfile'?756:32).toString(name==='mongo_keyfile'?'base64':'hex')+'\n',0o644);
    if(process.platform!=='win32')fs.chmodSync(file,0o644);
  }
  const tls=path.join(RUNTIME,'tls'),f=name=>path.join(tls,name);
  openssl(['req','-x509','-newkey','rsa:3072','-nodes','-days','365','-sha256','-keyout',f('ca.key'),'-out',f('ca.crt'),
    '-subj','/CN=NormativaCheck Demo Local','-addext','basicConstraints=critical,CA:TRUE,pathlen:0','-addext','keyUsage=critical,keyCertSign,cRLSign']);
  openssl(['req','-new','-newkey','rsa:2048','-nodes','-keyout',f('server.key'),'-out',f('server.csr'),'-subj','/CN=127.0.0.2']);
  write(f('server.ext'),'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.2\n');
  openssl(['x509','-req','-in',f('server.csr'),'-CA',f('ca.crt'),'-CAkey',f('ca.key'),'-set_serial','0x'+crypto.randomBytes(16).toString('hex'),
    '-out',f('server.crt'),'-days','90','-sha256','-extfile',f('server.ext')]);
  write(path.join(RUNTIME,'empty.env'),'');
  write(path.join(RUNTIME,'nginx.conf'),nginxConfig());
  write(CONFIG,JSON.stringify(compose(ROOT),null,2)+'\n');
  write(path.join(RUNTIME,'installation.json'),JSON.stringify({kind:'local-demo-v1',root:ROOT,project:PROJECT})+'\n');
  validateRuntime();
}
function scope(){
  const ids=docker(['ps','--all','--quiet','--filter','label=com.docker.compose.project='+PROJECT]).trim().split(/\s+/).filter(Boolean);
  if(ids.length){
    const rows=JSON.parse(docker(['inspect',...ids]));
    const seen=new Set();
    for(const row of rows){
      const labels=row.Config.Labels||{},service=labels['com.docker.compose.service'];
      need(['mongodb','backend','web'].includes(service)&&!seen.has(service),'PROJECT_SCOPE');
      seen.add(service);
      const actual=labels['com.docker.compose.project.config_files'];
      need(typeof actual==='string'&&path.resolve(actual)===CONFIG,'PROJECT_OWNERSHIP');
    }
  }
  for(const suffix of ['mongo_data','mongo_config']){
    const name=PROJECT+'_'+suffix;
    const known=docker(['volume','ls','--format','{{.Name}}']).trim().split(/\s+/);
    if(known.includes(name)){
      const data=JSON.parse(docker(['volume','inspect',name]))[0];
      need(data.Labels?.['com.docker.compose.project']===PROJECT,'VOLUME_OWNERSHIP');
    }
  }
  const networks=docker(['network','ls','--format','{{.Name}}']).trim().split(/\s+/);
  for(const suffix of ['database','application','ingress']){
    const name=PROJECT+'_'+suffix;
    if(networks.includes(name)){
      const data=JSON.parse(docker(['network','inspect',name]))[0];
      need(data.Labels?.['com.docker.compose.project']===PROJECT&&data.Internal===(suffix!=='ingress'),'NETWORK_OWNERSHIP');
    }
  }
}
function request(route,options={}){
  return new Promise((resolve,reject)=>{
    // Every probe gets a fresh connection. Synchronous Docker stop/start blocks
    // socket-close events; a pooled pre-stop socket must not be reused afterwards.
    const req=https.request(ORIGIN+route,{ca:fs.readFileSync(path.join(RUNTIME,'tls','ca.crt')),rejectUnauthorized:true,timeout:10000,...options,agent:false},res=>{
      let body='';res.setEncoding('utf8');res.on('data',chunk=>{body+=chunk;if(body.length>4*1024*1024)req.destroy(Error('BODY_LIMIT'));});
      res.on('aborted',()=>reject(Error('HTTPS_RESPONSE_ABORTED')));res.on('error',reject);
      res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}));
    });
    req.on('error',reject);req.on('timeout',()=>req.destroy(Error('HTTPS_TIMEOUT')));req.end(options.body);
  });
}
async function verify(){
  const h=await request('/api/health');need(h.status===200&&JSON.parse(h.body).db==='connected','HEALTH_FAILED');
  need((await request('/')).status===200,'FRONTEND_FAILED');
  need((await request('/api/auth/session')).status===401,'ANONYMOUS_ACCESS');
  need((await request('/api/auth/login',{method:'POST',headers:{Origin:'https://other.invalid','Content-Type':'application/json'},body:'{}'})).status===403,'ORIGIN_NOT_BLOCKED');
    need((await request('/',{servername:'',headers:{Host:'localhost:9445'}})).status===421,'HOST_NOT_BLOCKED');
  let rejected=false;try{await request('/',{servername:'other.invalid'});}catch(e){rejected=e.code==='ERR_TLS_CERT_ALTNAME_INVALID';}
  need(rejected,'TLS_NAME_NOT_BLOCKED');
  console.log('VERIFICADO: HTTPS local, interfaz, API/Mongo y rechazos anonimo/origen/Host. No prueba SMTP.');
}
async function portFree(){
  const web=c(['ps','--status','running','--quiet','web']).trim();if(web)return;
  await new Promise((resolve,reject)=>{
    const server=net.createServer();server.once('error',()=>reject(Error('PORT_9445_BUSY')));
    server.listen(9445,'127.0.0.2',()=>server.close(resolve));
  });
}
async function main(){
  const action=process.argv[2]||'help';
  need(process.argv.length<=3,'NO_EXTRA_ARGUMENTS');
  if(action==='help'){
    console.log('node scripts/local-demo.cjs start|account|verify|status|stop|prepare');
    console.log('Demo LOCAL con Docker Linux/Compose v2, Node 24 y OpenSSL. Nunca usa Hetzner ni Gmail.');
    return;
  }
  need(['start','account','verify','status','stop','prepare'].includes(action),'UNKNOWN_ACTION');
  need(Number(process.versions.node.split('.')[0])>=24,'NODE_24_REQUIRED');
  if(action==='prepare'){prepare();console.log('Configuracion local preparada. Sin Docker ni cambios de confianza TLS.');return;}
  localDocker();
  if(action==='start')prepare();else validateRuntime();
  scope();c(['config','--quiet']);
  if(action==='start'){
    await portFree();
    c(['build','backend','web'],{show:true,timeout:900000});
    c(['up','--detach','mongodb'],{show:true,timeout:180000});
    let ready=false;
    for(let attempt=0;attempt<90;attempt++){
      try{c(['exec','-T','mongodb','mongosh','--quiet','--norc','--file','/integration/mongo-ready.js'],{timeout:10000});ready=true;break;}
      catch{await new Promise(resolve=>setTimeout(resolve,1500));}
    }
    need(ready,'MONGO_START_TIMEOUT');
    c(['exec','-T','mongodb','mongosh','--quiet','--norc','--file','/integration/mongo-init.js'],{show:true,timeout:180000});
    c(['up','--detach','--wait','--wait-timeout','180','backend','web'],{show:true,timeout:240000});
    c(['exec','-T','mongodb','mongosh','--quiet','--norc','--file','/integration/mongo-check.js'],{show:true});
    await verify();
    console.log('Abre '+ORIGIN+'/espacio-de-trabajo');
    console.log('CA local: '+path.join(RUNTIME,'tls','ca.crt')+' (no se instala automaticamente).');
    console.log('Primera vez: node scripts/local-demo.cjs account. No regeneres claves ni borres volumenes para reintentar.');
  }else if(action==='account'){
    need(process.stdin.isTTY&&process.stdout.isTTY,'ACCOUNT_TTY_REQUIRED');
    c(['exec','-T','backend','node','scripts/integration/create-test-workspace.js'],{show:true});
  }else if(action==='verify'){await verify();}
  else if(action==='status'){c(['ps'],{show:true});}
  else{c(['stop'],{show:true});console.log('Solo esta demo detenida. Datos, secretos y contenedores conservados.');}
}
if(require.main===module)main().catch(error=>{
  const safe=safeCode(error);
  console.error('Demo detenida: '+safe+'. No se han borrado datos ni restablecido credenciales.');
  console.error('Comprueba Docker local Linux, Compose v2, Node 24, OpenSSL, permisos y que 127.0.0.2:9445 este libre.');
  process.exitCode=1;
});
module.exports={main,prepare,validateRuntime,scope,request,verify,localDocker,c,docker,safeCode,ROOT,RUNTIME,PROJECT};
