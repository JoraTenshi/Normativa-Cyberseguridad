'use strict';
const fs=require('node:fs/promises'),{withMongo}=require('./mongo.cjs');
const {comprobar}=require('../backend/scripts/check-unidades-dp-mongo');
(async()=>{const resultados=[];for(const standalone of [false,true])await withMongo(process.argv[2],standalone,async x=>{resultados.push({standalone,casos:await comprobar({...x,standalone}),dir:x.dir});});await fs.writeFile(__dirname+'/unidades-report.json',JSON.stringify({estado:'UNIDADES_API_MONGO_SYNTHETIC_PASSED',resultados,uiVerificada:false,despliegue:false},null,2),{mode:0o600});console.log('UNIDADES_API_MONGO_PASSED');})().catch(e=>{console.error(e);process.exitCode=1;});
