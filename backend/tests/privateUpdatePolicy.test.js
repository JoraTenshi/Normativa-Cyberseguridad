'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {compose}=require('../../infra/private/profile.cjs');
const {buildPlan,activationGate,codeRollbackGate}=require('../../scripts/private/update-policy.cjs');
const old={releaseRoot:'/srv/normativacheck/releases/old',stateRoot:'/srv/normativacheck/state',port:9443,smtpMode:'disabled',wireguardUnit:'wg-quick@wg0.service'},next={...old,releaseRoot:'/srv/normativacheck/releases/new'};
const h='a'.repeat(64),j='b'.repeat(64);
const compatibility={schema:1,baselineManifestSha256:h,targetSourceSha256:j,modelsAndIndexesUnchanged:true,runtimeSecretsUnchanged:true,oldCatalogSha256:h,newCatalogSha256:j};
const input=()=>({currentProfile:old,nextProfile:next,currentCompose:compose(old),images:{backend:'sha256:'+h,web:'sha256:'+j},compatibility});
const snapshot=()=>({database:'nc_private',replica:'nc-private-rs',collections:[{name:'usuarios',count:1,contentSha256:h,indexSha256:h,optionsSha256:h}]});
const gate=()=>({plan:buildPlan(input()),maintenanceConfirmed:true,oldContainerIdentityUnchanged:true,backup:{private:true,exclusive:true,restoreVerified:true,custodyConfirmed:true,sha256:h,bytes:300},before:snapshot(),restored:snapshot(),current:snapshot()});
const transition={fromOrigin:'https://10.77.77.1:9443',toOrigin:'https://10.77.77.1:8443'};
const portInput=()=>({...input(),nextProfile:{...next,port:8443},privatePortTransition:{...transition}});

test('explicit private 9443 to 8443 preserves full Mongo and all persistent state',()=>{
 const i=portInput(),before=structuredClone(i),plan=buildPlan(i);
 assert.deepEqual(i,before);assert.deepEqual(plan.privatePortTransition,transition);
 for(const key of ['secrets','volumes','networks'])assert.deepEqual(plan.config[key],i.currentCompose[key]);
 assert.deepEqual(plan.config.services.mongodb,i.currentCompose.services.mongodb);
 assert.deepEqual(plan.config.services.web.ports,[{target:8443,published:'8443',host_ip:'10.77.77.1',protocol:'tcp'}]);
 assert.equal(plan.config.services.backend.environment.CORS_ORIGIN,transition.toOrigin);
 assert.equal(plan.config.services.backend.environment.APP_URL,transition.toOrigin);
 assert.equal(plan.config.services.backend.environment.NC_HTTPS_ORIGIN,transition.toOrigin);
 assert.equal(plan.config.services.backend.ports,undefined);assert.equal(plan.config.services.mongodb.ports,undefined);
});

test('8443 cannot be switched silently or with an approximate transition descriptor',()=>{
 for(const t of [undefined,null,true,{}, {...transition,toOrigin:'https://0.0.0.0:8443'}, {...transition,fromOrigin:'https://10.77.77.1'}, {...transition,approved:true}])assert.throws(()=>buildPlan({...portInput(),privatePortTransition:t}),/EXPLICIT_PRIVATE_PORT_TRANSITION_REQUIRED/);
 assert.throws(()=>buildPlan({...input(),privatePortTransition:transition}),/UNEXPECTED_PORT_TRANSITION/);
});

test('transition does not bypass original config drift or publish other services',()=>{
 for(const mutate of [i=>i.currentCompose.services.web.ports[0].host_ip='0.0.0.0',i=>i.currentCompose.services.mongodb.ports=['27017:27017'],i=>i.currentCompose.services.backend.ports=['5000:5000']]){
  const i=portInput();mutate(i);assert.throws(()=>buildPlan(i),/CURRENT_CONFIG_DRIFT/);
 }
});

