'use strict';
// Generates configuration in a NEW directory. Never starts Docker or reads secrets.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {validate,compose,unit}=require('../../infra/private/profile.cjs');
const {nginx}=require('../../infra/private/nginx-template.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function render(profile,output){
 validate(profile);
 if(!path.isAbsolute(output)||path.dirname(output)===output)throw Error('OUTPUT_ABSOLUTE_NEW_DIRECTORY');
 const parent=await fs.realpath(path.dirname(output));
 if(parent!==path.dirname(output))throw Error('OUTPUT_SYMLINK');
 await fs.mkdir(output,{mode:0o700}); // EEXIST is intentional: never overwrite an active profile.
 const files={
  'compose.yaml':JSON.stringify(compose(profile),null,2)+'\n',
  'nginx.conf':nginx(profile),
  'normativacheck-private.service':unit(profile),
  'profile.json':JSON.stringify(profile,null,2)+'\n'
 };
 const entries=[];
 for(const [name,content] of Object.entries(files)){
  await fs.writeFile(path.join(output,name),content,{flag:'wx',mode:0o644});
  entries.push({path:name,sha256:hash(content)});
 }
 const receipt={schema:1,status:'GENERATED_NOT_INSTALLED',files:entries,
  warning:'This is NOT an updater. Existing Mongo mounts, state and credentials must be preserved by a separately reviewed update plan.'};
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o644});
 return receipt;
}
async function main(){
 const [profileFile,output,...extra]=process.argv.slice(2);
 if(!profileFile||!output||extra.length)throw Error('USAGE: node scripts/private/render-profile.cjs PROFILE_JSON NEW_ABSOLUTE_DIRECTORY');
 const result=await render(JSON.parse(await fs.readFile(profileFile,'utf8')),output);
 console.log(JSON.stringify({status:result.status,files:result.files.length}));
}
if(require.main===module)main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
module.exports={render};
