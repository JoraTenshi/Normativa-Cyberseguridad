'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {instancia}=require('./run-gestion-unidades-mongo');
const {comprobar}=require('./check-categorizacion-ens-mongo');
async function main(){if(!process.env.MONGOD_TEST_BINARY||!path.isAbsolute(process.env.MONGOD_TEST_BINARY))throw Error('MONGOD_TEST_BINARY absoluto requerido');const bin=await fs.realpath(process.env.MONGOD_TEST_BINARY);const replica=await instancia(bin,false,comprobar),standalone=await instancia(bin,true,comprobar);console.log(JSON.stringify({replicaGroups:replica,standaloneGroups:standalone,scope:'Synthetic HTTP/Mongo only; no browser, publication or legal acceptance'}));}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={main};
