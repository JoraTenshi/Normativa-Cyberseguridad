'use strict';
try{
 const password=require('fs').readFileSync('/run/secrets/mongo_app_password','utf8').trim();
 if(!/^[a-f0-9]{64}$/.test(password))quit(1);
 const c=new Mongo('mongodb://nc_app:'+password+'@127.0.0.1:27017/nc_private?authSource=nc_private&directConnection=true');
 const h=c.getDB('nc_private').adminCommand({hello:1});quit(h.setName==='nc-private-rs'&&h.isWritablePrimary?0:1);
}catch{quit(1);}
