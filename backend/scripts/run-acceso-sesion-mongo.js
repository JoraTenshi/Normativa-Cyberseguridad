'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {comprobar}=require('./check-acceso-sesion-mongo');
const {instancia}=require('./run-gestion-unidades-mongo');
async function main(){
  const ruta=process.env.MONGOD_TEST_BINARY;
  if(!ruta||!path.isAbsolute(ruta))throw Error('Indica ruta absoluta MONGOD_TEST_BINARY');
  const bin=await fs.realpath(ruta);if(!(await fs.stat(bin)).isFile())throw Error('Binario inválido');
  const n=await instancia(bin,false,comprobar);
  console.log('COMPLETADO: '+n+' grupos HTTP + Mongo temporal, autenticación persistente real; no navegador ni despliegue.');
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={main};
