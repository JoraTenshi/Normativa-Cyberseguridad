'use strict';
// Pure rendering only: never contacts Docker, writes secrets or starts services.
const IP='10.77.77.1',PROJECT='normativacheck_private';
const MONGO='mongo:7.0.43@sha256:494b956596706b19ba44908cb9d03648b585214600987b86cd2a34249358e572';
function guard(ok,code){if(!ok)throw Object.assign(Error(code),{code});}
function validate(p){
 guard(p&&Object.getPrototypeOf(p)===Object.prototype,'PROFILE');
 guard(Object.keys(p).sort().join(',')==='port,releaseRoot,smtpMode,stateRoot,wireguardUnit','PROFILE_KEYS');
 for(const key of ['releaseRoot','stateRoot'])guard(typeof p[key]==='string'&&/^\/(srv|opt|home\/jose)\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(p[key]),'PROFILE_PATH');
 guard(p.releaseRoot!==p.stateRoot&&!p.stateRoot.startsWith(p.releaseRoot+'/')&&!p.releaseRoot.startsWith(p.stateRoot+'/'),'STATE_INSIDE_CODE');
 guard([443,8443,9443].includes(p.port),'PRIVATE_PORT');
 guard(/^wg-quick@[A-Za-z0-9_-]+\.service$/.test(p.wireguardUnit),'WIREGUARD_UNIT');
 guard(['disabled','smtp465'].includes(p.smtpMode),'SMTP_MODE');
 return{...p,origin:'https://'+IP+(p.port===443?'':':'+p.port),authority:IP+(p.port===443?'':':'+p.port)};
}
function compose(input){
 const p=validate(input),root=p.releaseRoot,logging={driver:'json-file',options:{'max-size':'10m','max-file':'3'}};
 const common={restart:'no',logging};
 const health=(test,start_period)=>({test,interval:'15s',timeout:'8s',retries:5,start_period});
 const secrets={};for(const n of ['mongo_root_password','mongo_app_password','mongo_keyfile','jwt_secret','totp_key'])secrets[n]={file:p.stateRoot+'/secrets/'+n};
 if(p.smtpMode==='smtp465')secrets.smtp_config={file:p.stateRoot+'/secrets/smtp_config'};
 secrets.tls_certificate={file:p.stateRoot+'/tls/server.crt'};secrets.tls_key={file:p.stateRoot+'/tls/server.key'};
 return{name:PROJECT,services:{
  mongodb:{...common,image:MONGO,platform:'linux/amd64',entrypoint:['bash','/private/mongo-entrypoint.sh'],command:['mongod','--replSet','nc-private-rs','--keyFile','/run/mongo-private/keyfile','--bind_ip_all','--wiredTigerCacheSizeGB','0.25'],
   volumes:['mongo_data:/data/db','mongo_config:/data/configdb',root+'/infra/private:/private:ro'],tmpfs:['/run/mongo-private:size=1m'],secrets:['mongo_root_password','mongo_app_password','mongo_keyfile'],networks:['database'],mem_limit:'1g',pids_limit:256,stop_grace_period:'60s',healthcheck:health(['CMD','mongosh','--quiet','--norc','--file','/private/mongo-health.js'],'120s')},
  backend:{...common,build:{context:root+'/backend',dockerfile:'Dockerfile.private'},platform:'linux/amd64',init:true,read_only:true,tmpfs:['/tmp:mode=1777,size=64m'],cap_drop:['ALL'],security_opt:['no-new-privileges:true'],mem_limit:'768m',pids_limit:256,
   environment:{NODE_ENV:'production',NODE_OPTIONS:'--max-old-space-size=512',NC_HTTPS_ORIGIN:p.origin,APP_URL:p.origin,CORS_ORIGIN:p.origin,NC_MAIL_MODE:p.smtpMode},
   secrets:['mongo_app_password','jwt_secret','totp_key',...(p.smtpMode==='smtp465'?['smtp_config']:[])],networks:['database','application'],depends_on:{mongodb:{condition:'service_healthy'}},stop_grace_period:'35s',healthcheck:health(['CMD','node','scripts/private/health.js'],'90s')},
  web:{...common,build:{context:root,dockerfile:'infra/private/Dockerfile.web'},platform:'linux/amd64',read_only:true,tmpfs:['/var/cache/nginx:size=32m','/var/run:size=1m','/tmp:size=16m'],mem_limit:'256m',pids_limit:128,
   ports:[{target:8443,published:String(p.port),host_ip:IP,protocol:'tcp'}],volumes:[root+'/infra/private/nginx.conf:/etc/nginx/nginx.conf:ro'],secrets:['tls_certificate','tls_key'],networks:['application'],depends_on:{backend:{condition:'service_healthy'}},healthcheck:health(['CMD','wget','-q','--spider','http://127.0.0.1:8080/health'],'15s')}
 },networks:{database:{internal:true},application:{}},volumes:{mongo_data:{},mongo_config:{}},secrets};
}
function unit(input){const p=validate(input),command='/usr/bin/docker --host unix:///var/run/docker.sock compose --env-file /dev/null --project-name '+PROJECT+' --file '+p.releaseRoot+'/infra/private/compose.yaml';
 return `[Unit]\nDescription=NormativaCheck private application\nRequires=docker.service ${p.wireguardUnit}\nAfter=docker.service ${p.wireguardUnit}\nBindsTo=${p.wireguardUnit}\nPartOf=${p.wireguardUnit}\nStartLimitIntervalSec=300\nStartLimitBurst=3\n\n[Service]\nType=simple\nWorkingDirectory=${p.releaseRoot}\nExecStartPre=${command} config --quiet\nExecStart=${command} up --no-build --pull never --abort-on-container-exit\nExecStop=${command} stop --timeout 60\nRestart=always\nRestartSec=15\nTimeoutStopSec=90\n\n[Install]\nWantedBy=multi-user.target\n`;}
module.exports={validate,compose,unit,IP,PROJECT,MONGO};
