'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {instancia}=require('./run-gestion-unidades-mongo');
const {comprobar}=require('./check-alternativas-mongo');
async function main(){
  const p=process.env.MONGOD_TEST_BINARY;if(!p||!path.isAbsolute(p))throw Error('MONGOD_TEST_BINARY absoluto requerido');
  const bin=await fs.realpath(p);if(!(await fs.stat(bin)).isFile())throw Error('Binario inválido');
  const r=await instancia(bin,false,comprobar),s=await instancia(bin,true,comprobar);
  console.log('COMPLETADO alternativas: '+r+' grupos HTTP/Mongo réplica + '+s+' standalone. Solo fixtures, sin publicación ni navegador.');
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={main};
