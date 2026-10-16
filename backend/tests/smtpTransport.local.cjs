'use strict';
// Explicit opt-in: node --test tests/smtpTransport.local.cjs
// Only loopback sockets, generated test CA and synthetic credentials. No Mongo/Gmail.
// OpenSSL is needed; artifacts are retained in an OS temp directory, never trusted globally.
const test=require('node:test'),assert=require('node:assert/strict');
const net=require('node:net'),tls=require('node:tls'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const nodemailer=require('nodemailer');
const {opcionesSmtp,errorCorreoSeguro}=require('../utils/smtpTransport');
const openssl=process.env.NC_QA_OPENSSL || 'openssl';
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'nc-smtp587-qa-'));
function opensslRun(args){cp.execFileSync(openssl,args,{cwd:fixture,stdio:'pipe',windowsHide:true,timeout:30000});}
opensslRun(['req','-x509','-newkey','rsa:2048','-nodes','-keyout','ca.key','-out','ca.crt','-days','1','-subj','/CN=NormativaCheck SMTP TEST ONLY CA','-addext','basicConstraints=critical,CA:TRUE']);
opensslRun(['req','-newkey','rsa:2048','-nodes','-keyout','server.key','-out','server.csr','-subj','/CN=smtp.qa.invalid','-addext','subjectAltName=DNS:smtp.qa.invalid']);
opensslRun(['x509','-req','-in','server.csr','-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-out','server.crt','-days','1','-copy_extensions','copy']);
const ca=fs.readFileSync(fixture+'/ca.crt'),cert=fs.readFileSync(fixture+'/server.crt'),key=fs.readFileSync(fixture+'/server.key');
const secureContext=tls.createSecureContext({cert,key,minVersion:'TLSv1.2'});
const results=[];

async function smtpServer(mode){
 const sockets=new Set(),seen={plainAuth:0,secureAuth:0,mail:0,data:0,tlsUpgrades:0,commands:[]};
 function track(socket){sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});}
 function attach(socket,encrypted,greeting=true){
  track(socket);if(greeting)socket.write('220 smtp.qa.invalid TEST ONLY\r\n');let buffer='',inData=false;
  function receive(chunk){buffer+=chunk.toString('utf8');let end;
   while((end=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+2);
    if(inData){if(line==='.') {inData=false;seen.data++;socket.write('250 stored locally ONLY\r\n');}continue;}
    const command=line.split(' ')[0].toUpperCase();seen.commands.push({command,encrypted});
    if(command==='EHLO'||command==='HELO'){
     const upgrade=!encrypted&&mode!=='no-starttls'&&mode!=='implicit';
     socket.write('250-smtp.qa.invalid\r\n'+(upgrade?'250-STARTTLS\r\n':'')+'250 AUTH PLAIN\r\n');
    } else if(command==='STARTTLS'){
     if(mode==='no-starttls'||mode==='refuse-starttls'){socket.write('454 TLS unavailable\r\n');continue;}
     socket.removeListener('data',receive);socket.write('220 Begin TLS\r\n');
     const secure=new tls.TLSSocket(socket,{isServer:true,secureContext});seen.tlsUpgrades++;attach(secure,true,false);return;
    } else if(command==='AUTH'){
     if(encrypted)seen.secureAuth++;else seen.plainAuth++;
     socket.write(mode==='auth-reject'?'535 fixture SECRET token=REDACT_ME https://smtp.qa.invalid/private\r\n':'235 authenticated synthetic identity\r\n');
    } else if(command==='MAIL'){seen.mail++;socket.write('250 OK\r\n');}
    else if(command==='RCPT'||command==='RSET'||command==='NOOP')socket.write('250 OK\r\n');
    else if(command==='DATA'){inData=true;socket.write('354 end with dot\r\n');}
    else if(command==='QUIT'){socket.end('221 Bye\r\n');}
    else socket.write('500 Unsupported\r\n');
   }
  }
  socket.on('data',receive);
 }
 const server=mode==='implicit'?tls.createServer({key,cert,minVersion:'TLSv1.2'},s=>attach(s,true)):net.createServer(s=>attach(s,false));
 server.on('tlsClientError',()=>{});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return{port:server.address().port,seen,close:async()=>{for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}};
}

async function exercise(mode,{wrongName=false,untrusted=false,success=false}={}){
 const server=await smtpServer(mode),options=opcionesSmtp({host:'smtp.qa.invalid',port:mode==='implicit'?465:587,username:'qa@example.invalid',password:'synthetic-password-ONLY'});
 // Only destination/CA are test overrides; mandatory TLS, cert validation, timeouts
 // and AUTH configuration remain exactly as the production option builder returns.
 options.host='127.0.0.1';options.port=server.port;
 options.tls={...options.tls,...(!untrusted?{ca}:{}),servername:wrongName?'other.qa.invalid':'smtp.qa.invalid'};
 const transporter=nodemailer.createTransport(options);let result,error;
 try{
  try{result=await transporter.sendMail({from:'qa@example.invalid',to:'recipient@example.invalid',subject:'SYNTHETIC TEST ONLY',text:'Local fixture, not delivered externally.'});}catch(e){error=errorCorreoSeguro(e);}
  assert.equal(server.seen.plainAuth,0,'AUTH must never occur before TLS');
  if(success){assert.ok(result);assert.equal(error,undefined);assert.equal(server.seen.secureAuth,1);assert.equal(server.seen.mail,1);assert.equal(server.seen.data,1);}
  else{assert.ok(error);assert.equal(result,undefined);assert.equal(server.seen.mail,0);assert.equal(server.seen.data,0);assert.doesNotMatch(error.stack+JSON.stringify(error),/SECRET|REDACT_ME|https:|synthetic-password/);if(mode!=='auth-reject')assert.equal(server.seen.secureAuth,0);}
  results.push({mode,wrongName,untrusted,success,seen:server.seen,errorCode:error?.code});
 }finally{transporter.close();await server.close();}
}
test('real STARTTLS: encrypts then authenticates and accepts one local synthetic message',{timeout:30000},()=>exercise('starttls',{success:true}));
test('real SMTP without STARTTLS: rejects before AUTH or message',{timeout:30000},()=>exercise('no-starttls'));
test('real SMTP refusing STARTTLS: no opportunistic plaintext fallback',{timeout:30000},()=>exercise('refuse-starttls'));
test('real TLS trusted CA but wrong hostname: rejects before AUTH',{timeout:30000},()=>exercise('starttls',{wrongName:true}));
test('real TLS untrusted test CA: rejects before AUTH',{timeout:30000},()=>exercise('starttls',{untrusted:true}));
test('real implicit TLS (465 policy) still encrypts before AUTH',{timeout:30000},()=>exercise('implicit',{success:true}));
test('real SMTP auth error with sensitive response is sanitized',{timeout:30000},()=>exercise('auth-reject'));
test.after(()=>{fs.writeFileSync(fixture+'/result.json',JSON.stringify({at:new Date().toISOString(),localOnly:true,realProviderDelivery:false,fixturesRetained:true,nodemailerVersion:require('nodemailer/package.json').version,results},null,2));console.log('SMTP_QA_RETAINED='+fixture);});
