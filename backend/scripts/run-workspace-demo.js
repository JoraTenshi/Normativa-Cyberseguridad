'use strict';
// ENTRADA EXCLUSIVA DE LABORATORIO. No se importa desde app.js/server.js.
// Mongo propio temporal, dos empresas ficticias, API real y sesión solo de demo.
// No recibe URI, .env, JWT ni credenciales; no puede conectarse a la base habitual.
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
function guardiaCaducidad(caduca, reloj = Date.now) {
  return (req, res, next) => {
    // Un temporizador monotónico puede no avanzar durante una suspensión del host.
    // La fecha pública de caducidad también se comprueba en CADA petición.
    if (reloj() >= caduca.getTime()) return res.status(503).json({
      ok:false, codigo:'LABORATORIO_CADUCADO', error:'El laboratorio temporal ha caducado; inicia un entorno nuevo.'
    });
    next();
  };
}
async function ejecutarDemo({uri,nombreBD,standalone}) {
  if (standalone || new URL(uri).hostname !== '127.0.0.1' || new URL(uri).port === '27017' ||
      !/^nc_org03_[a-f0-9]{24}$/.test(nombreBD)) throw Error('Solo réplica temporal propia');
  process.env.APP_URL='https://localhost';process.env.CORS_ORIGIN='http://127.0.0.1:4190';
  const mongoose=require('mongoose'), express=require('express'), jwt=require('jsonwebtoken');
  const {createApp}=require('../app');
  const O=require('../models/Organizacion'), M=require('../models/Membresia');
  const U=require('../models/UnidadTrabajo'), P=require('../models/MembresiaUnidad'), Usuario=require('../models/Usuario');
  const servicios=require('../services/decisionesOperacion');
  const {crearCatalogo}=require('../services/catalogoAplicabilidad');
  const {guardarOperacion}=require('../services/operaciones');
  const {crearSubespacio}=require('../services/subespacios');
  const ahora=new Date(), caduca=new Date(ahora.getTime()+4*60*60*1000);
  const hecho=clave=>({clave,tipo:'booleano',pregunta:{id:'P_'+clave,texto:'Condición sintética '+clave+' confirmada?',
    grupo:'Prueba técnica, no normativa',motivo:'Permite probar una decisión sin activar ninguna regla jurídica.'}});
  const regla={id:'DEMO_CONDICION',version:1,estado:'revisada',
    revision:{revisorRef:'fixture-tecnica-no-juridica',fecha:'2020-01-01T00:00:00.000Z'},
    naturaleza:'contrato',origenes:['contractual'],tiposObjeto:['operacion'],
    fuentes:[{id:'DEMO_FUENTE',version:1,editor:'Laboratorio',titulo:'Condiciones ficticias sin efecto legal',
      url:'https://example.invalid/demo',localizador:'A y B, solo simulación',
      consultadaEn:'2020-01-01T00:00:00.000Z',estadoRevision:'revisada'}],
    vigencia:{estado:'definida',desde:'2020-01-01T00:00:00.000Z',hasta:null},
    hechos:[hecho('a'),hecho('b')],condicion:{op:'and',args:[{op:'eq',hecho:'a',valor:true},{op:'eq',hecho:'b',valor:true}]},
    excepciones:[]};
  // Solo este proceso tiene el catálogo sintético. El módulo productivo sigue vacío.
  Object.assign(servicios,servicios.crearServicioDecisionesOperacion({catalogo:crearCatalogo([regla])}));
  let servidor;
  try {
    await mongoose.connect(uri,{dbName:nombreBD,serverSelectionTimeoutMS:5000});
    for(const model of Object.values(mongoose.models)) await model.init();
    const empresas=await O.create(['Linde Studio — laboratorio','Otra empresa — aislamiento'].map((nombre,i)=>({
      razon_social:nombre,pais:'ES',identificador_tipo:'NIF',identificador_valor:'B0000000'+(i+1),estado:'activa'})));
    const cuentas={};
    for(const [cuenta,empresa,rol] of [['admin',0,'administrador'],['coordinador',0,'colaborador'],
      ['lector',0,'consulta'],['otro_admin',0,'administrador'],['otra_empresa',1,'administrador']]){
      const uid=new mongoose.Types.ObjectId();
      await Usuario.collection.insertOne({_id:uid,nombre:'Demo '+cuenta,email:cuenta+'@example.invalid',
        emailVerifiedAt:ahora,sessionVersion:0,rol:'usuario'});
      const m=await M.create({usuario:uid,organizacion:empresas[empresa]._id,rol,estado:'activa'});
      cuentas[cuenta]={usuarioId:String(uid),organizacionId:String(m.organizacion),membresiaId:String(m._id),rol};
    }
    const unidad=await U.create({organizacion:empresas[0]._id,nombre:'Equipo sintético (3 miembros)',estado:'activa'});
    for(const c of ['coordinador','lector','otro_admin'])
      await P.create({unidad:unidad._id,membresia:cuentas[c].membresiaId,rol:c==='coordinador'?'coordinador':'miembro',estado:'activa'});
    const ambito={usuarioId:cuentas.admin.usuarioId,organizacionId:cuentas.admin.organizacionId};
    const sub=await crearSubespacio({...ambito,clave:crypto.randomUUID(),
      datos:{nombre:'Trama SaaS — laboratorio',tipo:'servicio',descripcion:'Servicio ficticio para pruebas'}});
    // Las operaciones iniciales se crean mediante el servicio real, con sus eventos.
    const op=await guardarOperacion({...ambito,clave:crypto.randomUUID(),datos:{
      nombre:'Alojamiento de datos — ejemplo',descripcion:'Operación ficticia, sin clientes ni datos personales reales',
      subespacioId:sub.id,motivo:'Inicialización de laboratorio',hechos:[
        {clave:'a',estado:'conocido',valor:true},{clave:'b',estado:'desconocido',motivo:'por_consultar'}
      ]}});
    await guardarOperacion({...ambito,clave:crypto.randomUUID(),datos:{
      nombre:'Facturación propia — ejemplo',descripcion:'Segunda operación independiente',
      motivo:'Inicialización de laboratorio',hechos:[]}});
    const app=express();
    app.locals.politicaSesiones = 'legado_pruebas';
    app.disable('x-powered-by');
    app.use((req,res,next)=>{
      // La demo no acepta Host remoto, DNS rebinding o un proxy que cambie su Host.
      if(!['localhost:4191','127.0.0.1:4191','localhost:4190','127.0.0.1:4190'].includes(req.get('host')))
        return res.status(403).json({ok:false,error:'Demo exclusiva de loopback'});
      res.set('Cache-Control','no-store');
      if(req.get('origin') && req.get('origin')!=='http://127.0.0.1:4190')
        return res.status(403).json({ok:false,error:'Origen de laboratorio no permitido'});
      next();
    });
    const info={modo:'laboratorio_api_real_datos_sinteticos',caducaEn:caduca.toISOString(),
      organizacionId:ambito.organizacionId,operacionId:op.operacion.id,subespacioId:sub.id,unidadId:String(unidad._id),
      cuentas,empresas:empresas.map(o=>({id:String(o._id),nombre:o.razon_social})),
      reglaSintetica:{id:regla.id,version:1,campos:regla.hechos},
      aviso:'Datos temporales: se pierden al cerrar o caducar. No introducir documentación o datos reales. RGPD28 sigue borrador.'};
    app.use(guardiaCaducidad(caduca));
    app.get('/demo/info',(req,res)=>res.json({ok:true,data:info}));
    app.post('/demo/login',express.json({limit:'1kb'}),(req,res)=>{
      if(req.get('X-Requested-With')!=='XMLHttpRequest') return res.status(403).json({ok:false,error:'Cabecera requerida'});
      if(!req.body || typeof req.body!=='object' || Array.isArray(req.body) ||
          Object.keys(req.body).some(k=>k!=='cuenta')) return res.status(400).json({ok:false,error:'Petición de demo inválida'});
      const cuenta=req.body.cuenta===undefined?'admin':req.body.cuenta;
      if(typeof cuenta!=='string'||!Object.hasOwn(cuentas,cuenta))return res.status(400).json({ok:false,error:'Cuenta de demo no disponible'});
      const c=cuentas[cuenta];
      const token=jwt.sign({id:c.usuarioId,jti:crypto.randomUUID(),sessionVersion:0},process.env.JWT_SECRET,
        {algorithm:'HS256',expiresIn:'4h'});
      res.cookie('cyberaudit_token',token,{httpOnly:true,sameSite:'strict',secure:false,path:'/',maxAge:4*60*60*1000});
      res.json({ok:true,data:{cuenta,...c,caducaEn:caduca.toISOString(),modo:info.modo}});
    });
    app.use((req,res,next)=>{
      if(req.path.startsWith('/organizaciones/') || (req.method==='GET'&&['/me','/health'].includes(req.path)) ||
          (req.method==='POST'&&req.path==='/auth/logout'))return next();
      res.status(404).json({ok:false,error:'Ruta fuera del recorrido de laboratorio'});
    });
    // Sin cuota global de navegación en este proceso aislado de 4 horas; producción intacta.
    app.use(createApp({ rateLimits:false, politicaSesiones:'legado_pruebas' }));
    servidor=await new Promise((resolve,reject)=>{
      const s=app.listen(4191,'127.0.0.1',()=>resolve(s));s.once('error',reject);
    });
    console.log('WORKSPACE_DEMO_READY '+JSON.stringify({url:'http://127.0.0.1:4191',...info}));
    await new Promise(resolve=>{
      const terminar=()=>{clearTimeout(timer);process.removeListener('SIGTERM',terminar);process.removeListener('SIGINT',terminar);resolve();};
      const timer=setTimeout(terminar,Math.max(1,caduca.getTime()-Date.now()));
      process.once('SIGTERM',terminar);process.once('SIGINT',terminar);
    });
    return ['demo finalizada'];
  } finally {
    if(servidor){servidor.closeAllConnections();await new Promise(resolve=>servidor.close(resolve));}
    await mongoose.disconnect();
  }
}
async function main(){
  // No admite argumentos de URI/BD o perfiles; MONGOD_TEST_BINARY es solo el ejecutable.
  if(process.argv.length!==2)throw Error('Sin argumentos: no admite URI, cuentas o catálogos externos');
  const ruta=process.env.MONGOD_TEST_BINARY;
  if(!ruta||!path.isAbsolute(ruta))throw Error('Indica ruta absoluta MONGOD_TEST_BINARY');
  const bin=await fs.realpath(ruta);if(!(await fs.stat(bin)).isFile())throw Error('Binario inválido');
  // Se difiere el require hasta fijar secretos temporales antes de cargar middleware.
  process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
  process.env.TOTP_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');
  process.env.APP_URL='https://localhost';process.env.CORS_ORIGIN='http://127.0.0.1:4190';
  const {instancia}=require('./run-gestion-unidades-mongo');
  await instancia(bin,false,ejecutarDemo);
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={main,guardiaCaducidad};
