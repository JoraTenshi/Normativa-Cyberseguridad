'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { opcionesQA, rutaBuildQA } = require('../scripts/normativa-qa-options');
test('QA conserva por defecto el recorrido precargado4282', () => {
  assert.deepEqual(opcionesQA(), { empty:false,smoke:false,port:4282,origin:'http://localhost:4282' });
});
test('empresa vacía queda separada en4284 y acepta smoke', () => {
  assert.deepEqual(opcionesQA(['--empty','--smoke']), { empty:true,smoke:true,port:4284,origin:'http://localhost:4284' });
  assert.equal(opcionesQA(['--smoke','--port=4284']).empty, false);
});
test('nuevo QA4286 exige vacío, no cambia origen ni permite ampliar duración', () => {
  assert.deepEqual(opcionesQA(['--empty','--port=4286']), {empty:true,smoke:false,port:4286,origin:'http://localhost:4286'});
  for (const args of [['--port=4286'],['--empty','--port=4286','--port=4286'],['--empty','--minutes=90']]) assert.throws(()=>opcionesQA(args));
});
test('build corregido y anterior se admiten solo en directorio temporal directo', () => {
  const normal='/home/kali/Documents/practica3/normativa_integracion/frontend/build';
  for (const build of [normal,'/tmp/norm-c2-front-build.mYj6CI','/tmp/norm-c2-front-fix.JGHiOa']) assert.equal(rutaBuildQA(build,normal),build);
  for (const build of ['/tmp/norm-c2-front-fix.JGHiOa/sub','/tmp/norm-c2-front-fix.JGHiOa/../real','/tmp/norm-c2-front-fix.','/tmp/otro','/var/tmp/norm-c2-front-fix.JGHiOa','/home/kali/Documents/practica3/normativa_check/frontend/build']) assert.throws(()=>rutaBuildQA(build,normal));
});
test('no expone host ni admite puertos habituales, desconocidos o duplicados', () => {
  for (const args of [ ['--empty','--port=4282'],['--host=0.0.0.0'],['--port=9443'],['--port=4192'],['--port=04284'],['--port=4283'],['--smoke','--smoke'],['--port=4282','--port=4284'],['--uri=mongodb://localhost'],['--empty=true'] ]) {
    assert.throws(() => opcionesQA(args));
  }
});
