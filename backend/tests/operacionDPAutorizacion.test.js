'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const M = require('../models/Membresia'), O = require('../models/Organizacion');
const { consultarContratoDP } = require('../services/operaciones');
const usuarioId='a'.repeat(24), organizacionId='b'.repeat(24), mid='c'.repeat(24);
const consulta = value => ({select(){return this;},read(){return this;},limit(){return this;},lean:async()=>value});

for (const rol of ['administrador','colaborador','consulta']) {
  test('contrato respeta permiso existente '+rol, async t => {
    t.mock.method(M,'find',q=>{
      assert.deepEqual(q,{usuario:usuarioId,organizacion:organizacionId});
      return consulta([{_id:mid,usuario:usuarioId,organizacion:organizacionId,rol,estado:'activa'}]);
    });
    t.mock.method(O,'findById',q=>{assert.equal(q,organizacionId);return consulta({_id:organizacionId,estado:'activa'});});
    const accion=consultarContratoDP({usuarioId,organizacionId});
    if(rol==='administrador') assert.equal((await accion).id,'OPERACION_DP_E11');
    else await assert.rejects(accion,e=>e.codigo==='GESTION_DENEGADA');
  });
}
test('otra organización no recibe el contrato a través de esta ruta organizativa', async t=>{
  t.mock.method(M,'find',()=>consulta([{_id:mid,usuario:usuarioId,organizacion:'d'.repeat(24),rol:'administrador',estado:'activa'}]));
  await assert.rejects(consultarContratoDP({usuarioId,organizacionId}),e=>e.codigo==='ACCESO_ORGANIZACION_DENEGADO');
});
test('revocación entre lecturas invalida la entrega del contrato', async t=>{
  let n=0;
  t.mock.method(M,'find',()=>consulta([{_id:mid,usuario:usuarioId,organizacion:organizacionId,rol:'administrador',estado:++n===1?'activa':'revocada'}]));
  t.mock.method(O,'findById',()=>consulta({_id:organizacionId,estado:'activa'}));
  await assert.rejects(consultarContratoDP({usuarioId,organizacionId}),e=>e.codigo==='ACCESO_ORGANIZACION_DENEGADO');
  assert.equal(n,2);
});
test('fallo de lectura de membresía falla cerrado', async t=>{
  t.mock.method(M,'find',()=>{throw Error('DB_NO_DISPONIBLE');});
  await assert.rejects(consultarContratoDP({usuarioId,organizacionId}),e=>e.codigo==='CONTEXTO_NO_DISPONIBLE');
});
