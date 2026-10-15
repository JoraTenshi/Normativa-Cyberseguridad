'use strict';
// Paso manual, no hook de arranque. No lee contraseñas ni acepta URI/roles de cliente.
const readline=require('node:readline/promises');
async function main(){
  if(process.argv.length!==2||!process.stdin.isTTY||!process.stdout.isTTY||process.getuid?.()!==0)throw Error('OPERADOR_TTY_REQUERIDO');
  const {loadConfig}=require('./config'); // Solo disponible en perfil privado preparado.
  const config=loadConfig();
  const mongoose=require('mongoose'),Usuario=require('../../models/Usuario'),Permiso=require('../../models/PermisoAltasPlataforma');
  const {designar}=require('../../services/designacionGestorAltas');
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  try{
    await mongoose.connect(config.uri,{serverSelectionTimeoutMS:5000});await Permiso.init();
    const h=await mongoose.connection.db.command({hello:1});
    if(mongoose.connection.name!=='nc_private'||h.setName!=='nc-private-rs'||!h.isWritablePrimary)throw Error('DESTINO_INCORRECTO');
    if(await Permiso.exists({_id:'revision_altas'}))throw Error('DESIGNACION_YA_EXISTE_NO_REASIGNAR');
    const email=(await rl.question('Correo de la cuenta de José ya verificada y con MFA de la app: ')).trim().toLowerCase();
    if(email.length>254||!email.includes('@')||/[\r\n\0]/.test(email))throw Error('CORREO_INVALIDO');
    const usuarios=await Usuario.find({email}).select('_id email emailVerifiedAt twoFactorEnabled').lean();
    if(usuarios.length!==1||!usuarios[0].emailVerifiedAt||!usuarios[0].twoFactorEnabled)throw Error('CUENTA_NO_VERIFICADA_O_SIN_MFA');
    const u=usuarios[0];console.log('Cuenta exacta: '+u._id+' / '+u.email+'; capacidad exclusiva revisión de altas, no acceso a empresas.');
    const esperado='DESIGNAR '+u._id;
    if(await rl.question('Para confirmar escribe '+esperado+': ')!==esperado)throw Error('SIN_CONFIRMACION');
    const referenciaAutorizacion=await rl.question('Referencia no secreta de la autorización de José (20–500 caracteres): ');
    const r=await designar({usuarioId:String(u._id),emailConfirmado:u.email,referenciaAutorizacion});
    console.log('DESIGNACION_COMPLETADA usuario='+r.usuarioId+'; no se han creado organizaciones ni membresías.');
  }finally{rl.close();await mongoose.disconnect();}
}
if(require.main===module)main().catch(e=>{console.error(/^[A-Z_]+$/.test(e.message)?e.message:'DESIGNACION_FALLIDA_REVISAR_SIN_REPETIR_A_CIEGAS');process.exitCode=1;});
module.exports={main};