test('transition never admits CAT model changes, secret rotation or other changes',()=>{
 for(const key of ['modelsAndIndexesUnchanged','runtimeSecretsUnchanged'])assert.throws(()=>buildPlan({...portInput(),compatibility:{...compatibility,[key]:false}}),/MIGRATION_REQUIRES_SEPARATE_PLAN/);
 for(const delta of [{smtpMode:'smtp465'},{stateRoot:'/srv/other/state'},{wireguardUnit:'wg-quick@wg1.service'},{port:443}])assert.throws(()=>buildPlan({...portInput(),nextProfile:{...next,port:8443,...delta}}),/STATE_OR_NETWORK_OR_MAIL_CHANGE/);
});
test('plan preserves exact Mongo mount, secrets, volumes and networks',()=>{const i=input(),p=buildPlan(i);assert.deepEqual(p.config.services.mongodb,i.currentCompose.services.mongodb);assert.deepEqual(p.config.secrets,i.currentCompose.secrets);assert.equal(p.retainedRelease,old.releaseRoot);assert.equal(p.automaticRollbackAllowed,false);});
test('activation targets backend/web only, immutable and no dependencies',()=>{const p=buildPlan(input());assert.equal(p.config.services.backend.build,undefined);assert.equal(p.config.services.web.build,undefined);assert.deepEqual(p.activationArgs.slice(-2),['backend','web']);for(const term of ['--no-deps','--no-build','never'])assert.ok(p.activationArgs.includes(term));});
test('profile drift does not silently rewrite configuration',()=>{const i=input();i.currentCompose.services.mongodb.volumes[0]='other:/data/db';assert.throws(()=>buildPlan(i),/CURRENT_CONFIG_DRIFT/);});
test('rejects same release',()=>assert.throws(()=>buildPlan({...input(),nextProfile:old}),/RELEASE_MUST_BE_NEW/));
test('rejects concurrent SMTP, state, port and WireGuard changes',()=>{for(const delta of [{smtpMode:'smtp465'},{stateRoot:'/srv/other/state'},{port:443},{wireguardUnit:'wg-quick@wg1.service'}])assert.throws(()=>buildPlan({...input(),nextProfile:{...next,...delta}}),/STATE_OR_NETWORK_OR_MAIL_CHANGE/);});
test('requires immutable image IDs not tags',()=>assert.throws(()=>buildPlan({...input(),images:{backend:'backend:latest',web:'sha256:'+h}}),/IMMUTABLE_IMAGE_IDS/));
test('schema change requires separately reviewed migration',()=>assert.throws(()=>buildPlan({...input(),compatibility:{...compatibility,modelsAndIndexesUnchanged:false}}),/MIGRATION_REQUIRES_SEPARATE_PLAN/));
test('secret rotation cannot hide in app update',()=>assert.throws(()=>buildPlan({...input(),compatibility:{...compatibility,runtimeSecretsUnchanged:false}}),/MIGRATION_REQUIRES_SEPARATE_PLAN/));
test('gate accepts exact tested backup, but is only a policy decision',()=>assert.equal(activationGate(gate()).allowed,true));
test('window and old identity must be confirmed',()=>{for(const k of ['maintenanceConfirmed','oldContainerIdentityUnchanged'])assert.throws(()=>activationGate({...gate(),[k]:false}),/WINDOW_OR_IDENTITY/);});
test('backup restore and custody cannot be skipped',()=>{for(const k of ['private','exclusive','restoreVerified','custodyConfirmed']){const g=gate();g.backup[k]=false;assert.throws(()=>activationGate(g),/RECOVERABLE_BACKUP_REQUIRED/);}});
test('restored content, indexes and options must match',()=>{for(const k of ['contentSha256','indexSha256','optionsSha256']){const g=gate();g.restored.collections[0][k]=j;assert.throws(()=>activationGate(g),/RESTORE_NOT_EXACT/);}});
test('writes during backup reject activation',()=>{const g=gate();g.current.collections[0].count++;assert.throws(()=>activationGate(g),/WRITES_DURING_BACKUP/);});
test('snapshot from another database is rejected',()=>{const g=gate();g.current.database='cybersec_audit';assert.throws(()=>activationGate(g),/SNAPSHOT_TARGET/);});
test('duplicate collections rejected',()=>{const g=gate();g.restored.collections.push({...g.restored.collections[0]});assert.throws(()=>activationGate(g),/SNAPSHOT_FORMAT/);});
test('rollback to pre-ENS catalog is denied even with same models',()=>assert.throws(()=>codeRollbackGate({compatibility,before:snapshot(),current:snapshot()}),/ROLLBACK_CATALOG_CHANGED/));
test('compatible code rollback never restores data',()=>assert.deepEqual(codeRollbackGate({compatibility:{...compatibility,newCatalogSha256:h},before:snapshot(),current:snapshot()}),{allowed:true,dataRestore:false}));
test('even a session write blocks proposed code rollback',()=>{const s=snapshot();s.collections[0].contentSha256=j;assert.throws(()=>codeRollbackGate({compatibility:{...compatibility,newCatalogSha256:h},before:snapshot(),current:s}),/ROLLBACK_DATA_CHANGED/);});
