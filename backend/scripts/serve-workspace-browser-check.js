'use strict';
// Browser QA only: own temporary Mongo; no .env, external DB or demo login route.
const path=require('node:path'),crypto=require('node:crypto'),readline=require('node:readline');
const {instancia}=require('./run-gestion-unidades-mongo');
process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');
process.env.APP_URL='https://localhost';
process.env.CORS_ORIGIN='http://localhost:4280';
const mongoose=require('mongoose'),express=require('express');
const {createApp}=require('../app');
const Usuario=require('../models/Usuario'),Organizacion=require('../models/Organizacion'),Membresia=require('../models/Membresia'),Sesion=require('../models/SesionUsuario');
async function serve({uri,nombreBD}){
 const u=new URL(uri);
 if(u.hostname!=='127.0.0.1'||u.port==='27017'||!/^nc_org03_[a-f0-9]{24}$/.test(nombreBD))throw Error('Only runner-owned database');
 let server,lines,timer;
 try{
  await mongoose.connect(uri,{dbName:nombreBD});
  for(const model of Object.values(mongoose.models))await model.init();
  const company=await Organizacion.create({razon_social:'Empresa sintética de integración',pais:'ES',identificador_tipo:'NIF',identificador_valor:'B99999999',estado:'activa'});
  for(const [name,rol] of [['admin','administrador'],['lectura','consulta']]){
   const user=await Usuario.create({nombre:'Prueba '+name,email:name+'@example.invalid',password:'Prueba-Workspace-927!',emailVerifiedAt:new Date()});
   await Membresia.create({usuario:user._id,organizacion:company._id,rol,estado:'activa'});
  }
  const app=express();let failedLogout=false;
  app.use('/api/auth/logout',(req,res,next)=>failedLogout?res.status(503).json({ok:false,error:'Fallo sintético de cierre'}):next());
  app.use('/api',createApp({rateLimits:false})); // Only this fixture disables limits, not app default.
  app.use(express.static(path.resolve(__dirname,'../../frontend/build')));
  app.get('*',(req,res)=>res.sendFile(path.resolve(__dirname,'../../frontend/build/index.html')));
  server=await new Promise((resolve,reject)=>{const s=app.listen(4280,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
  console.log('QA READY http://localhost:4280 | ONLY synthetic accounts admin/lectura@example.invalid | password Prueba-Workspace-927!');
  console.log('stdin commands: expire, fail-logout, restore-logout, stop. Hard stop after 45 minutes.');
  await new Promise(resolve=>{
   timer=setTimeout(resolve,45*60000);lines=readline.createInterface({input:process.stdin});
   lines.on('line',async line=>{try{
    if(line.trim()==='expire'){await Sesion.collection.updateMany({},{$set:{expiraEn:new Date(Date.now()-1000)}});console.log('QA sessions expired');}
    if(line.trim()==='fail-logout'){failedLogout=true;console.log('QA logout failure enabled');}
    if(line.trim()==='restore-logout'){failedLogout=false;console.log('QA logout restored');}
    if(line.trim()==='stop')resolve();
   }catch(e){console.error(e.message);}});
   process.once('SIGTERM',resolve);process.once('SIGINT',resolve);
  });
  return ['browser QA fixture'];
 }finally{clearTimeout(timer);lines?.close();if(server)await new Promise(resolve=>server.close(resolve));await mongoose.disconnect();}
}
instancia(process.env.MONGOD_TEST_BINARY,false,serve).catch(e=>{console.error(e.stack);process.exitCode=1;});
