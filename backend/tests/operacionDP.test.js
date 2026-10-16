'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { preparar } = require('../validation/operacion');
const { combinar } = require('../validation/contextoEmpresa');
const { obtenerContratoDP } = require('../validation/operacionDP');
const key = 'dp-e11-contrato-0001';
const hecho = (clave, valor) => ({ clave, estado: 'conocido', valor });
const alta = hechos => preparar({ nombre: 'SaaS ficticio', descripcion: 'Tratamiento de prueba', hechos, motivo: 'Prueba de contrato' }, false, key);
const rechaza = hechos => assert.throws(() => alta(hechos), e => e.codigo === 'DATOS_INVALIDOS');

test('tipos y enums se conservan sin coacción', () => {
  const hechos = [hecho('dp_rol','encargado'),hecho('dp_fase','residual'),hecho('rat_personas_empleadas',0),hecho('rat_art9',false)];
  assert.deepEqual(alta(hechos).hechos, hechos);
});
for (const [clave, valor] of [
  ['dp_rol',true],['dp_rol','administrador'],['dp_rol','responsable '],
  ['dp_fase',false],['dp_fase','cerrada'],['rat_personas_empleadas','3'],
  ['rat_personas_empleadas',-1],['rat_personas_empleadas',1.5],['rat_personas_empleadas',Number.MAX_SAFE_INTEGER+1],
  ['rat_art9','false'],['dp_ambito_rgpd',1],['rat_no_ocasional',null],['dp_entidad_privada','true']
]) test('rechaza tipo/valor inválido '+clave+' '+String(valor), () => rechaza([hecho(clave,valor)]));

test('unknown no lleva valor y conflicto conserva alternativas tipadas', () => {
  const hechos = [{clave:'rat_personas_empleadas',estado:'desconocido',motivo:'por_consultar'},
    {clave:'dp_rol',estado:'conflictivo',alternativas:[{valor:'responsable'},{valor:'encargado'}]}];
  assert.deepEqual(alta(hechos).hechos, hechos);
  rechaza([{...hechos[0],valor:0}]);
  rechaza([{...hechos[1],alternativas:[{valor:'responsable'},{valor:true}]}]);
});
test('PATCH valida nuevos hechos y no fuerza completar los omitidos', () => {
  const d=preparar({version:2,cambios:[hecho('dp_fase','finalizada')],motivo:'Declaración pendiente de contraste'},true,key);
  assert.equal(d.cambios[0].valor,'finalizada');
  assert.throws(()=>preparar({version:2,cambios:[hecho('dp_rol',false)],motivo:'X'},true,key),e=>e.codigo==='DATOS_INVALIDOS');
  assert.deepEqual(alta([]).hechos,[]);
});
test('roles de dos actividades no se heredan ni se fusionan', () => {
  const laboral=alta([hecho('dp_rol','responsable')]);
  const saas=alta([hecho('dp_rol','encargado')]);
  assert.equal(laboral.hechos[0].valor,'responsable');
  assert.equal(saas.hechos[0].valor,'encargado');
});
test('atribución del servidor e historia conservada al cambiar hechos', () => {
  const anterior=combinar([],alta([hecho('dp_rol','encargado')]).hechos,'a'.repeat(24));
  const copia=structuredClone(anterior);
  const siguiente=combinar(anterior,alta([hecho('dp_rol','responsable')]).hechos,'b'.repeat(24));
  assert.deepEqual(anterior,copia);
  assert.equal(siguiente[0].procedencia.referencia,'membresia:'+'b'.repeat(24));
});
test('contrato no compartido mutable ni promesa de aprobación o publicación', () => {
  const a=obtenerContratoDP();a.campos.find(x=>x.clave==='dp_ambito_rgpd').tipo='otro';
  const b=obtenerContratoDP();assert.equal(b.campos.find(x=>x.clave==='dp_ambito_rgpd').tipo,'booleano');
  assert.equal(b.cobertura.ratPersistido,'api_mongo_sintetico_verificado_no_publicado');
  assert.equal(b.cobertura.revisionFavorableAutomatica,false);
  assert.equal(b.limites.cuerpoHttpBytes,10240);
});
test('preguntas distinguen análisis pendiente de conclusión falsa', () => {
  const c=obtenerContratoDP();
  for(const clave of ['dp_ambito_rgpd','dp_regimen_general','rat_no_ocasional','rat_riesgo_derechos','rat_art9','rat_art10']) {
    const campo=c.campos.find(x=>x.clave===clave);
    assert.equal(campo.requiereAnalisis,true);
    assert.match(campo.ayuda,/desconocido/);
    const h={clave,estado:'desconocido',motivo:'por_consultar'};
    assert.deepEqual(alta([h]).hechos,[h]);
  }
});
test('riesgo posible se conserva, sin restricción a alto riesgo', () => {
  const c=obtenerContratoDP().campos.find(x=>x.clave==='rat_riesgo_derechos');
  assert.match(c.pregunta,/puede entrañar un riesgo/);
  assert.match(c.ayuda,/No se limita a alto riesgo/);
  assert.equal(alta([hecho(c.clave,true)]).hechos[0].valor,true);
});
test('España false y fase residual no se convierten en exclusión ni aprobación', () => {
  const h=[hecho('dp_establecimiento_es',false),hecho('dp_fase','residual')];
  const d=alta(h);assert.deepEqual(d.hechos,h);
  assert.equal(Object.hasOwn(d,'decision'),false);
  assert.equal(Object.hasOwn(d,'cumplimiento'),false);
});
test('no se resuelven discrepancias de entidad ni se activan exenciones en el contrato', () => {
  const a=alta([hecho('rat_personas_empleadas',249)]),b=alta([hecho('rat_personas_empleadas',250)]);
  assert.equal(a.hechos[0].valor,249);assert.equal(b.hechos[0].valor,250);
  const c=obtenerContratoDP();assert.equal(c.cobertura.evaluacionAutomatica,false);
  assert.match(c.avisos.at(-1),/fecha de referencia.*discrepancias/);
  // Esta prueba verifica solo el contrato; el agregador tiene pruebas independientes.
});

test('fecha factual de plantilla: fecha civil válida, no fecha técnica de alta',()=>{
 assert.equal(alta([hecho('rat_fecha_personas_empleadas','2026-10-16')]).hechos[0].valor,'2026-10-16');
 for(const date of ['2026-02-30','16/10/2026','2026-10-16T00:00:00.000Z',true])rechaza([hecho('rat_fecha_personas_empleadas',date)]);
});
