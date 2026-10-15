'use strict';
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const Sesion = require('../models/SesionUsuario');
const Solicitud = require('../models/SolicitudOrganizacion');
const Revision = require('../models/RevisionSolicitudOrganizacion');
const Permiso = require('../models/PermisoAltasPlataforma');
const Operacion = require('../models/OperacionAlta');
const Organizacion = require('../models/Organizacion');
const Membresia = require('../models/Membresia');
const { evaluarVigencia } = require('./politicaSesion');

const RECIENTE_MS = 10 * 60 * 1000;
const ABIERTOS = ['pendiente_revision','aclaracion_requerida'];
const ESTADOS = [...ABIERTOS,'aprobada','rechazada'];
const ERRORES = {
  DATOS_INVALIDOS:[400,'Datos de solicitud inválidos. Revisa los campos y límites.'],
  SESION_NO_VALIDA:[401,'Sesión no válida. Inicia sesión de nuevo.'],
  GESTION_ALTAS_DENEGADA:[403,'No tienes autorización para gestionar altas.'],
  MFA_REQUERIDO:[403,'La gestión de altas requiere verificación en dos pasos de NormativaCheck.'],
  REAUTENTICACION_REQUERIDA:[403,'Vuelve a iniciar sesión para confirmar esta decisión. Conserva tu borrador.'],
  AUTOAPROBACION_DENEGADA:[403,'No puedes decidir tu propia solicitud.'],
  SOLICITUD_NO_DISPONIBLE:[404,'Solicitud no disponible.'],
  VERSION_DESACTUALIZADA:[409,'La solicitud ha cambiado. Conserva tu borrador y consulta la versión actual.'],
  TRANSICION_INVALIDA:[409,'El estado de la solicitud no permite esta operación.'],
  CLAVE_REUTILIZADA:[409,'La clave de reintento ya se utilizó para otra operación.'],
  SOLICITUD_ABIERTA:[409,'Ya tienes una solicitud abierta; consulta o corrige la existente.'],
  CUOTA_ALTAS:[409,'Se ha alcanzado el límite de solicitudes o revisiones; contacta con el responsable.'],
  CORREO_NO_VERIFICADO:[409,'El solicitante debe tener el correo verificado antes de aprobar el alta.'],
  ALTA_NO_DISPONIBLE:[409,'No se puede activar esta solicitud. Requiere revisión manual sin conceder acceso.'],
  ALTAS_NO_DISPONIBLES:[503,'La gestión de altas no está disponible temporalmente.']
};
class ErrorAlta extends Error {
  constructor(codigo){super(ERRORES[codigo][1]);this.codigo=codigo;this.status=ERRORES[codigo][0];}
}
const fallo = codigo => { throw new ErrorAlta(codigo); };
function campos(obj,keys){
  if(!obj || Object.getPrototypeOf(obj)!==Object.prototype || Reflect.ownKeys(obj).some(k=>!keys.includes(k)))fallo('DATOS_INVALIDOS');
}
function texto(v,min,max){
  if(typeof v!=='string' || v.trim().length<min || v.trim().length>max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f<>]/.test(v))fallo('DATOS_INVALIDOS');
  return v.trim();
}
function datos(v){
  campos(v,['razonSocial','pais','nif','funcionProfesional','justificacion']);
  if(v.pais!=='ES')fallo('DATOS_INVALIDOS');
  const nif=texto(v.nif,9,9).toUpperCase();if(!/^[A-Z0-9]{9}$/.test(nif))fallo('DATOS_INVALIDOS');
  return {razonSocial:texto(v.razonSocial,1,200),pais:'ES',nif,
    funcionProfesional:texto(v.funcionProfesional,1,120),justificacion:texto(v.justificacion,1,1000)};
}
function id(v){if(typeof v!=='string'||!/^[a-f0-9]{24}$/i.test(v))fallo('DATOS_INVALIDOS');return v.toLowerCase();}
function version(v){if(!Number.isSafeInteger(v)||v<1||v>50)fallo('DATOS_INVALIDOS');return v;}
function clave(v){if(typeof v!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(v))fallo('DATOS_INVALIDOS');return v;}
function entrada(body,accion){
  if(accion==='crear')return datos(body);
  if(accion==='corregir'){campos(body,['version','datos']);return{version:version(body.version),datos:datos(body.datos)};}
  campos(body,['version','decision','motivoPublico','notaInterna']);
  if(!['aprobar','rechazar','pedir_aclaracion'].includes(body.decision))fallo('DATOS_INVALIDOS');
  return{version:version(body.version),decision:body.decision,motivoPublico:texto(body.motivoPublico,20,1000),notaInterna:texto(body.notaInterna,0,2000)};
}
function filtroLista(query,admin){
  campos(query,admin?['despues','limite','estado']:['despues','limite']);
  const limite=query.limite??'20';if(typeof limite!=='string'||!/^[1-9][0-9]?$/.test(limite)||Number(limite)>50)fallo('DATOS_INVALIDOS');
  if(query.estado!==undefined&&!ESTADOS.includes(query.estado))fallo('DATOS_INVALIDOS');
  return{limite:Number(limite),...(query.despues!==undefined?{despues:id(query.despues)}:{}),...(query.estado?{estado:query.estado}:{})};
}
async function protegido(fn){try{return await fn();}catch(e){
  if(e instanceof ErrorAlta)throw e;
  if(e.code===11000)fallo('ALTA_NO_DISPONIBLE');
  // La entrada ya se valida antes: un fallo inesperado del modelo/almacenamiento
  // no se presenta al usuario como si hubiera rellenado mal el formulario.
  fallo('ALTAS_NO_DISPONIBLES');
}}
async function indices(){
  for(const [m,name,key] of [
    [Organizacion,'organizacion_identificador_unico',{pais:1,identificador_tipo:1,identificador_valor:1}],
    [Membresia,'membresia_organizacion_usuario_unica',{organizacion:1,usuario:1}],
    [Revision,'revision_solicitud_unica',{solicitud:1,version:1}],
    [Operacion,'operacion_alta_unica',{actor:1,clave:1}]
  ]){
    const i=(await m.collection.listIndexes().toArray()).find(x=>x.name===name);
    if(!i?.unique||i.sparse||i.partialFilterExpression||JSON.stringify(i.key)!==JSON.stringify(key))fallo('ALTAS_NO_DISPONIBLES');
  }
}
// Revalidar y escribir las mismas filas dentro de la transacción hace que una
// revocación/logout/reset concurrentes causen conflicto/reintento, no un alta huérfana.
async function autenticar(acceso,session,admin=false,reciente=false){
  if(!acceso||!mongoose.isObjectIdOrHexString(acceso.usuario)||!Number.isSafeInteger(acceso.versionCredenciales)||acceso.versionCredenciales<0||
      typeof acceso.identificador!=='string'||!/^[a-f0-9]{64}$/.test(acceso.identificador))fallo('SESION_NO_VALIDA');
  const filtro={_id:acceso.usuario,sessionVersion:acceso.versionCredenciales,emailVerifiedAt:{$type:'date'}};
  const actualizar={ $inc:{__v:1} },opts={session,new:true,timestamps:false};
  const q=session?Usuario.findOneAndUpdate(filtro,actualizar,opts):Usuario.findOne(filtro).read('primary');
  const u=await q.select('_id nombre email emailVerifiedAt twoFactorEnabled').lean();if(!u)fallo('SESION_NO_VALIDA');
  const sf={usuario:u._id,versionCredenciales:acceso.versionCredenciales,identificadorHash:crypto.createHash('sha256').update(acceso.identificador).digest('hex')};
  const sq=session?Sesion.findOneAndUpdate(sf,actualizar,opts):Sesion.findOne(sf).read('primary');
  const s=await sq.lean();const ahora=(await mongoose.connection.db.command({hello:1},{readPreference:'primary'})).localTime;
  if(!evaluarVigencia(s,ahora).valida)fallo('SESION_NO_VALIDA');
  const pf={_id:'revision_altas',usuario:u._id,estado:'activo'};
  const permiso=admin&&session?await Permiso.findOneAndUpdate(pf,actualizar,opts).lean():await Permiso.findOne(pf).session(session??null).read('primary').lean();
  if(admin&&!permiso)fallo('GESTION_ALTAS_DENEGADA');
  if(admin&&!u.twoFactorEnabled)fallo('MFA_REQUERIDO');
  const necesitaReciente=ahora.getTime()-s.autenticadaEn.getTime()>=RECIENTE_MS;
  if(admin&&reciente&&necesitaReciente)fallo('REAUTENTICACION_REQUERIDA');
  return{usuario:u,ahora,permiso,necesitaReciente};
}
const historialPublico=(r,admin)=>({version:r.version,accion:r.accion,fecha:r.fecha,datos:r.datos,motivoPublico:r.motivoPublico,
  actorTipo:r.actorTipo,...(admin?{actorId:String(r.actor),notaInterna:r.notaInterna??''}:{})});
