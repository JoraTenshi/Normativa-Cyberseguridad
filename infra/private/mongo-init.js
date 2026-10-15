'use strict';
// Explicit operator step for the new private project. Never repairs or erases data.
try{
 const fs=require('fs'),root=fs.readFileSync('/run/secrets/mongo_root_password','utf8').trim(),password=fs.readFileSync('/run/secrets/mongo_app_password','utf8').trim();
 if(!/^[a-f0-9]{64}$/.test(root)||!/^[a-f0-9]{64}$/.test(password)||root===password)quit(2);
 const admin=db.getSiblingDB('admin'),deadline=Date.now()+120000;let ready=false;
 while(Date.now()<deadline){
  try{if(!admin.auth('nc_bootstrap',root))throw Error('AUTH');const h=admin.runCommand({hello:1});
   if(h.setName==='nc-private-rs'){ready=true;break;}
   if(h.setName&&h.setName!=='nc-private-rs')quit(3);
   if(h.isreplicaset){const result=admin.runCommand({replSetInitiate:{_id:'nc-private-rs',members:[{_id:0,host:'mongodb:27017'}]}});if(!result.ok&&result.codeName!=='AlreadyInitialized')throw Error('INIT');}
  }catch{}sleep(1000);
 }
 if(!ready)quit(4);while(Date.now()<deadline&&!admin.runCommand({hello:1}).isWritablePrimary)sleep(500);
 if(!admin.runCommand({hello:1}).isWritablePrimary)quit(5);
 const cfg=admin.runCommand({replSetGetConfig:1}).config;if(cfg?._id!=='nc-private-rs'||cfg.members.length!==1||cfg.members[0].host!=='mongodb:27017')quit(6);
 const target=db.getSiblingDB('nc_private'),current=target.getUser('nc_app');
 if(!current)target.createUser({user:'nc_app',pwd:password,roles:[{role:'readWrite',db:'nc_private'}]});
 else if(current.roles.length!==1||current.roles[0].role!=='readWrite'||current.roles[0].db!=='nc_private')quit(7);
 const probe=new Mongo('mongodb://127.0.0.1:27017/?directConnection=true');if(!probe.getDB('nc_private').auth('nc_app',password))quit(8);
 print('PRIVATE_MONGO_INITIALIZED; no business data seeded');
}catch{print('PRIVATE_MONGO_INIT_FAILED; no data deleted or secrets regenerated');quit(1);}
