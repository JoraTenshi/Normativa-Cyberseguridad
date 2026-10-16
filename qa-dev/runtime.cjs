'use strict';
// Runtime de pruebas nuevo: loopback, usuarios sintéticos, MFA real, sin SMTP.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
process.umask(0o077);
for(const k of Object.keys(process.env))if(/^SMTP_|^(MONGO|MONGODB)_(URI|URL)$/.test(k))delete process.env[k];
const origin='http://127.0.0.3:4296';process.env.CORS_ORIGIN=origin;
const {comprobar}=require('../backend/scripts/check-rat-mongo');
const mongoose=require('mongoose'),express=require('express'),request=require('supertest'),speakeasy=require('speakeasy');
const {createApp}=require('../backend/app'),{encryptTotpSecret}=require('../backend/utils/totpEncryption'),U=require('../backend/models/Usuario');
const {withMongo}=require('./mongo.cjs');
const save=(p,d)=>fs.writeFile(p,JSON.stringify(d,null,2),{mode:0o600});
const cookie=(r,name='cyberaudit_token')=>(r.headers['set-cookie']||[]).find(x=>x.startsWith(name+'=')&&!x.startsWith(name+'=;'))?.split(';')[0];
async function main(){
 const minutes=Number(process.argv[2]);assert.ok(Number.isInteger(minutes)&&minutes>=20&&minutes<=100,'Ventana explícita 20–100 min');const deadline=Date.now()+minutes*60000;
 const root=await fs.realpath(__dirname);assert.match(root,/\/normativacheck-dev\/dp-e1-20261016\.[A-Za-z0-9]+\/qa-dev$/);
 const build=await fs.realpath(path.join(root,'../frontend/build-e1'));assert.ok((await fs.stat(build+'/index.html')).isFile());
 const run=await fs.mkdtemp(root+'/execution-');let reason='startup_failed';
 await withMongo('/tmp/nc-org03-mongo.edcKZu/bin/mongod',false,async mongo=>{
  await comprobar({...mongo,prepararUI:async fixture=>{
   const identities={},password='DpE1-'+crypto.randomBytes(18).toString('hex')+'!';
   for(const [role,ids]of Object.entries(fixture.members)){
    const user=await U.findById(ids.usuarioId);assert.ok(user);const secret=speakeasy.generateSecret({length:20}).base32;
    user.password=password;user.twoFactorEnabled=true;user.twoFactorSecret=encryptTotpSecret(secret,user._id);await user.save();identities[role]={...ids,email:user.email,secret};
   }
   const api=createApp({rateLimits:false});assert.equal(api.locals.politicaSesiones,'persistente');const admin=identities.admin;
   let r=await request(api).post('/auth/login').set('Origin',origin).set('X-Requested-With','XMLHttpRequest').send({email:admin.email,password});assert.equal(r.status,200);assert.equal(r.body.data.requires2fa,true);
   r=await request(api).post('/auth/2fa/verify').set('Origin',origin).set('X-Requested-With','XMLHttpRequest').set('Cookie',cookie(r,'cyberaudit_2fa_pending')).send({token:speakeasy.totp({secret:admin.secret,encoding:'base32'})});assert.equal(r.status,200);const token=cookie(r);assert.ok(token);
   assert.equal((await request(api).get('/organizaciones/'+fixture.organizationId+'/normativa/registros-rat/'+fixture.ratResponsable.id).set('Cookie',token)).status,200);
   assert.equal((await request(api).post('/auth/logout').set('Origin',origin).set('X-Requested-With','XMLHttpRequest').set('Cookie',token).send({})).status,200);
   const app=express();
   app.use((req,res,next)=>{res.set({'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'});if(!['127.0.0.3:4296','127.0.0.1:4296'].includes(req.get('Host')))return res.sendStatus(403);if(Date.now()>=deadline)return res.sendStatus(503);next();});
   const manifest=JSON.parse(await fs.readFile(build+'/asset-manifest.json','utf8')),frontend={};
   for(const name of ['main.js','main.css','index.html']){const filename=manifest.files[name];frontend[name]={filename,sha256:crypto.createHash('sha256').update(await fs.readFile(build+filename)).digest('hex')};}
   const identity={developmentOnly:true,origin,execution:path.basename(run),frontend,contractSha256:crypto.createHash('sha256').update(await fs.readFile(path.join(root,'../backend/contracts/registroRAT.v1.json'))).digest('hex')};
   app.get('/qa-identity.json',(req,res)=>res.json(identity));app.use('/api',api);app.use('/api',(req,res)=>res.sendStatus(404));app.get(/\.map$/,(req,res)=>res.sendStatus(404));app.use(express.static(build));app.get('*',(req,res)=>res.sendFile(build+'/index.html'));
   const server=await new Promise((resolve,reject)=>{const s=app.listen(4296,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
   const ready={...identity,pid:process.pid,readyAt:new Date().toISOString(),expiresAt:new Date(deadline).toISOString(),fixture,build,scope:'RAT/RGPD32 technical browser QA; no production or legal certification'};
   await save(run+'/control.private.json',{...ready,password,identities,mongo});await save(run+'/ready.json',ready);
   console.log(JSON.stringify({event:'E1_READY',readyFile:run+'/ready.json',privateFile:run+'/control.private.json',...ready}));
   let timer,stop;const terminate=()=>{reason='SIGTERM';stop();},interrupt=()=>{reason='SIGINT';stop();};
   try{await new Promise(resolve=>{stop=resolve;process.once('SIGTERM',terminate);process.once('SIGINT',interrupt);timer=setTimeout(()=>{reason='deadline';resolve();},Math.max(1,deadline-Date.now()));});}
   finally{clearTimeout(timer);process.removeListener('SIGTERM',terminate);process.removeListener('SIGINT',interrupt);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await save(run+'/closed.json',{at:new Date().toISOString(),reason,dataRetained:true,mongoDirectory:mongo.dir,notBackupVerification:true});}
  }});
 });
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
