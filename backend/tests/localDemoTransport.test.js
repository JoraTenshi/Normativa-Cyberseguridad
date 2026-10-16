'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'scripts/local-demo.cjs');
function fixture(kind='ok'){
  const calls=[];
  const fakeHttps={request(url,options,callback){
    calls.push({url,options});
    const req=new EventEmitter();
    req.destroy=error=>req.emit('error',error);
    req.end=()=>queueMicrotask(()=>{
      if(kind==='reset'){req.emit('error',Object.assign(Error('socket hang up'),{code:'ECONNRESET'}));return;}
      const res=new EventEmitter();res.statusCode=200;res.headers={};res.setEncoding=()=>{};callback(res);
      if(kind==='aborted'){res.emit('aborted');return;}
      res.emit('data','{"ok":true}');res.emit('end');
    });
    return req;
  }};
  const localRequire=name=>name==='node:https'?fakeHttps:name==='node:fs'?{...fs,readFileSync:()=>Buffer.from('PUBLIC_TEST_CA')}:
    name==='../infra/local-demo/profile.cjs'?require('../../infra/local-demo/profile.cjs'):require(name);
  const sandbox={require:localRequire,module:{exports:{}},__dirname:path.dirname(file),process,console,Buffer,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
  return {api:sandbox.module.exports,calls};
}
test('each HTTPS probe disables pooled connections and retains certificate checking',async()=>{
  const {api,calls}=fixture();await api.request('/api/health');await api.request('/api/health',{agent:{keepAlive:true}});
  assert.equal(calls.length,2);
  for(const {options} of calls){assert.equal(options.agent,false);assert.equal(options.rejectUnauthorized,true);assert.equal(options.timeout,10000);}
});
test('transport reset keeps machine-readable code without leaking message',async()=>{
  const {api}=fixture('reset');await assert.rejects(api.request('/api/health'),{code:'ECONNRESET'});
  assert.equal(api.safeCode({code:'ECONNRESET',message:'secret URL'}),'ECONNRESET');
  assert.equal(api.safeCode({code:'unexpected private value',message:'mongodb://user:secret@host'}),'LOCAL_DEMO_FAILED');
});
test('aborted HTTPS response rejects instead of leaving pending promise',async()=>{
  const {api}=fixture('aborted');await assert.rejects(api.request('/api/health'),/HTTPS_RESPONSE_ABORTED/);
});
