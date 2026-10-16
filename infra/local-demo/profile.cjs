'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
const ORIGIN = 'https://127.0.0.2:9445';
const SECRET_NAMES = ['mongo_root_password','mongo_app_password','mongo_keyfile','jwt_secret','totp_key'];
function project(root) { return 'nc_demo_' + crypto.createHash('sha256').update(root).digest('hex').slice(0,12); }
function compose(root) {
  if (!path.isAbsolute(root)) throw Error('ROOT_NOT_ABSOLUTE');
  const runtime = path.join(root,'.runtime','local-demo');
  const file = (...p) => path.join(root,...p).replaceAll('\\','/');
  const bind = (source,target) => ({type:'bind',source,target,read_only:true,bind:{create_host_path:false}});
  const health = (test,start='30s') => ({test,interval:'5s',timeout:'10s',retries:24,start_period:start});
  const hardening = {read_only:true,cap_drop:['ALL'],security_opt:['no-new-privileges:true'],restart:'no'};
  const secrets = Object.fromEntries(SECRET_NAMES.map(name=>[name,{file:path.join(runtime,'secrets',name).replaceAll('\\','/')}]));
  secrets.tls_certificate={file:path.join(runtime,'tls','server.crt').replaceAll('\\','/')};
  secrets.tls_key={file:path.join(runtime,'tls','server.key').replaceAll('\\','/')};
  return {
    name:project(root),
    services:{
      mongodb:{
        image:'mongo:7.0.43@sha256:494b956596706b19ba44908cb9d03648b585214600987b86cd2a34249358e572',
        platform:'linux/amd64',restart:'no',
        entrypoint:['bash','/integration/mongo-entrypoint.sh'],
        command:['mongod','--replSet','nc-integration-rs','--keyFile','/run/mongo-private/keyfile','--bind_ip_all','--wiredTigerCacheSizeGB','0.5'],
        volumes:[{type:'volume',source:'mongo_data',target:'/data/db'},{type:'volume',source:'mongo_config',target:'/data/configdb'},
          bind(file('infra','integration'),'/integration')],
        tmpfs:['/run/mongo-private'],secrets:['mongo_root_password','mongo_app_password','mongo_keyfile'],
        networks:['database'],mem_limit:'1g',pids_limit:256,
        healthcheck:health(['CMD','mongosh','--quiet','--norc','--file','/integration/mongo-health.js'],'120s'),
        stop_grace_period:'60s'
      },
      backend:{
        ...hardening,platform:'linux/amd64',
        build:{context:file('backend'),dockerfile:'Dockerfile.integration'},
        init:true,tmpfs:['/tmp:mode=1777,size=64m'],
        environment:{NODE_ENV:'production',NC_LOCAL_DEMO:'1',APP_URL:ORIGIN,CORS_ORIGIN:ORIGIN},
        secrets:['mongo_app_password','jwt_secret','totp_key'],networks:['database','application'],
        depends_on:{mongodb:{condition:'service_healthy'}},
        healthcheck:health(['CMD','node','scripts/integration/health.js'],'90s'),stop_grace_period:'35s'
      },
      web:{
        ...hardening,platform:'linux/amd64',
        // nginx master drops worker identity and owns its temporary directories.
        cap_add:['CHOWN','SETGID','SETUID'],
        build:{context:file('frontend'),dockerfile:'Dockerfile.integration'},
        ports:[{target:8443,published:'9445',host_ip:'127.0.0.2',protocol:'tcp'}],
        tmpfs:['/var/cache/nginx','/var/run','/tmp'],
        volumes:[bind(file('.runtime','local-demo','nginx.conf'),'/etc/nginx/nginx.conf')],
        secrets:['tls_certificate','tls_key'],networks:['application','ingress'],
        depends_on:{backend:{condition:'service_healthy'}},
        healthcheck:health(['CMD','wget','-q','--spider','http://127.0.0.1:8080/health'])
      }
    },
    // A published host port needs a non-internal network on the web container.
    // Only web joins ingress; its host binding remains strictly loopback.
    networks:{database:{internal:true},application:{internal:true},ingress:{internal:false}},
    volumes:{mongo_data:{},mongo_config:{}},secrets
  };
}
module.exports={ORIGIN,SECRET_NAMES,project,compose};
