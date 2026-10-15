'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {comprobar}=require('./check-altas-mongo');
const {instancia}=require('./run-gestion-unidades-mongo');
async function main(){
 const bin=await fs.realpath(process.env.MONGOD_TEST_BINARY||'');if(!path.isAbsolute(bin)||!(await fs.stat(bin)).isFile())throw Error('BINARIO_MONGO_REQUERIDO');
 const grupos=await instancia(bin,false,comprobar),negativos=await instancia(bin,true,comprobar);
 console.log(JSON.stringify({resultado:'correcto',gruposReplica:grupos,gruposStandalone:negativos,sesiones:'persistentes con login/MFA HTTP',datos:'solo sintéticos temporales',navegador:false,correoExterno:false,despliegue:false}));
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={main};
