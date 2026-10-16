#!/usr/bin/env node
'use strict';
// One-shot acceptance test ONLY for a fresh portable local checkout.
// Creates synthetic account/service via real APIs; keeps data and never resets.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const demo=require('./local-demo.cjs');
const {ORIGIN}=require('../infra/local-demo/profile.cjs');
const EMAIL='admin.workspace@example.invalid';
function need(ok,code){if(!ok)throw Error(code);}
let stage='fresh_checkout';
let cookie;
async function call(route,method='GET',body,extra={}){
  return demo.request(route,{method,headers:{Origin:ORIGIN,...(cookie?{Cookie:cookie}:{}),
    ...(body?{'Content-Type':'application/json'}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
}
async function json(route,method,body,expected=200,extra){
  const r=await call(route,method,body,extra);need(r.status===expected,'API_STATUS_UNEXPECTED');
  const value=JSON.parse(r.body);need(value.ok===true,'API_NOT_OK');return value.data;
}
async function login(password){
  const r=await call('/api/auth/login','POST',{email:EMAIL,password});
  need(r.status===200&&JSON.parse(r.body).ok===true,'LOGIN_FAILED');
  const item=(r.headers['set-cookie']||[]).find(s=>s.startsWith('cyberaudit_token='));
  need(item&&/; Secure/i.test(item)&&/; HttpOnly/i.test(item),'SESSION_COOKIE_FAILED');
  cookie=item.split(';')[0];
  need((await call('/api/auth/session')).status===200,'SESSION_FAILED');
}
async function main(){
  need(process.argv.length===2,'NO_ARGUMENTS');
  need(!fs.existsSync(demo.RUNTIME),'QA_REQUIRES_FRESH_CHECKOUT');
  stage='start';
  const start=spawnSync(process.execPath,[path.join(__dirname,'local-demo.cjs'),'start'],
    {cwd:demo.ROOT,stdio:'inherit',timeout:1200000});
  need(start.status===0,'START_FAILED');
  demo.localDocker();demo.validateRuntime();demo.scope();
  await runAfterStartup();
}
async function runAfterStartup(){
  demo.validateRuntime();demo.scope();await demo.verify();
  stage='bootstrap';
  // Captured in memory: never write password, cookie or raw account output to report/log.
  const output=demo.c(['exec','-T','backend','node','scripts/integration/create-test-workspace.js']);
  const password=output.match(/Contraseña[^\n]*: (Nc9![A-Za-z0-9_-]+)\s*$/m)?.[1];
  need(password,'NEW_ACCOUNT_REQUIRED');
  stage='authenticated_workspace';
  await login(password);
  const organizations=(await json('/api/me/organizaciones')).organizaciones;
  need(organizations.length===1&&organizations[0].nombre==='Empresa de prueba - NormativaCheck'&&organizations[0].rol==='administrador','ORGANIZATION_FAILED');
  const org=organizations[0].id;
  const workspace=await call('/espacio-de-trabajo');
  need(workspace.status===200&&workspace.body.includes('<div id="root"'),'WORKSPACE_HTML_FAILED');
  stage='create_synthetic_service';
  const route='/api/organizaciones/'+org+'/subespacios';
  const service=await json(route,'POST',{nombre:'Servicio ficticio - ensayo de instalación',tipo:'servicio',
    descripcion:'Datos sintéticos para comprobar persistencia; no es una valoración normativa.'},201,
    {'Idempotency-Key':crypto.randomUUID()});
  need(service?.id&&service.nombre==='Servicio ficticio - ensayo de instalación','SERVICE_FAILED');
  need((await json(route+'/'+service.id)).id===service.id,'SERVICE_READ_FAILED');
  stage='restart_stop';
  demo.c(['stop'],{show:true});
  stage='restart_start';
  demo.c(['up','--detach','--wait','--wait-timeout','180'],{show:true,timeout:240000});
  stage='restart_https';
  await demo.verify();
  stage='restart_login';
  await login(password);
  stage='restart_data';
  const again=(await json('/api/me/organizaciones')).organizaciones;
  need(again.length===1&&again[0].id===org,'ORGANIZATION_NOT_PERSISTED');
  need((await json(route+'/'+service.id)).nombre===service.nombre,'SERVICE_NOT_PERSISTED');
  need((await call('/api/organizaciones/'+org+'/actividad')).status===200,'HISTORY_FAILED');
  stage='logout';
  need((await call('/api/auth/logout','POST',{})).status===200,'LOGOUT_FAILED');
  need((await call('/api/auth/session')).status===401,'LOGOUT_NOT_REVOKED');
  cookie=undefined;
  stage='complete';
  const report={status:'LOCAL_DEMO_REAL_DOCKER_API_PASSED',at:new Date().toISOString(),
    platform:process.platform,arch:process.arch,node:process.version,project:demo.PROJECT,origin:ORIGIN,
    checks:['HTTPS/CA/Host/origin','real login and secure cookie','organization membership','Workspace HTML (not browser rendering)',
      'create/read synthetic service through API','stop/start persistence','history accessible','logout revocation'],
    limitations:['No browser visual/E2E proof','No SMTP or Gmail','No production/VPS changes','Not a clean Git clone until integrated by repository owner'],
    resources:'RUNNING_DATA_RETAINED',passwordRetained:false};
  fs.writeFileSync(path.join(demo.RUNTIME,'qa-result.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(report.status);
  console.log('Informe sin secretos: '+path.join(demo.RUNTIME,'qa-result.json'));
  console.log('La cuenta de este ensayo no conserva contraseña. No repitas ni la restablezcas: utiliza otro clon para la demo interactiva.');
}
if(require.main===module)main().catch(error=>{
  const code=demo.safeCode(error,'QA_FAILED');
  console.error('LOCAL_DEMO_QA_INCOMPLETE stage='+stage+' code='+code+'. Datos conservados; no repetir ni resetear.');
  process.exitCode=1;
});
module.exports={runAfterStartup,getStage:()=>stage};
