'use strict';
// QA únicamente. No acepta URI externa, no lee .env y no crea usuarios reales.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),readline=require('node:readline');
process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');process.env.TOTP_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');
const origin='http://localhost:4288';
// El origen HTTP existe solo en este loopback sintético. No se alteran las
// cookies Secure ni el requisito HTTPS de los enlaces de correo del producto.
// La URL de verificación de la fixture se construye aparte; no se envía correo.
process.env.APP_URL='https://localhost';process.env.CORS_ORIGIN=origin;
for(const k of ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_FROM'])delete process.env[k];
const mongoose=require('mongoose'),express=require('express');
const {createApp}=require('../app'),{instancia}=require('./run-gestion-unidades-mongo');
const Usuario=require('../models/Usuario'),Solicitud=require('../models/SolicitudOrganizacion'),Organizacion=require('../models/Organizacion'),Membresia=require('../models/Membresia');
const {encryptTotpSecret}=require('../utils/totpEncryption'),{designar}=require('../services/designacionGestorAltas');
const password='Prueba-Altas-4288!'; // Solo cuentas temporales example.invalid, conocida en QA.
async function fixture(){
 if(!/^nc_org03_[a-f0-9]{24}$/.test(mongoose.connection.name))throw Error('BD_QA_REQUERIDA');
 const mfaFixture=require('speakeasy').generateSecret({length:20}).base32,tokenFixture=crypto.randomBytes(32).toString('hex');
 for(const [nombre,verificado] of [['solicitante',true],['rechazo',true],['gestor',true],['sin-verificar',false]]){
  const user=new Usuario({nombre:nombre+' FICTICIO QA',email:nombre+'@example.invalid',password,emailVerifiedAt:verificado?new Date():null});
  if(nombre==='gestor'){user.twoFactorEnabled=true;user.twoFactorSecret=encryptTotpSecret(mfaFixture,user._id);}
  if(!verificado){user.emailVerificationTokenHash=crypto.createHash('sha256').update(tokenFixture).digest('hex');user.emailVerificationExpiresAt=new Date(Date.now()+45*60000);}
  await user.save();
  if(nombre==='gestor')await designar({usuarioId:String(user._id),emailConfirmado:user.email,referenciaAutorizacion:'Permiso sintético exclusivo de QA efímera, no concesión a cuenta real.'});
 }
 for(const m of [Solicitud,Organizacion,Membresia])if(await m.countDocuments())throw Error('INICIO_NO_VACIO');
 return{cuentas:['solicitante@example.invalid','rechazo@example.invalid','gestor@example.invalid','sin-verificar@example.invalid'],password,mfaFixture,
   verificacionFixture:origin+'/verify-email#token='+tokenFixture,advertencia:'Credenciales y enlace EXCLUSIVOS de QA efímera. No correo enviado ni cuentas reales.'};
}
async function main(){
 if(process.argv.slice(2).some(x=>x!=='--smoke')||process.argv.length>3)throw Error('ARGUMENTOS_QA');
 const source=await fs.realpath(path.join(__dirname,'..'));
 if(!/^\/tmp\/nc-altas-20261014\.[A-Za-z0-9]+\/backend$/.test(source))throw Error('SOLO_STAGING');
 const build=await fs.realpath(process.env.NC_ALTAS_FRONT_BUILD||'');
 if(!/^\/tmp\/norm-altas-front-build\.[A-Za-z0-9]+$/.test(build))throw Error('BUILD_QA_NO_PERMITIDO');
 await fs.access(path.join(build,'index.html'));
 const bin=await fs.realpath(process.env.MONGOD_TEST_BINARY||'');if(!path.isAbsolute(bin)||!(await fs.stat(bin)).isFile())throw Error('BINARIO_MONGO');
 await instancia(bin,false,async({uri,nombreBD})=>{
  const u=new URL(uri);if(u.hostname!=='127.0.0.1'||u.port==='27017'||!/^nc_org03_[a-f0-9]{24}$/.test(nombreBD))throw Error('URI_EXTERNA');
  let server,lines,timer,finish;
  try{
   await mongoose.connect(uri,{dbName:nombreBD,serverSelectionTimeoutMS:5000});for(const m of Object.values(mongoose.models))await m.init();
   const info=await fixture(),expiresAt=new Date(Date.now()+45*60000),app=express();
   app.use((req,res,next)=>{res.set('Cache-Control','no-store');if(!['localhost:4288','127.0.0.1:4288'].includes(req.get('Host')))return res.status(403).json({ok:false,error:'Solo loopback QA'});
     if(Date.now()>=expiresAt.getTime())return res.status(503).json({ok:false,error:'QA caducada'});next();});
   app.use('/api',createApp({rateLimits:false}));app.use('/api',(req,res)=>res.status(404).json({ok:false,error:'Ruta API no disponible'}));
   app.use(express.static(build));app.get('*',(req,res)=>res.sendFile(path.join(build,'index.html')));
   server=await new Promise((resolve,reject)=>{const s=app.listen(4288,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
   if(process.argv.includes('--smoke')){
    for(const ruta of ['/api/me/solicitudes-organizacion','/api/plataforma/solicitudes-organizacion'])if((await fetch(origin+ruta)).status!==401)throw Error('ANONIMO_NO_RECHAZADO');
    if((await fetch(origin+'/api/no-existe')).status!==404)throw Error('FALLBACK_API');
    if((await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:'https://ajeno.invalid','Content-Type':'application/json'},body:'{}'})).status!==403)throw Error('ORIGEN_AJENO');
    console.log('ALTAS_QA_SMOKE_OK vacío, sin organizaciones/membresías, API protegida, no navegador');return['smoke'];
   }
   console.log('ALTAS_QA_READY '+JSON.stringify({origin,url:origin+'/espacio-de-trabajo',pid:process.pid,expiresAt,build,source,...info}));
   await new Promise(resolve=>{finish=resolve;timer=setTimeout(resolve,45*60000);lines=readline.createInterface({input:process.stdin});lines.on('line',s=>{if(s.trim()==='stop')resolve();});process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
   return['QA navegador cerrada'];
  }finally{clearTimeout(timer);lines?.close();if(finish){process.removeListener('SIGINT',finish);process.removeListener('SIGTERM',finish);}if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await mongoose.disconnect();}
 });
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={main};
