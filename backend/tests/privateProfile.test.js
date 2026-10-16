'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),p=require('../../infra/private/profile.cjs'),{loadConfig}=require('../scripts/private/config');
const profile={releaseRoot:'/srv/normativacheck/releases/candidate_qa4286',stateRoot:'/srv/normativacheck/state',port:9443,wireguardUnit:'wg-quick@wg0.service',smtpMode:'disabled'};
const env={NC_HTTPS_ORIGIN:'https://10.77.77.1:9443',APP_URL:'https://10.77.77.1:9443',CORS_ORIGIN:'https://10.77.77.1:9443',NC_MAIL_MODE:'disabled'};
const values={mongo_app_password:'a'.repeat(64),jwt_secret:'b'.repeat(64),totp_key:'c'.repeat(64)},read=n=>values[n];
const {nginx}=require('../../infra/private/nginx-template.cjs');
test('solo puertos privados previstos y un origen coherente',()=>{assert.equal(p.validate(profile).origin,env.APP_URL);assert.equal(p.validate({...profile,port:443}).origin,'https://10.77.77.1');assert.equal(p.validate({...profile,port:8443}).origin,'https://10.77.77.1:8443');for(const port of[80,5000,'9443','8443',8444,0])assert.throws(()=>p.validate({...profile,port}));});

test('8443 conserva IP WireGuard y alinea backend, CORS, APP_URL y Host Nginx',()=>{
 const target={...profile,port:8443},c=p.compose(target),e=c.services.backend.environment;
 assert.deepEqual(c.services.web.ports,[{target:8443,published:'8443',host_ip:'10.77.77.1',protocol:'tcp'}]);
 assert.equal(e.NC_HTTPS_ORIGIN,'https://10.77.77.1:8443');assert.equal(e.CORS_ORIGIN,e.NC_HTTPS_ORIGIN);assert.equal(e.APP_URL,e.NC_HTTPS_ORIGIN);
 assert.equal(loadConfig(read,e).origin,e.NC_HTTPS_ORIGIN);
 assert.ok(nginx(target).includes('$http_host != "10.77.77.1:8443"'));
 assert.deepEqual(c.services.mongodb,p.compose(profile).services.mongodb);
 assert.equal(c.services.backend.ports,undefined);
});

