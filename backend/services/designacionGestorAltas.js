'use strict';
const mongoose=require('mongoose');
const Usuario=require('../models/Usuario');
const Permiso=require('../models/PermisoAltasPlataforma');
// Solo operador de despliegue. No se importa desde ninguna ruta HTTP ni se
// ejecuta al arrancar. La cuenta y el correo proceden de una confirmación humana.
async function designar({usuarioId,emailConfirmado,referenciaAutorizacion}){
  if(typeof usuarioId!=='string'||!/^[a-f0-9]{24}$/.test(usuarioId)||
    typeof emailConfirmado!=='string'||emailConfirmado.length>254||!emailConfirmado.includes('@')||/[\r\n\0]/.test(emailConfirmado)||
    typeof referenciaAutorizacion!=='string'||referenciaAutorizacion.trim().length<20||referenciaAutorizacion.length>500||/[\x00-\x1f]/.test(referenciaAutorizacion))throw Error('DESIGNACION_DATOS_INVALIDOS');
  return mongoose.connection.transaction(async session=>{
    if(await Permiso.exists({_id:'revision_altas'}).session(session))throw Error('DESIGNACION_YA_EXISTE_NO_REASIGNAR');
    const usuario=await Usuario.findOneAndUpdate({_id:usuarioId,email:emailConfirmado.trim().toLowerCase(),emailVerifiedAt:{$type:'date'},twoFactorEnabled:true},
      {$inc:{__v:1}},{session,new:true,timestamps:false}).select('_id').lean();
    if(!usuario)throw Error('CUENTA_NO_VERIFICADA_O_SIN_MFA');
    const ahora=(await mongoose.connection.db.command({hello:1},{readPreference:'primary'})).localTime;
    await Permiso.create([{_id:'revision_altas',usuario:usuario._id,estado:'activo',concedidaEn:ahora,referenciaAutorizacion:referenciaAutorizacion.trim()}],{session});
    return{usuarioId:String(usuario._id),capacidad:'revision_altas',concedidaEn:ahora};
  },{readPreference:'primary',readConcern:{level:'snapshot'},writeConcern:{w:'majority'},maxCommitTimeMS:5000});
}
module.exports={designar};
