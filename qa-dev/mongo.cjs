'use strict';
// Adapted from packaged run-gestion-unidades-mongo. Always retains its own data.
const fs=require('node:fs/promises'),assert=require('node:assert/strict'),crypto=require('node:crypto'),save=async(p,d)=>fs.writeFile(p,JSON.stringify(d,null,2),{mode:0o600}),net=require('node:net'),{spawn}=require('node:child_process');
const {MongoClient}=require('mongoose').mongo;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function withMongo(binary,standalone,fn){
 const root=await fs.realpath(__dirname);assert.match(root,/\/normativacheck-dev\/dp-e1-20261016\.[A-Za-z0-9]+\/qa-dev$/);binary=await fs.realpath(binary);assert.match(binary,/^\/tmp\/nc-org03-mongo\.[A-Za-z0-9]+\/bin\/mongod$/);
 const dir=await fs.mkdtemp(root+'/mongo-');await fs.chmod(dir,0o700);await fs.mkdir(dir+'/data',{mode:0o700});
 const probe=net.createServer();await new Promise((r,j)=>{probe.once('error',j);probe.listen(0,'127.0.0.1',r);});const port=probe.address().port;await new Promise(r=>probe.close(r));
 const args=['--bind_ip','127.0.0.1','--port',String(port),'--dbpath',dir+'/data','--logpath',dir+'/mongo.log','--wiredTigerCacheSizeGB','0.25'];if(!standalone)args.push('--replSet','nc_dp_e1_test');
 const proc=spawn(binary,args,{stdio:'ignore'});let processError=null;proc.once('error',e=>processError=e);const closed=new Promise(r=>proc.once('close',r));
 const uri='mongodb://127.0.0.1:'+port+'/?directConnection=true',name='nc_org03_'+crypto.randomBytes(12).toString('hex');const client=new MongoClient(uri,{serverSelectionTimeoutMS:700});
 await save(dir+'/identity.json',{pid:proc.pid,uri,name,standalone,dir,startedAt:new Date().toISOString(),retained:true});
 try{
  const deadline=Date.now()+30000;let ready=false;while(Date.now()<deadline){if(processError)throw processError;if(proc.exitCode!==null)throw Error('QA_MONGO_EXIT');try{await client.connect();await client.db('admin').command({ping:1});ready=true;break;}catch{await pause(200);}}assert.ok(ready,'QA_MONGO_START_TIMEOUT');
  if(!standalone){await client.db('admin').command({replSetInitiate:{_id:'nc_dp_e1_test',members:[{_id:0,host:'127.0.0.1:'+port}]}});ready=false;while(Date.now()<deadline){if((await client.db('admin').command({hello:1})).isWritablePrimary){ready=true;break;}await pause(200);}assert.ok(ready,'QA_MONGO_PRIMARY_TIMEOUT');}
  return await fn({uri,nombreBD:name,dir,pid:proc.pid});
 }finally{
  await client.close().catch(()=>{});if(proc.exitCode===null&&proc.signalCode===null){proc.kill('SIGTERM');await Promise.race([closed,pause(10000)]);if(proc.exitCode===null&&proc.signalCode===null){proc.kill('SIGKILL');await closed;}}
  await save(dir+'/stopped.json',{at:new Date().toISOString(),pid:proc.pid,exitCode:proc.exitCode,signal:proc.signalCode,dataRetained:true});
 }
}
module.exports={withMongo};