async function dto(s,{admin=false,actorId,detalle=false,session=null}={}){
  const d={id:String(s._id),version:s.version,estado:s.estado,datos:s.datos,creadaEn:s.createdAt,actualizadaEn:s.updatedAt,
    organizacion:s.organizacion?{id:String(s.organizacion),nombre:s.datos.razonSocial,rol:'administrador'}:null};
  if(admin){
    const u=await Usuario.findById(s.solicitante).select('_id nombre email emailVerifiedAt').session(session).lean();
    d.solicitante=u?{id:String(u._id),nombre:u.nombre,email:u.email,emailVerificado:Boolean(u.emailVerifiedAt)}:{id:String(s.solicitante),nombre:'Cuenta no disponible',email:null,emailVerificado:false};
    d.puedeDecidir=Boolean(u?.emailVerifiedAt)&&String(s.solicitante)!==String(actorId)&&ABIERTOS.includes(s.estado);
  }
  if(detalle){
    let q=Revision.find({solicitud:s._id}).sort({version:1}).session(session);
    if(admin)q=q.select('+notaInterna');
    d.historial=(await q.lean()).map(r=>historialPublico(r,admin));
  }
  return d;
}
async function capacidades(acceso){return protegido(async()=>{
  const a=await autenticar(acceso,null);
  return{gestionarAltas:Boolean(a.permiso&&a.usuario.twoFactorEnabled),requiereMfa:Boolean(a.permiso&&!a.usuario.twoFactorEnabled),
    requiereAutenticacionReciente:Boolean(a.permiso&&a.necesitaReciente)};
});}
async function listar(acceso,query={},admin=false){const f=filtroLista(query,admin);return protegido(async()=>{
  const a=await autenticar(acceso,null,admin);
  const rows=await Solicitud.find({...(admin?{}:{solicitante:a.usuario._id}),...(f.estado?{estado:f.estado}:{}),...(f.despues?{_id:{$gt:f.despues}}:{})})
    .sort({_id:1}).limit(f.limite+1).read('primary').lean();
  const solicitudes=[];for(const s of rows.slice(0,f.limite))solicitudes.push(await dto(s,{admin,actorId:a.usuario._id}));
  return{solicitudes,siguiente:rows.length>f.limite?solicitudes.at(-1).id:null};
});}
async function obtener(acceso,solicitudId,admin=false){id(solicitudId);return protegido(async()=>{
  const a=await autenticar(acceso,null,admin);
  const s=await Solicitud.findOne({_id:solicitudId,...(admin?{}:{solicitante:a.usuario._id})}).read('primary').lean();
  if(!s)fallo('SOLICITUD_NO_DISPONIBLE');
  return{solicitud:await dto(s,{admin,actorId:a.usuario._id,detalle:true})};
});}
async function escribir({acceso,clave:peticion,accion,solicitudId=null,body}){
  if(!['crear','corregir','decidir'].includes(accion))fallo('DATOS_INVALIDOS');
  const key=clave(peticion),v=entrada(body,accion),sid=accion==='crear'?null:id(solicitudId);
  const huella=crypto.createHash('sha256').update(JSON.stringify({accion,solicitudId:sid,datos:v})).digest('hex');
  const admin=accion==='decidir';
  return protegido(async()=>{
    await indices();
    return mongoose.connection.transaction(async session=>{
      const a=await autenticar(acceso,session,admin,admin),actor=a.usuario._id;
      const previo=await Operacion.findOne({actor,clave:key}).session(session).lean();
      if(previo){if(previo.huella!==huella)fallo('CLAVE_REUTILIZADA');return{solicitud:previo.respuesta,repetida:true};}
      let s,accionHistoria,motivoPublico,notaInterna='';
      if(accion==='crear'){
        if(await Solicitud.exists({solicitante:actor,estado:{$in:ABIERTOS}}).session(session))fallo('SOLICITUD_ABIERTA');
        if(await Solicitud.countDocuments({solicitante:actor}).session(session)>=10)fallo('CUOTA_ALTAS');
        [s]=await Solicitud.create([{solicitante:actor,datos:v,estado:'pendiente_revision',version:1}],{session});
        accionHistoria='solicitada';motivoPublico='Solicitud recibida. Pendiente de revisión por el responsable de la plataforma.';
      }else{
        s=await Solicitud.findOne({_id:sid,...(admin?{}:{solicitante:actor})}).session(session);
        if(!s)fallo('SOLICITUD_NO_DISPONIBLE');
        if(s.version!==v.version)fallo('VERSION_DESACTUALIZADA');
        if(!ABIERTOS.includes(s.estado))fallo('TRANSICION_INVALIDA');
        if(s.version>=50)fallo('CUOTA_ALTAS');
        if(accion==='corregir'){
          s.datos=v.datos;s.estado='pendiente_revision';accionHistoria='corregida';
          motivoPublico='Datos corregidos por el solicitante. Pendiente de una nueva revisión.';
        }else{
          if(String(actor)===String(s.solicitante))fallo('AUTOAPROBACION_DENEGADA');
          motivoPublico=v.motivoPublico;notaInterna=v.notaInterna;
          if(v.decision==='aprobar'){
            if(s.estado!=='pendiente_revision')fallo('TRANSICION_INVALIDA');
            // Bloquea también al destinatario frente a cambios de identidad/verificación concurrentes.
            const destinatario=await Usuario.findOneAndUpdate({_id:s.solicitante,emailVerifiedAt:{$type:'date'}},{$inc:{__v:1}},
              {session,new:true,timestamps:false}).select('_id').lean();
            if(!destinatario)fallo('CORREO_NO_VERIFICADO');
            const identidad={pais:s.datos.pais,identificador_tipo:'NIF',identificador_valor:s.datos.nif};
            if(await Organizacion.exists(identidad).session(session))fallo('ALTA_NO_DISPONIBLE');
            const [org]=await Organizacion.create([{...identidad,razon_social:s.datos.razonSocial,estado:'activa'}],{session});
            const [m]=await Membresia.create([{usuario:s.solicitante,organizacion:org._id,rol:'administrador',estado:'activa',funcion_profesional:s.datos.funcionProfesional}],{session});
            s.organizacion=org._id;s.membresia=m._id;s.estado='aprobada';accionHistoria='aprobada';
          }else if(v.decision==='rechazar'){s.estado='rechazada';accionHistoria='rechazada';}
          else{if(s.estado!=='pendiente_revision')fallo('TRANSICION_INVALIDA');s.estado='aclaracion_requerida';accionHistoria='aclaracion_solicitada';}
        }
        s.version+=1;await s.save({session});
      }
      await Revision.create([{solicitud:s._id,version:s.version,actor,actorTipo:admin?'plataforma':'solicitante',accion:accionHistoria,
        estado:s.estado,datos:s.datos.toObject(),motivoPublico,notaInterna,fecha:a.ahora,organizacion:s.organizacion,membresia:s.membresia}],{session});
      const respuesta=await dto(s.toObject(),{admin,actorId:actor,detalle:true,session});
      await Operacion.create([{actor,clave:key,huella,respuesta}],{session});
      return{solicitud:respuesta,repetida:false};
    },{readPreference:'primary',readConcern:{level:'snapshot'},writeConcern:{w:'majority'},maxCommitTimeMS:5000});
  });
}
module.exports={ErrorAlta,RECIENTE_MS,datos,entrada,filtroLista,capacidades,listar,obtener,escribir};
