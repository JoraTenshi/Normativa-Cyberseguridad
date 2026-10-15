'use strict';
const {loadConfig}=require('./config');
(async()=>{
 const c=loadConfig(),{MongoClient}=require('mongoose').mongo,client=new MongoClient(c.uri,{serverSelectionTimeoutMS:2000});
 try{await client.connect();const h=await client.db().admin().command({hello:1});if(h.setName!==c.replica||!h.isWritablePrimary)throw Error('REPLICA');
 const response=await fetch('http://127.0.0.1:5000/health',{signal:AbortSignal.timeout(2000)});if(!response.ok||!(await response.json()).ok)throw Error('HEALTH');
 }finally{await client.close();}
})().catch(()=>{console.error('PRIVATE_HEALTH_FAILED');process.exitCode=1;});
