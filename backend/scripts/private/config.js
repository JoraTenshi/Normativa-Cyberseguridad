'use strict';
// Intended destination: backend/scripts/private/config.js. Separate from Kali.
const fs=require('node:fs');
function guard(ok,code){if(!ok)throw Object.assign(Error(code),{code});}
function loadConfig(read=n=>fs.readFileSync('/run/secrets/'+n,'utf8').trim(),env=process.env){
 const origin=env.NC_HTTPS_ORIGIN;
 guard(['https://10.77.77.1','https://10.77.77.1:8443','https://10.77.77.1:9443'].includes(origin),'PRIVATE_ORIGIN');
 guard(env.APP_URL===origin&&env.CORS_ORIGIN===origin,'ORIGIN_MISMATCH');
 const password=read('mongo_app_password'),jwt=read('jwt_secret'),totp=read('totp_key');
 for(const s of [password,jwt,totp])guard(typeof s==='string'&&/^[a-f0-9]{64}$/.test(s),'SECRET_FORMAT');
 guard(new Set([password,jwt,totp]).size===3,'SECRET_REUSE');
 guard(['disabled','smtp465','smtp587'].includes(env.NC_MAIL_MODE),'SMTP_MODE');
 let smtp=null;
 if(env.NC_MAIL_MODE!=='disabled'){
  let s;try{s=JSON.parse(read('smtp_config'));}catch{guard(false,'SMTP_FORMAT');}
  guard(s&&Object.keys(s).sort().join(',')==='from,host,password,port,username','SMTP_FORMAT');
  guard(typeof s.host==='string'&&s.host.length<=253&&/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/.test(s.host),'SMTP_HOST');
  // Explicit modes: implicit TLS on 465 or mandatory STARTTLS on 587.
  // Changing the secret alone must never silently change the transport mode.
  guard(s.port===(env.NC_MAIL_MODE==='smtp465'?465:587),'SMTP_TLS_REQUIRED');
  for(const k of ['username','password','from'])guard(typeof s[k]==='string'&&s[k].length>0&&s[k].length<=1000&&!/[\r\n\0]/.test(s[k]),'SMTP_FORMAT');
  guard(/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(s.from),'SMTP_FROM');smtp=s;
 }
 return{origin,jwt,totp,smtp,replica:'nc-private-rs',database:'nc_private',uri:'mongodb://nc_app:'+password+'@mongodb:27017/nc_private?authSource=nc_private&replicaSet=nc-private-rs&w=majority&retryWrites=true'};
}
module.exports={loadConfig};
