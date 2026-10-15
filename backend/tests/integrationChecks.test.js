'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const fs=require('node:fs'),path=require('node:path');
const script=fs.readFileSync(path.resolve(__dirname,'../../infra/integration/mongo-check.js'),'utf8');
// Doble de mongosh para comprobar el SCRIPT, no para acreditar transacciones reales.
function check(options={}) {
  const docs=new Map(),lines=[];let staged=[],created=false,closed=false,exit=0;
  const probe={
    findOne({ _id }) { return docs.get(_id); },
    deleteOne({ _id }) { if(options.cleanupFails)throw Error('sensitive-password');docs.delete(_id); }
  };
  const target=new Proxy({
    auth(){return !options.authFails;},
    getCollectionNames(){return [];},
    createCollection(name){assert.equal(name,'_integration_probe');created=true;},
    getCollection(name){assert.equal(name,'_integration_probe');return probe;}
  },{get(object,key){if(String(key).startsWith('_'))throw TypeError('propiedad interna mongosh');return object[key];}});
  function Mongo(){
    return {
      getDB(name){
        if(name==='nc_integracion')return target;
        assert.equal(name,'admin');
        return {getCollection(){return {findOne(){
          if(options.adminAllowed)return null;
          throw Object.assign(Error('sensitive-password'),{code:13});
        }};}};
      },
      startSession(){return {
        getDatabase(name){assert.equal(name,'nc_integracion');return {getCollection(){return {insertOne(doc){staged.push(doc);}};}};},
        startTransaction(){staged=[];},
        commitTransaction(){if(!options.commitLost)for(const doc of staged)docs.set(doc._id,doc);staged=[];},
        abortTransaction(){if(options.abortPersists)for(const doc of staged)docs.set(doc._id,doc);staged=[];},
        endSession(){closed=true;}
      };}
    };
  }
  const stop={};
  try{
    vm.runInNewContext(script,{
      require(name){assert.equal(name,'fs');return {readFileSync(){return 'a'.repeat(64);}};},
      Mongo,ObjectId:function ObjectId(){},print(text){lines.push(text);},
      quit(code){exit=code;throw stop;}
    },{timeout:1000});
  }catch(e){if(e!==stop)throw e;}
  assert.doesNotMatch(lines.join('\n'),/sensitive-password|a{64}/);
  return {exit,lines,docs,created,closed};
}
test('comprobador Mongo: getCollection, commit/abort y limpieza de su propio marcador',()=>{
  const r=check();assert.equal(r.exit,0);assert.equal(r.docs.size,0);assert.ok(r.created&&r.closed);assert.match(r.lines[0],/^OK Mongo/);
});
for(const [option,stage] of [
  ['authFails','autenticacion'],['adminAllowed','aislamiento'],['commitLost','verificar_commit'],
  ['abortPersists','verificar_abort'],['cleanupFails','limpieza_tecnica']
])test('comprobador Mongo: rechaza '+option+' sin ocultar la etapa',()=>{
  const r=check({[option]:true});assert.equal(r.exit,1);assert.match(r.lines[0],new RegExp('etapa='+stage+' '));
});
