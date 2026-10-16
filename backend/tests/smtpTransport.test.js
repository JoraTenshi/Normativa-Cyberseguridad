'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {opcionesSmtp,errorCorreoSeguro}=require('../utils/smtpTransport');
const {loadConfig}=require('../scripts/private/config');
const smtp={host:'smtp.gmail.com',port:587,username:'fixture@example.invalid',password:'synthetic-only',from:'fixture@example.invalid'};
const env={NC_HTTPS_ORIGIN:'https://10.77.77.1:8443',APP_URL:'https://10.77.77.1:8443',CORS_ORIGIN:'https://10.77.77.1:8443',NC_MAIL_MODE:'smtp587'};
const secrets={mongo_app_password:'a'.repeat(64),jwt_secret:'b'.repeat(64),totp_key:'c'.repeat(64)};
const load=(data=smtp,mode='smtp587')=>loadConfig(n=>n==='smtp_config'?JSON.stringify(data):secrets[n],{...env,NC_MAIL_MODE:mode});

test('smtp587 loads unchanged five-key secret and enforces exact numeric port',()=>{
 assert.deepEqual(load().smtp,smtp);
 for(const port of[25,465,'587',0,null])assert.throws(()=>load({...smtp,port}),/SMTP_TLS_REQUIRED/);
 for(const extra of[{requireTLS:false},{rejectUnauthorized:false},{tls:{}},{debug:true}])assert.throws(()=>load({...smtp,...extra}),/SMTP_FORMAT/);
});
test('smtp465 stays implicit TLS and never accepts 587 secret',()=>{
 assert.equal(load({...smtp,port:465},'smtp465').smtp.port,465);
 assert.throws(()=>load(smtp,'smtp465'),/SMTP_TLS_REQUIRED/);
 const o=opcionesSmtp({...smtp,port:465});assert.equal(o.secure,true);assert.equal(o.tls.rejectUnauthorized,true);
});
test('disabled does not even read smtp secret; unknown mode rejects',()=>{
 const read=[];assert.equal(loadConfig(n=>{read.push(n);return secrets[n];},{...env,NC_MAIL_MODE:'disabled'}).smtp,null);
 assert.ok(!read.includes('smtp_config'));assert.throws(()=>load(smtp,'auto'),/SMTP_MODE/);
});
test('smtp587 renderer changes only mail mode and secret; web, Mongo and origins remain identical',()=>{
 const p=require('../../infra/private/profile.cjs'),base={releaseRoot:'/srv/normativacheck/releases/r3',stateRoot:'/srv/normativacheck/state',port:8443,wireguardUnit:'wg-quick@wg0.service',smtpMode:'disabled'};
 const old=p.compose(base),next=p.compose({...base,smtpMode:'smtp587'});
 assert.equal(next.services.backend.environment.NC_MAIL_MODE,'smtp587');assert.equal(next.secrets.smtp_config.file,base.stateRoot+'/secrets/smtp_config');
 assert.deepEqual(next.services.web,old.services.web);assert.deepEqual(next.services.mongodb,old.services.mongodb);
 const normalized=structuredClone(next);normalized.services.backend.environment.NC_MAIL_MODE='disabled';normalized.services.backend.secrets=normalized.services.backend.secrets.filter(n=>n!=='smtp_config');delete normalized.secrets.smtp_config;
 assert.deepEqual(normalized,old);assert.equal(p.unit({...base,smtpMode:'smtp587'}),p.unit(base));
});
test('587 mandates STARTTLS, verified hostname, TLS1.2+, bounded timeouts and no logging',()=>{
 const o=opcionesSmtp(smtp);assert.equal(o.secure,false);assert.equal(o.requireTLS,true);assert.equal(o.ignoreTLS,false);assert.equal(o.opportunisticTLS,false);
 assert.deepEqual(o.tls,{servername:'smtp.gmail.com',rejectUnauthorized:true,minVersion:'TLSv1.2'});
 for(const key of['connectionTimeout','greetingTimeout','socketTimeout','dnsTimeout'])assert.ok(o[key]>0&&o[key]<=20000);
 for(const key of['logger','debug','transactionLog'])assert.equal(o[key],false);
 assert.equal(o.disableFileAccess,true);assert.equal(o.disableUrlAccess,true);
});
test('unsupported transport or injected host rejects without echoing configuration',()=>{
 for(const data of[{...smtp,port:25},{...smtp,host:'smtp.gmail.com\nSECRET'},{...smtp,username:''}])assert.throws(()=>opcionesSmtp(data),/^Error: SMTP_CONFIG_INVALID$/);
});
test('sanitized errors keep category only, without SMTP response or nested secret',()=>{
 for(const code of['EAUTH','ETLS','ESOCKET','ETIMEDOUT','EENVELOPE','UNKNOWN','__proto__']){
  const e=errorCorreoSeguro({code,message:'SECRET https://host/verify#token=SENSITIVE',response:'AUTH password',cause:{secret:'SENSITIVE'}});
  assert.match(e.message,/^SMTP_[A-Z_]+$/);assert.equal(e.code,e.message);assert.equal(e.cause,undefined);assert.equal(e.response,undefined);
  assert.doesNotMatch(JSON.stringify(e)+e.stack,/SECRET|SENSITIVE|https:|password/);
 }
});
test('mailer sanitizes rejected delivery and disabled ignores stale env credentials',async t=>{
 const nodemailer=require('nodemailer'),p=require.resolve('../utils/mailer');
 const keys=['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_FROM','NC_MAIL_MODE'];const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 t.after(()=>{for(const [k,v]of Object.entries(before))if(v===undefined)delete process.env[k];else process.env[k]=v;delete require.cache[p];});
 Object.assign(process.env,{SMTP_HOST:smtp.host,SMTP_PORT:'587',SMTP_USER:smtp.username,SMTP_PASS:smtp.password,SMTP_FROM:smtp.from,NC_MAIL_MODE:'smtp587'});
 const calls=[];t.mock.method(nodemailer,'createTransport',options=>{calls.push(options);return{sendMail:async()=>{throw Object.assign(new Error('token=SECRET password=synthetic-only'),{code:'EAUTH',response:'SECRET'});}};});
 delete require.cache[p];const mailer=require('../utils/mailer');assert.equal(mailer.smtpConfigurado,true);
 await assert.rejects(mailer.enviarEmail({to:'qa@example.invalid',text:'x'}),e=>e.message==='SMTP_AUTH_FAILED'&&!e.response&&!e.cause);
 process.env.NC_MAIL_MODE='disabled';delete require.cache[p];const disabled=require('../utils/mailer');
 assert.equal(disabled.smtpConfigurado,false);assert.deepEqual(await disabled.enviarEmail({to:'qa@example.invalid'}),{enviado:false,simulado:true});assert.equal(calls.length,1);
});