test('8443 no admite enlace publico ni origen parecido o CORS heredado',()=>{
 for(const ip of ['0.0.0.0','188.245.182.69','::'])assert.throws(()=>p.validate({...profile,port:8443,host_ip:ip}));
 for(const origin of ['https://0.0.0.0:8443','https://188.245.182.69:8443','http://10.77.77.1:8443','https://10.77.77.1:8443/','https://10.77.77.1:8443.evil.invalid'])assert.throws(()=>loadConfig(read,{...env,NC_HTTPS_ORIGIN:origin,APP_URL:origin,CORS_ORIGIN:origin}),/PRIVATE_ORIGIN/);
 assert.throws(()=>loadConfig(read,{...env,NC_HTTPS_ORIGIN:'https://10.77.77.1:8443',APP_URL:'https://10.77.77.1:8443'}),/ORIGIN_MISMATCH/);
});
test('rutas sin shell, traversal ni estado dentro de código',()=>{for(const releaseRoot of['/','/srv/x/../y','/srv/x;id','/srv/with space','/tmp/x','/home/root/x'])assert.throws(()=>p.validate({...profile,releaseRoot}));assert.throws(()=>p.validate({...profile,stateRoot:profile.releaseRoot+'/state'}));});
test('no acepta opciones externas ni unidad arbitraria',()=>{assert.throws(()=>p.validate({...profile,publicIP:'0.0.0.0'}));for(const wireguardUnit of['docker.service','wg-quick@wg0.service\nOther=x','wg-quick@wg0'])assert.throws(()=>p.validate({...profile,wireguardUnit}));});
test('Mongo y backend sin puertos, web solo WireGuard',()=>{const c=p.compose(profile);assert.ok(!c.services.mongodb.ports);assert.ok(!c.services.backend.ports);assert.equal(c.services.web.ports[0].host_ip,'10.77.77.1');assert.equal(c.networks.database.internal,true);assert.ok(!JSON.stringify(c).includes('/var/run/docker.sock'));});
test('no reinicia Docker por delante de WireGuard; supervisa systemd',()=>{const c=p.compose(profile);assert.ok(Object.values(c.services).every(s=>s.restart==='no'));const u=p.unit(profile);assert.match(u,/After=docker.service wg-quick@wg0.service/);assert.match(u,/BindsTo=wg-quick@wg0.service/);assert.match(u,/--no-build --pull never --abort-on-container-exit/);assert.ok(!u.includes('down'));});
test('secretos fuera del release, sin UID del host ni credenciales en environment',()=>{const c=p.compose(profile);assert.ok(Object.values(c.secrets).every(s=>s.file.startsWith(profile.stateRoot+'/')));assert.ok(!JSON.stringify(c).includes('1000'));assert.ok(!JSON.stringify(c.services.backend.environment).includes('PASSWORD'));});
test('SMTP omitido por defecto y secreto explícito si está elegido',()=>{assert.ok(!p.compose(profile).secrets.smtp_config);const c=p.compose({...profile,smtpMode:'smtp465'});assert.ok(c.secrets.smtp_config);assert.ok(c.services.backend.secrets.includes('smtp_config'));});
test('carga config sin leer SMTP ni alterar env en modo deshabilitado',()=>{const e={...env},names=[];const c=loadConfig(n=>{names.push(n);return read(n);},e);assert.equal(c.smtp,null);assert.equal(c.replica,'nc-private-rs');assert.match(c.uri,/\/nc_private\?/);assert.deepEqual(names,Object.keys(values));assert.deepEqual(e,env);});
test('rechaza HTTP, localhost, IP pública y CORS distinto',()=>{for(const origin of['http://10.77.77.1:9443','https://188.245.182.69','https://127.0.0.2:9443','https://10.77.77.1:443','https://10.77.77.1:9443/'])assert.throws(()=>loadConfig(read,{...env,NC_HTTPS_ORIGIN:origin,APP_URL:origin,CORS_ORIGIN:origin}));assert.throws(()=>loadConfig(read,{...env,CORS_ORIGIN:'*'}));});
test('rechaza secretos reutilizados o formato erróneo',()=>{assert.throws(()=>loadConfig(()=>values.jwt_secret,env));assert.throws(()=>loadConfig(n=>n==='totp_key'?'bad':read(n),env));});
test('SMTP465 válido, sin degradación a conexión sin TLS',()=>{const s={host:'smtp.example.invalid',port:465,username:'fixture',password:'only-a-test',from:'qa@example.invalid'};const load=s=>loadConfig(n=>n==='smtp_config'?JSON.stringify(s):read(n),{...env,NC_MAIL_MODE:'smtp465'});assert.equal(load(s).smtp.port,465);for(const port of[25,587,'465'])assert.throws(()=>load({...s,port}));assert.throws(()=>load({...s,host:'127.0.0.1'}));assert.throws(()=>load({...s,from:'qa@example.invalid\nBcc: x'}));});
test('Nginx alinea Host/HTTPS, deniega mapas y separa API del fallback',()=>{const n=nginx(profile);assert.ok(n.includes('$http_host != "10.77.77.1:9443"'));assert.ok(n.includes('proxy_set_header X-Forwarded-Proto https'));assert.ok(n.includes('location = /api { return 404; }'));assert.ok(n.includes('location ~* \\.map$ { return 404; }'));assert.ok(n.includes('proxy_next_upstream off'));assert.ok(!n.includes('$request_uri'));assert.ok(!n.includes('127.0.0.2'));});
test('443 no inserta puerto implícito en Host',()=>{assert.ok(nginx({...profile,port:443}).includes('$http_host != "10.77.77.1"'));});
test('sin seed, cuenta demo, reset ni socket en ninguna configuración generada',()=>{const text=JSON.stringify(p.compose(profile))+p.unit(profile)+nginx(profile);for(const term of ['create-test-workspace','mongorestore','down -v','mongo_data:/var/run','legado_pruebas'])assert.ok(!text.includes(term));});
