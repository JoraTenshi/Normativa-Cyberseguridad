'use strict';
const crypto = require('node:crypto');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';
process.env.CORS_ORIGIN = 'https://localhost';
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const { createApp } = require('../app');
const Usuario = require('../models/Usuario');
const Sesion = require('../models/SesionUsuario');
const Revoked = require('../models/RevokedToken');
const Organizacion = require('../models/Organizacion'), Membresia = require('../models/Membresia');
const acceso = require('../services/accesoSesion');
const { encryptTotpSecret } = require('../utils/totpEncryption');
const MAX=8*3600000, IDLE=30*60000;
async function comprobar({uri,nombreBD}) {
  const url=new URL(uri);
  if(url.hostname!=='127.0.0.1'||!url.port||url.port==='27017'||url.username||url.password||
    !/^nc_org03_[a-f0-9]{24}$/.test(nombreBD))throw Error('Solo base temporal del runner');
  const resultados=[], caso=async(n,fn)=>{await fn();resultados.push(n);console.log('OK '+n);};
  let numero=0;
  const clave='Solo-Prueba-91a';
  const cuenta=async(datos={})=>Usuario.create({
    nombre:'Cuenta sintética',email:'sesion'+(++numero)+'@example.invalid',
    password:clave,emailVerifiedAt:new Date(),...datos
  });
  const app=createApp({rateLimits:false}); // Default productivo: SIN legado_pruebas.
  const call=(method,path,cookie)=> {
    const req=request(app)[method](path).set('X-Requested-With','XMLHttpRequest').set('Origin','https://localhost');
    return cookie?req.set('Cookie',cookie):req;
  };
  const login=(u,extra={})=>call('post','/auth/login').send({email:u.email,password:clave,...extra});
  const cookie=(r,n='cyberaudit_token')=>(r.headers['set-cookie']??[]).find(c=>c.startsWith(n+'=')&&!c.startsWith(n+'=;'))?.split(';')[0];
  const header=(r,n='cyberaudit_token')=>(r.headers['set-cookie']??[]).find(c=>c.startsWith(n+'=')&&!c.startsWith(n+'=;'));
  const payload=c=>jwt.verify(c.split('=')[1],process.env.JWT_SECRET,{algorithms:['HS256']});
  const filtro=c=>({identificadorHash:crypto.createHash('sha256').update(payload(c).jti).digest('hex')});
  const me=c=>call('get','/me',c);
  const activity=c=>call('post','/auth/session/actividad',c).send({});
  const estado=c=>call('get','/auth/session',c);
  const cerrar=c=>call('post','/auth/logout',c).send({});
  const prepararMfa=async u=>{
    const secret=speakeasy.generateSecret({length:20}).base32;
    await Usuario.updateOne({_id:u._id},{$set:{twoFactorEnabled:true,twoFactorSecret:encryptTotpSecret(secret,u._id)}});
    return secret;
  };
  const codigo=secret=>speakeasy.totp({secret,encoding:'base32'});
  const verify=(pending,token)=>call('post','/auth/2fa/verify',pending).send({token});
  try {
    await mongoose.connect(uri,{dbName:nombreBD,serverSelectionTimeoutMS:2500});
    for(const modelo of Object.values(mongoose.models))await modelo.init();
    await caso('default productivo rechaza tokens legacy, incluso firmados y con cabecera de compatibilidad',async()=>{
      const u=await cuenta();
      const token=jwt.sign({id:String(u._id),jti:crypto.randomBytes(32).toString('hex'),sessionVersion:0},process.env.JWT_SECRET,{expiresIn:'1d'});
      assert.equal((await me('cyberaudit_token='+token).set('X-Politica-Sesiones','legado_pruebas')).status,401);
      assert.equal((await request(app).get('/demo/info')).status,404);
      assert.equal((await call('post','/demo/login').send({cuenta:'admin'})).status,404);
    });
    await caso('login real crea sesión sin devolver token y cookie de sesión protegida',async()=>{
      const u=await cuenta(),r=await login(u),c=cookie(r);
      assert.equal(r.status,200,JSON.stringify(r.body));assert.ok(c);
      assert.match(header(r),/HttpOnly/);assert.match(header(r),/Secure/);assert.match(header(r),/SameSite=Strict/);
      assert.doesNotMatch(header(r),/Max-Age|Expires/);
      assert.equal(payload(c).tipo,'sesion_persistente_v1');
      assert.equal(payload(c).exp-payload(c).iat,8*3600);
      assert.equal(JSON.stringify(r.body).includes(payload(c).jti),false);
      assert.equal(await Sesion.countDocuments(filtro(c)),1);
      assert.equal((await me(c)).status,200);
    });
    await caso('mantener sesión persiste cookie sin ampliar ocho horas; booleanos y campos estrictos',async()=>{
      const u=await cuenta(),r=await login(u,{mantenerSesion:true});
      assert.equal(r.status,200);assert.match(header(r),/Max-Age=28[0-9]{3}/);
      assert.equal(r.body.data.sesion.mantenerSesion,true);
      for(const extra of [{mantenerSesion:'true'},{ahora:new Date().toISOString()},{rol:'admin'}])
        assert.equal((await login(u,extra)).status,400);
    });
    await caso('contraseña incorrecta y correo sin confirmar no crean sesiones',async()=>{
      const u=await cuenta(),sin=await cuenta({emailVerifiedAt:null}),antes=await Sesion.countDocuments();
      assert.equal((await login(u,{password:'Incorrecta99'})).status,401);
      assert.equal((await login(sin)).status,403);
      assert.equal(await Sesion.countDocuments(),antes);
    });
    await caso('GET me y estado no renuevan ni filtran identificadores',async()=>{
      const u=await cuenta(),c=cookie(await login(u)),antes=await Sesion.collection.findOne(filtro(c));
      for(const consulta of [me(c),estado(c)]) {
        const r=await consulta;assert.equal(r.status,200);assert.match(r.headers['cache-control'],/no-store/);
        assert.equal(JSON.stringify(r.body).includes(payload(c).jti),false);
      }
      assert.deepEqual(await Sesion.collection.findOne(filtro(c)),antes);
    });
    await caso('actividad explícita usa fecha de servidor, no body, y exige protección CSRF',async()=>{
      const u=await cuenta(),c=cookie(await login(u));
      const antes=await Sesion.collection.findOne(filtro(c));
      assert.equal((await activity(c)).status,200);
      const despues=await Sesion.collection.findOne(filtro(c));
      assert.ok(despues.ultimaActividadEn>=antes.ultimaActividadEn);
      assert.deepEqual(despues.expiraEn,antes.expiraEn);
      assert.equal((await call('post','/auth/session/actividad',c).send({ahora:new Date()})).status,400);
      assert.equal((await request(app).post('/auth/session/actividad').set('Cookie',c).send({})).status,403);
      assert.equal((await activity(c).set('Origin','https://ajeno.invalid')).status,403);
    });
    await caso('caducidad por inactividad y absoluta rechaza me y actividad por HTTP',async()=>{
      for(const absoluta of [false,true]) {
        const u=await cuenta(),c=cookie(await login(u));
        const inicio=new Date(Date.now()-(absoluta?MAX+1000:IDLE+1000));
        await Sesion.collection.updateOne(filtro(c),{$set:{autenticadaEn:inicio,
          ultimaActividadEn:absoluta?new Date(inicio.getTime()+MAX-1):inicio,
          expiraEn:new Date(inicio.getTime()+MAX)}});
        assert.equal((await me(c)).status,401);assert.equal((await activity(c)).status,401);
      }
    });
    await caso('logout individual, repetido o caducado, invalida copia del token sin cerrar otro dispositivo',async()=>{
      const u=await cuenta(),c=cookie(await login(u)),otra=cookie(await login(u));
      assert.equal((await cerrar(c)).status,200);
      assert.equal((await cerrar(c)).status,200);
      assert.equal((await me(c)).status,401);assert.equal((await me(otra)).status,200);
      assert.ok((await Sesion.collection.findOne(filtro(c))).revocadaEn);
      const p=payload(otra),viejo=jwt.sign({...p,exp:Math.floor(Date.now()/1000)-1,iat:Math.floor(Date.now()/1000)-100},process.env.JWT_SECRET);
      assert.equal((await cerrar('cyberaudit_token='+viejo)).status,200);
      assert.equal((await me(otra)).status,401);
    });
    await caso('reset real invalida todas las sesiones y no migra su versión',async()=>{
      const u=await cuenta(),a=cookie(await login(u)),b=cookie(await login(u)),token=crypto.randomBytes(32).toString('hex');
      await Usuario.updateOne({_id:u._id},{$set:{resetPasswordToken:crypto.createHash('sha256').update(token).digest('hex'),
        resetPasswordExpires:new Date(Date.now()+60000)}});
      const r=await call('post','/auth/reset-password').send({token,password:'Cambio-Posterior-22a'});
      assert.equal(r.status,200);
      assert.equal((await me(a)).status,401);assert.equal((await me(b)).status,401);
      const nuevo=await login(u,{password:'Cambio-Posterior-22a'});assert.equal(nuevo.status,200);
      assert.equal(payload(cookie(nuevo)).sessionVersion,1);
    });
    await caso('reset concurrente tras verificar password no emite sesión válida con la clave anterior',async()=>{
      const u=await cuenta(),original=Usuario.prototype.verificarPassword;
      Usuario.prototype.verificarPassword=async function(texto){
        const valid=await original.call(this,texto);
        if(String(this._id)===String(u._id))await Usuario.updateOne({_id:u._id},{$inc:{sessionVersion:1}});
        return valid;
      };
      try {const r=await login(u);assert.equal(r.status,401);assert.equal(cookie(r),undefined);}
      finally{Usuario.prototype.verificarPassword=original;}
      assert.ok(await Sesion.countDocuments({usuario:u._id,revocadaEn:{$type:'date'}}));
    });
    await caso('reset después de emitir token no permite reutilizarlo en la siguiente petición',async()=>{
      const u=await cuenta(),original=acceso.iniciar;
      acceso.iniciar=async(...args)=>{
        const resultado=await original(...args);
        await Usuario.updateOne({_id:u._id},{$inc:{sessionVersion:1}});
        return resultado;
      };
      try{const r=await login(u);assert.equal(r.status,200);assert.equal((await me(cookie(r))).status,401);}
      finally{acceso.iniciar=original;}
    });
    await caso('MFA: contraseña sola no crea sesión; desafío pendiente no da acceso',async()=>{
      const u=await cuenta(),secret=await prepararMfa(u),antes=await Sesion.countDocuments();
      const r=await login(u,{mantenerSesion:true}),pending=cookie(r,'cyberaudit_2fa_pending');
      assert.equal(r.body.data.requires2fa,true);assert.equal(cookie(r),undefined);
      assert.equal(await Sesion.countDocuments(),antes);
      assert.equal((await me('cyberaudit_token='+pending.split('=')[1])).status,401);
      assert.equal((await verify(pending,'no-valido')).status,401);
      const v=await verify(pending,codigo(secret));assert.equal(v.status,200,JSON.stringify(v.body));
      assert.match(header(v),/Max-Age=/);assert.equal((await me(cookie(v))).status,200);
      assert.equal((await verify(pending,codigo(secret))).status,401);
    });
    await caso('dos verificaciones MFA simultáneas consumen un solo desafío',async()=>{
      const u=await cuenta(),secret=await prepararMfa(u);
      const pending=cookie(await login(u),'cyberaudit_2fa_pending'),token=codigo(secret);
      const rs=await Promise.all([verify(pending,token),verify(pending,token)]);
      assert.deepEqual(rs.map(r=>r.status).sort(),[200,401]);
      assert.equal(await Sesion.countDocuments({usuario:u._id}),1);
    });
    await caso('logout cancela también el desafío MFA pendiente',async()=>{
      const u=await cuenta(),secret=await prepararMfa(u);
      const pending=cookie(await login(u),'cyberaudit_2fa_pending');
      assert.equal((await cerrar(pending)).status,200);
      assert.equal((await verify(pending,codigo(secret))).status,401);
    });
    await caso('MFA no permite cambiar mantenerSesion después de verificar contraseña',async()=>{
      const u=await cuenta(),secret=await prepararMfa(u),pending=cookie(await login(u),'cyberaudit_2fa_pending');
      const r=await call('post','/auth/2fa/verify',pending).send({token:codigo(secret),mantenerSesion:true});
      assert.equal(r.status,400);
      const v=await verify(pending,codigo(secret));assert.equal(v.status,200);assert.doesNotMatch(header(v),/Max-Age|Expires/);
    });
    await caso('cambio de versión entre contraseña y MFA invalida el desafío',async()=>{
      const u=await cuenta(),secret=await prepararMfa(u),pending=cookie(await login(u),'cyberaudit_2fa_pending');
      await Usuario.updateOne({_id:u._id},{$inc:{sessionVersion:1}});
      assert.equal((await verify(pending,codigo(secret))).status,401);
    });
    await caso('activar y desactivar MFA revoca versiones previas y exige nueva identificación',async()=>{
      const u=await cuenta(),c=cookie(await login(u));
      const setup=await call('post','/me/2fa/setup',c).send({});
      assert.equal(setup.status,200);
      const secret=setup.body.data.secret;
      const enable=await call('post','/me/2fa/enable',c).send({token:codigo(secret)});
      assert.equal(enable.status,200);assert.equal(enable.body.requiereReautenticacion,true);
      assert.equal((await me(c)).status,401);
      const pending=cookie(await login(u),'cyberaudit_2fa_pending'),v=await verify(pending,codigo(secret)),nuevo=cookie(v);
      const disable=await call('post','/me/2fa/disable',nuevo).send({token:codigo(secret)});
      assert.equal(disable.status,200);assert.equal((await me(nuevo)).status,401);
      assert.equal((await login(u)).status,200);
    });
    await caso('sesión real mantiene aislamiento de organización y no crea permisos por iniciar sesión',async()=>{
      const u=await cuenta(),ajeno=await cuenta(),c=cookie(await login(u));
      const a=await Organizacion.create({razon_social:'Empresa ficticia',pais:'ES',identificador_tipo:'NIF',identificador_valor:'B00000001',estado:'activa'});
      const b=await Organizacion.create({razon_social:'Ajena ficticia',pais:'ES',identificador_tipo:'NIF',identificador_valor:'B00000002',estado:'activa'});
      await Membresia.create({usuario:u._id,organizacion:a._id,rol:'administrador',estado:'activa'});
      await Membresia.create({usuario:ajeno._id,organizacion:b._id,rol:'administrador',estado:'activa'});
      assert.equal((await call('get','/organizaciones/'+a._id+'/actividad',c)).status,200);
      assert.equal((await call('get','/organizaciones/'+b._id+'/actividad',c)).status,403);
    });

    await caso('estado de sesión publica identidad actual mínima también al registrar actividad',async()=>{
      const u=await cuenta(),c=cookie(await login(u));
      await Usuario.updateOne({_id:u._id},{$set:{nombre:'Nombre actualizado'}});
      for(const r of [await estado(c),await activity(c)]) {
        assert.equal(r.status,200);assert.equal(r.body.data.usuario.id,String(u._id));
        assert.equal(r.body.data.usuario.nombre,'Nombre actualizado');
        assert.deepEqual(Object.keys(r.body.data.usuario).sort(),['createdAt','email','id','nombre','twoFactorEnabled'].sort());
      }
    });
    await caso('selector empresarial solo lista membresías activas y empresas activas de esta cuenta',async()=>{
      const u=await cuenta({rol:'admin'}),other=await cuenta(),c=cookie(await login(u));
      for(let i=0;i<5;i++){
        const company=await Organizacion.create({razon_social:'Selector '+i,pais:'ES',identificador_tipo:'NIF',identificador_valor:'B0000010'+i,estado:i===3?'suspendida':'activa'});
        await Membresia.create({usuario:i===4?other._id:u._id,organizacion:company._id,rol:'consulta',estado:['activa','pendiente','revocada','activa','activa'][i]});
      }
      const r=await call('get','/me/organizaciones',c);assert.equal(r.status,200);
      assert.equal(r.body.data.organizaciones.length,1);assert.equal(r.body.data.organizaciones[0].nombre,'Selector 0');
      assert.deepEqual(Object.keys(r.body.data.organizaciones[0]).sort(),['id','nombre','rol']);
      assert.equal((await call('get','/me/organizaciones?usuario='+other._id,c)).status,400);
      assert.equal((await call('get','/me/organizaciones?limite=999',c)).status,400);
      assert.equal((await call('get','/me/organizaciones?despues[$ne]=x',c)).status,400);
    });
    await caso('selector paginado relee una revocación sin confiar en el rol global',async()=>{
      const u=await cuenta(),c=cookie(await login(u));
      for(let i=0;i<2;i++){
        const company=await Organizacion.create({razon_social:'Paginada '+i,pais:'ES',identificador_tipo:'NIF',identificador_valor:'B0000020'+i,estado:'activa'});
        await Membresia.create({usuario:u._id,organizacion:company._id,rol:'administrador',estado:'activa'});
      }
      const a=await call('get','/me/organizaciones?limite=1',c);assert.ok(a.body.data.siguiente);
      const b=await call('get','/me/organizaciones?limite=1&despues='+a.body.data.siguiente,c);
      assert.equal(b.body.data.siguiente,null);assert.notEqual(a.body.data.organizaciones[0].id,b.body.data.organizaciones[0].id);
      await Membresia.updateMany({usuario:u._id},{$set:{estado:'revocada'}});
      assert.deepEqual((await call('get','/me/organizaciones',c)).body.data.organizaciones,[]);
    });
    await caso('pantalla de otra cuenta no puede enviar borradores ni registrar actividad',async()=>{
      const u=await cuenta(),other=await cuenta(),c=cookie(await login(u));
      for(const path of ['/auth/session/actividad','/organizaciones/'+new mongoose.Types.ObjectId()+'/subespacios']){
        const r=await call('post',path,c).set('X-Session-User',String(other._id)).send({});
        assert.equal(r.status,409);assert.equal(r.body.codigo,'CUENTA_CAMBIADA');
      }
      assert.equal((await call('get','/me/organizaciones',c).set('X-Session-User',String(u._id))).status,200);
    });
    await caso('Workspace con login real crea y consulta operación y registra su actividad',async()=>{
      const u=await cuenta(),c=cookie(await login(u));
      const company=await Organizacion.create({razon_social:'Recorrido sintético',pais:'ES',identificador_tipo:'NIF',identificador_valor:'B00000300',estado:'activa'});
      await Membresia.create({usuario:u._id,organizacion:company._id,rol:'administrador',estado:'activa'});
      const base='/organizaciones/'+company._id;
      const r=await call('post',base+'/operaciones',c).set('X-Session-User',String(u._id)).set('Idempotency-Key',crypto.randomUUID()).send({
        nombre:'Mantenimiento de prueba',descripcion:'Solo fixture',hechos:[],subespacioId:null,motivo:'Comprobar integración real'
      });
      assert.equal(r.status,201,JSON.stringify(r.body));
      assert.equal((await call('get',base+'/operaciones/'+r.body.data.operacion.id,c)).status,200);
      const history=await call('get',base+'/actividad',c);assert.equal(history.status,200);
      assert.ok(history.body.data.eventos.some(e=>e.operacionId===r.body.data.operacion.id));
    });

    await caso('fallo del almacén da 503 sin cookie nueva ni cierre ficticio',async()=>{
      const u=await cuenta(),c=cookie(await login(u)),original=Sesion.collection.aggregate;
      Sesion.collection.aggregate=()=>{throw Error('dato interno secreto');};
      try{const r=await me(c);assert.equal(r.status,503);assert.ok(!JSON.stringify(r.body).includes('secreto'));}
      finally{Sesion.collection.aggregate=original;}
      const update=Sesion.collection.updateOne;
      Sesion.collection.updateOne=()=>{throw Error('fallo');};
      try{const r=await cerrar(c);assert.equal(r.status,503);assert.equal(r.headers['set-cookie'],undefined);}
      finally{Sesion.collection.updateOne=update;}
      const save=Sesion.prototype.save;Sesion.prototype.save=async()=>{throw Error('fallo');};
      try{const r=await login(u);assert.equal(r.status,503);assert.equal(cookie(r),undefined);}
      finally{Sesion.prototype.save=save;}
    });
    return resultados;
  }finally{await mongoose.disconnect();}
}
module.exports={comprobar};
