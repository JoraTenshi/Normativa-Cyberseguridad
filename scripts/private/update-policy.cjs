'use strict';
// PURE POLICY ONLY. No Docker, shell, secrets, database reads or deployment.
const assert=require('node:assert/strict');
const {validate,compose,PROJECT}=require('../../infra/private/profile.cjs');
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
function check(ok,code){if(!ok)throw Object.assign(Error(code),{code});}
function same(a,b,code){try{assert.deepEqual(a,b);}catch{check(false,code);}}
function buildPlan({currentProfile,nextProfile,currentCompose,images,compatibility,privatePortTransition}){
 const old=validate(currentProfile),next=validate(nextProfile);
 check(old.releaseRoot!==next.releaseRoot,'RELEASE_MUST_BE_NEW');
 same([old.stateRoot,old.wireguardUnit,old.smtpMode],
      [next.stateRoot,next.wireguardUnit,next.smtpMode],'STATE_OR_NETWORK_OR_MAIL_CHANGE');
 // Only the explicit requested private 9443 -> 8443 transition is supported.
 // This descriptor is NOT proof of human authorization, a free port or live TLS.
 // The operator must independently verify those before any mutation.
 if(old.port!==next.port){
  check(old.port===9443&&next.port===8443,'STATE_OR_NETWORK_OR_MAIL_CHANGE');
  same(privatePortTransition,{fromOrigin:old.origin,toOrigin:next.origin},'EXPLICIT_PRIVATE_PORT_TRANSITION_REQUIRED');
 }else check(privatePortTransition===undefined,'UNEXPECTED_PORT_TRANSITION');
 // Drift in the inspected effective configuration must be investigated, not overwritten.
 same(currentCompose,compose(currentProfile),'CURRENT_CONFIG_DRIFT');
 check(images&&Object.keys(images).sort().join(',')==='backend,web'&&
  Object.values(images).every(x=>/^sha256:[a-f0-9]{64}$/.test(x)),'IMMUTABLE_IMAGE_IDS');
 check(compatibility?.schema===1&&sha(compatibility.baselineManifestSha256)&&sha(compatibility.targetSourceSha256), 'COMPATIBILITY_RECEIPT');
 check(compatibility.modelsAndIndexesUnchanged===true&&compatibility.runtimeSecretsUnchanged===true,'MIGRATION_REQUIRES_SEPARATE_PLAN');
 check(sha(compatibility.oldCatalogSha256)&&sha(compatibility.newCatalogSha256),'CATALOG_IDENTITY');
 const config=compose(nextProfile);
 // Updating apps must not implicitly recreate Mongo or change its mounted /private.
 config.services.mongodb=structuredClone(currentCompose.services.mongodb);
 for(const service of ['backend','web']){
  delete config.services[service].build;
  config.services[service].image=images[service];
 }
 same(config.secrets,currentCompose.secrets,'SECRET_PATH_DRIFT');
 same(config.volumes,currentCompose.volumes,'VOLUME_DRIFT');
 same(config.networks,currentCompose.networks,'NETWORK_DRIFT');
 return {schema:1,status:'PLAN_ONLY_NOT_DEPLOYED',project:PROJECT,config,
  retainedRelease:old.releaseRoot,
  retainedReason:'Mongo /private still references this release; retain until a separately tested configuration relocation.',
  compatibility:structuredClone(compatibility),
  ...(privatePortTransition?{privatePortTransition:structuredClone(privatePortTransition)}:{}),
  activationArgs:['up','--detach','--no-deps','--no-build','--pull','never','--wait','--wait-timeout','180','backend','web'],
  automaticRollbackAllowed:false};
}
function validateSnapshot(s){
 check(s?.database==='nc_private'&&s.replica==='nc-private-rs'&&Array.isArray(s.collections),'SNAPSHOT_TARGET');
 const names=new Set();
 for(const c of s.collections){
  check(typeof c.name==='string'&&c.name.length>0&&!names.has(c.name)&&Number.isSafeInteger(c.count)&&c.count>=0&&
   sha(c.contentSha256)&&sha(c.indexSha256)&&sha(c.optionsSha256),'SNAPSHOT_FORMAT');names.add(c.name);
 }
 return [...s.collections].sort((a,b)=>a.name.localeCompare(b.name));
}
function activationGate({plan,maintenanceConfirmed,oldContainerIdentityUnchanged,backup,before,restored,current}){
 check(plan?.schema===1&&plan.status==='PLAN_ONLY_NOT_DEPLOYED','PLAN_REQUIRED');
 check(maintenanceConfirmed===true&&oldContainerIdentityUnchanged===true,'WINDOW_OR_IDENTITY');
 check(backup?.private===true&&backup.exclusive===true&&backup.restoreVerified===true&&backup.custodyConfirmed===true&&
  sha(backup.sha256)&&Number.isSafeInteger(backup.bytes)&&backup.bytes>0,'RECOVERABLE_BACKUP_REQUIRED');
 const snapshot=validateSnapshot(before);
 same(snapshot,validateSnapshot(restored),'RESTORE_NOT_EXACT');
 same(snapshot,validateSnapshot(current),'WRITES_DURING_BACKUP');
 return {allowed:true,note:'Policy gate only; not evidence that an adapter performed any operation.'};
}
function codeRollbackGate({compatibility,before,current}){
 check(compatibility?.modelsAndIndexesUnchanged===true&&compatibility.runtimeSecretsUnchanged===true,'ROLLBACK_SCHEMA_OR_SECRET_CHANGE');
 check(sha(compatibility.oldCatalogSha256)&&compatibility.oldCatalogSha256===compatibility.newCatalogSha256,'ROLLBACK_CATALOG_CHANGED');
 same(validateSnapshot(before),validateSnapshot(current),'ROLLBACK_DATA_CHANGED');
 return {allowed:true,dataRestore:false};
}
module.exports={buildPlan,activationGate,codeRollbackGate,validateSnapshot};
