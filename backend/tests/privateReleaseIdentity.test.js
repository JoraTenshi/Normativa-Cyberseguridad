'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {seal,verify,metadata}=require('../../scripts/private/release-identity.cjs');
const {render}=require('../../scripts/private/render-profile.cjs');
const m={candidate:'green-test-r1',commit:'a'.repeat(40),sourceSha256:'b'.repeat(64)};
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'nc-identity-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));for(const [name,content]of Object.entries({'index.html':'test','main.js':'test js','main.css':'test css'}))await fs.writeFile(path.join(root,name),content);return root;}
test('public identity only contains whitelisted metadata and file hashes',async t=>{const root=await fixture(t),r=await seal(root,m);assert.equal(r.files.length,3);assert.deepEqual(await verify(root),r);assert.ok(!JSON.stringify(r).includes(root));});
test('metadata cannot leak paths or secrets',()=>{assert.throws(()=>metadata({...m,stateRoot:'/srv/state'}));assert.throws(()=>metadata({...m,password:'secret'}));assert.throws(()=>metadata({...m,candidate:'../bad'}));});
test('sealed build cannot be overwritten',async t=>{const root=await fixture(t);await seal(root,m);await assert.rejects(()=>seal(root,m),{code:'EEXIST'});});
test('changed bundle is detected',async t=>{const root=await fixture(t);await seal(root,m);await fs.writeFile(path.join(root,'main.js'),'changed');await assert.rejects(()=>verify(root),/BUILD_CHANGED/);});
test('extra served file is detected',async t=>{const root=await fixture(t);await seal(root,m);await fs.writeFile(path.join(root,'extra.js'),'new');await assert.rejects(()=>verify(root),/BUILD_CHANGED/);});
test('build secret-like paths are rejected',async t=>{const root=await fixture(t);await fs.writeFile(path.join(root,'.env'),'test fixture');await assert.rejects(()=>seal(root,m),/UNSAFE_BUILD_FILE/);});
test('source maps excluded from public identity (nginx blocks them)',async t=>{const root=await fixture(t);await fs.writeFile(path.join(root,'main.js.map'),'test');assert.equal((await seal(root,m)).files.length,3);});
test('profile generation is exclusive and produces no state',async t=>{const root=await fixture(t),out=path.join(root,'configuration');const p={releaseRoot:'/srv/normativacheck/releases/green',stateRoot:'/srv/normativacheck/state',port:9443,smtpMode:'disabled',wireguardUnit:'wg-quick@wg0.service'};const r=await render(p,out);assert.equal(r.status,'GENERATED_NOT_INSTALLED');assert.deepEqual((await fs.readdir(out)).sort(),['compose.yaml','manifest.json','nginx.conf','normativacheck-private.service','profile.json']);await assert.rejects(()=>render(p,out),{code:'EEXIST'});});
