'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {guardiaCaducidad}=require('../scripts/run-workspace-demo');
for(const [nombre,ahora,permitido] of [
 ['antes del límite',999,true],['justo al caducar',1000,false],['salto de reloj tras suspensión',500000,false]
]) test('Laboratorio: '+nombre,()=>{
 let next=false,status=null,body=null;
 const res={status(n){status=n;return this;},json(v){body=v;return this;}};
 guardiaCaducidad(new Date(1000),()=>ahora)({},res,()=>{next=true;});
 assert.equal(next,permitido);
 assert.equal(status,permitido?null:503);
 if(!permitido) assert.equal(body.codigo,'LABORATORIO_CADUCADO');
});
