'use strict';
const fs=require('node:fs/promises'),{withMongo}=require('./mongo.cjs'),{comprobar}=require('../backend/scripts/check-eipd-mongo');
(async()=>{const resultados=await withMongo(process.argv[2],false,comprobar);await fs.writeFile(__dirname+'/eipd-report.json',JSON.stringify({estado:'EIPD_API_MONGO_SYNTHETIC_PASSED',resultados,uiVerificada:false,despliegue:false},null,2),{mode:0o600});console.log('EIPD_API_MONGO_PASSED');})().catch(e=>{console.error(e);process.exitCode=1;});
