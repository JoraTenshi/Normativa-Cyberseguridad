'use strict';
// Public, non-sensitive build identity. Never includes local paths or secrets.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const check=(v,c)=>{if(!v)throw Error(c);};
function metadata(m){
 check(m&&Object.keys(m).sort().join(',')==='candidate,commit,sourceSha256','IDENTITY_KEYS');
 check(/^[a-z0-9][a-z0-9-]{1,79}$/.test(m.candidate),'CANDIDATE');
 check(/^[a-f0-9]{40}$/.test(m.commit)&&/^[a-f0-9]{64}$/.test(m.sourceSha256),'SOURCE_IDENTITY');
 return m;
}
async function inventory(root){
 root=path.resolve(root);check(await fs.realpath(root)===root,'BUILD_SYMLINK');
 const files=[];
 async function walk(dir,rel=''){
  for(const e of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   const r=rel?rel+'/'+e.name:e.name;
   check(!e.isSymbolicLink(),'BUILD_SYMLINK');
   check(!e.name.startsWith('.')&&!/[\\\r\n\0?#%]/.test(e.name)&&!/\.(key|pem|p12|pfx|bson|dump)$/i.test(e.name),'UNSAFE_BUILD_FILE');
   if(e.isDirectory())await walk(path.join(dir,e.name),r);
   else {check(e.isFile(),'BUILD_FILE_TYPE');if(r==='release.json'||r.endsWith('.map'))continue;
    files.push({path:r,sha256:sha(await fs.readFile(path.join(dir,e.name)))});
   }
  }
 }
 await walk(root);check(files.length>0&&files.length<=1000&&files.some(x=>x.path==='index.html'),'BUILD_INDEX');
 check(files.some(x=>x.path.endsWith('.js'))&&files.some(x=>x.path.endsWith('.css')),'BUILD_ASSETS');
 return files.sort((a,b)=>a.path.localeCompare(b.path));
}
async function seal(root,m){
 metadata(m);const result={schema:1,...m,files:await inventory(root)};
 await fs.writeFile(path.join(root,'release.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o644});
 return result;
}
async function verify(root){
 const r=JSON.parse(await fs.readFile(path.join(root,'release.json'),'utf8'));
 check(Object.keys(r).sort().join(',')==='candidate,commit,files,schema,sourceSha256'&&r.schema===1,'RELEASE_SCHEMA');
 metadata({candidate:r.candidate,commit:r.commit,sourceSha256:r.sourceSha256});
 check(JSON.stringify(r.files)===JSON.stringify(await inventory(root)),'BUILD_CHANGED');return r;
}
async function main(){
 const [mode,root,metaFile,...extra]=process.argv.slice(2);
 check(root&&!extra.length&&((mode==='seal'&&metaFile)||(mode==='verify'&&!metaFile)),'USAGE_SEAL_BUILD_METADATA_OR_VERIFY_BUILD');
 const r=mode==='seal'?await seal(root,JSON.parse(await fs.readFile(metaFile,'utf8'))):await verify(root);
 console.log(JSON.stringify({status:mode==='seal'?'SEALED_NOT_DEPLOYED':'BUILD_IDENTITY_MATCH',candidate:r.candidate,files:r.files.length}));
}
if(require.main===module)main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
module.exports={metadata,inventory,seal,verify};
