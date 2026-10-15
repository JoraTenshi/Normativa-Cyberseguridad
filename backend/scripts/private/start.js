'use strict';
// Separate private-server entrypoint. Does not read .env or create users/data.
const {loadConfig}=require('./config');
let stage='configuracion';
async function start(){
 const c=loadConfig();process.env.JWT_SECRET=c.jwt;process.env.TOTP_ENCRYPTION_KEY=c.totp;
 for(const k of ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_FROM'])delete process.env[k];
 if(c.smtp)Object.assign(process.env,{SMTP_HOST:c.smtp.host,SMTP_PORT:String(c.smtp.port),SMTP_USER:c.smtp.username,SMTP_PASS:c.smtp.password,SMTP_FROM:c.smtp.from});
 require('../../utils/initSecrets');
 stage='modulos';const mongoose=require('mongoose'),{createApp}=require('../../app');
 stage='mongodb';await mongoose.connect(c.uri,{serverSelectionTimeoutMS:10000,maxPoolSize:15});
 const hello=await mongoose.connection.db.admin().command({hello:1});
 if(hello.setName!==c.replica||!hello.isWritablePrimary)throw Error('REPLICA');
 stage='indices';await Promise.all(Object.values(mongoose.models).map(m=>m.init()));
 const app=createApp();if(app.locals.politicaSesiones!=='persistente')throw Error('SESSION_POLICY');
 stage='http';const server=app.listen(5000,'0.0.0.0',()=>console.log('PRIVATE_API_READY; mail='+ (c.smtp?'configured_not_delivery_verified':'disabled_onboarding_blocked')));
 server.once('error',()=>{console.error('PRIVATE_API_LISTEN_FAILED');process.exit(1);});
 let stopping=false;const stop=()=>{if(stopping)return;stopping=true;const timer=setTimeout(()=>process.exit(1),30000);timer.unref();server.close(async()=>{await mongoose.disconnect();clearTimeout(timer);process.exit(0);});};
 process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
if(require.main===module)start().catch(()=>{console.error('PRIVATE_START_FAILED stage='+stage+'; no data deleted');process.exit(1);});
module.exports={start};
