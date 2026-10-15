'use strict';
const https=require('node:https'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ca=fs.readFileSync(path.resolve(__dirname,'../../.runtime/integration/tls/ca.crt'));
function request(route, options={}) {
  return new Promise((resolve,reject)=>{
    const req=https.request('https://127.0.0.2:9443'+route,{ca,rejectUnauthorized:true,timeout:5000,...options},res=>{
      let body='';res.setEncoding('utf8');res.on('data',d=>body+=d);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
    });
    req.on('timeout',()=>req.destroy(Error('timeout')));req.on('error',reject);req.end(options.body);
  });
}
let stage='frontend';
(async()=>{
  const home=await request('/');
  assert.equal(home.status,200);assert.match(home.headers['content-type'],/text\/html/);
  assert.equal(home.headers['cache-control'],'no-store');
  assert.match(home.headers['content-security-policy'],/script-src 'self';/);
  stage='api';
  const health=await request('/api/health');
  assert.equal(health.status,200);assert.equal(JSON.parse(health.body).ok,true);
  stage='sesion_anonima';
  const session=await request('/api/auth/session');
  assert.equal(session.status,401);assert.match(session.headers['cache-control'],/no-store/);
  stage='origen_ajeno';
  const blocked=await request('/api/auth/login',{method:'POST',headers:{Origin:'https://otro.example','Content-Type':'application/json'},body:'{}'});
  assert.equal(blocked.status,403);
  stage='certificado_nombre_ajeno';
  await assert.rejects(request('/',{servername:'otro.example'}),{code:'ERR_TLS_CERT_ALTNAME_INVALID'});
  stage='host_ajeno';
  // Mantener TLS para la IP de destino; variar SOLO la cabecera HTTP Host.
  // SNI vacío es normal al conectar a una IP. rejectUnauthorized sigue activo.
  const wrongHost=await request('/',{servername:'',headers:{Host:'localhost:9443'}});
  assert.equal(wrongHost.status,421);
  console.log('OK HTTPS: CA y dirección verificadas, frontend, API/Mongo, sesión anónima rechazada, origen ajeno y Host incorrecto bloqueados.');
})().catch(error=>{
  const codes=['ERR_ASSERTION','ERR_TLS_CERT_ALTNAME_INVALID','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','ECONNREFUSED','ECONNRESET','ETIMEDOUT'];
  const code=codes.includes(error.code)?error.code:'NO_CLASIFICADO';
  console.error('Fallo HTTPS: etapa='+stage+' codigo='+code+'. La validación del certificado sigue activa.');process.exitCode=1;
});
