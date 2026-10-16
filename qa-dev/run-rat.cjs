'use strict';
const fs=require('node:fs/promises'),{withMongo}=require('./mongo.cjs');
const {comprobar}=require('../backend/scripts/check-rat-mongo.js');
(async()=>{const resultados=[];for(const standalone of [false,true])await withMongo(process.argv[2],standalone,async x=>{const casos=await comprobar({...x,standalone});resultados.push({standalone,casos,dir:x.dir});});await fs.writeFile(__dirname+'/rat-report.json',JSON.stringify({estado:'API_MONGO_SYNTHETIC_PASSED',uiVerificada:false,despliegue:false,resultados},null,2),{mode:0o600});console.log('RAT_API_MONGO_PASSED');})().catch(e=>{console.error(e);process.exitCode=1;});
