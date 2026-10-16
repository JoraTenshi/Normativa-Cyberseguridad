'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validar,contrato}=require('../validation/registroRAT'),{diagnosticarRAT}=require('../services/evaluacionRAT');
const {ref,campo,registro,operacion}=require('./fixtures/registroRAT');
const diag=(c,ops,per=ops,total=per.length,all=per)=>diagnosticarRAT(c,ops,per,total,all);
test('RAT funciones separadas, clientes con categorías y contactos',()=>{
 for(const f of ['responsable','encargado'])assert.deepEqual(validar('registro_rat',registro(f)),registro(f));
 const d=registro('encargado');d.entradas[0].responsables=['Solo nombre'];assert.throws(()=>validar('registro_rat',d));
});
test('campos condicionales motivados no equivalen a un hueco aprobado',()=>{
 const d=registro();d.entradas[0].campos.supresion=campo('imposible_motivado');validar('registro_rat',d);
 d.entradas[0].campos.finalidades=campo('no_corresponde');assert.throws(()=>validar('registro_rat',d));
 d.entradas[0].campos.finalidades=campo();d.dpd={estado:'no_corresponde',contenido:'',motivo:''};assert.throws(()=>validar('registro_rat',d));
});
test('rechazo de claves arbitrarias, IDs duplicados, versión y entrada falsificada',()=>{
 for(const change of [d=>d.aprobado=true,d=>d.version=1,d=>d.entradas.push(structuredClone(d.entradas[0])),d=>d.entradas[0].operaciones[0].sha256='x',d=>d.entradas[0].id='__proto__']){const d=registro();change(d);assert.throws(()=>validar('registro_rat',d));}
 const d=registro();d.version=1;validar('registro_rat',d,true);
});
test('datos incompletos pueden guardarse como borrador sin favorable',()=>{
 const d=registro();d.entradas=[];d.inventarioCompleto=false;validar('registro_rat',d);
 const r=diag(d,[],[operacion()]);assert.equal(r.permiteRevisionFavorable,false);assert.deepEqual(r.omitidas,[ref('b').id]);
});
test('inclusión decisiva no se bloquea por hechos no decisivos pendientes',()=>{
 const o=operacion('b',{rat_riesgo_derechos:undefined,rat_personas_empleadas:undefined,rat_fecha_personas_empleadas:undefined});
 const r=diag(registro(),[o]);assert.equal(r.actividades[0].estado,'actual_incluir');assert.ok(r.actividades[0].pendientes.length);assert.equal(r.permiteRevisionFavorable,true);assert.equal(r.cumplimientoGlobal,null);
});
test('249/250 y cuatro causas descartadas: exención propuesta frente inclusión',()=>{
 assert.equal(diag(registro(),[operacion('b',{rat_personas_empleadas:249,rat_no_ocasional:false})]).actividades[0].estado,'exencion_propuesta');
 assert.equal(diag(registro(),[operacion('b',{rat_personas_empleadas:250,rat_no_ocasional:false})]).actividades[0].estado,'actual_incluir');
});
test('N3 contradicción misma entidad/fecha bloquea exención, no motivo positivo',()=>{
 const other=operacion('c',{rat_personas_empleadas:250,dp_rol:'encargado'});
 let o=operacion('b',{rat_no_ocasional:false});let r=diag(registro(),[o],[o],2,[o,other]);assert.equal(r.actividades[0].estado,'pendiente');assert.equal(r.permiteRevisionFavorable,false);
 o=operacion();r=diag(registro(),[o],[o],2,[o,other]);assert.equal(r.actividades[0].estado,'actual_incluir');assert.equal(r.permiteRevisionFavorable,true);assert.equal(r.fechasDiscrepantes.length,1);
});
test('fecha distinta o ausente no habilita exención ni hereda plantilla ajena',()=>{
 for(const date of [undefined,'2026-10-15'])assert.equal(diag(registro(),[operacion('b',{rat_no_ocasional:false,rat_fecha_personas_empleadas:date})]).actividades[0].estado,'pendiente');
});
test('límite 200 no se presenta como completitud; 201 bloquea exención',()=>{
 const c=registro(),o=operacion('b',{rat_no_ocasional:false});
 assert.equal(diag(c,[o],[o],200).actividades[0].estado,'exencion_propuesta');
 const r=diag(c,[o],[o],201);assert.equal(r.actividades[0].estado,'pendiente');assert.equal(r.permiteRevisionFavorable,false);assert.equal(r.cobertura.integridadVerificada,false);assert.equal(r.cobertura.extrapolableEmpresa,false);
});
test('operaciones omitidas o sin rol nunca quedan ocultas en registro favorable',()=>{
 for(const role of ['responsable',undefined]){const r=diag(registro(),[operacion()],[operacion(),operacion('c',{dp_rol:role})]);assert.equal(r.permiteRevisionFavorable,false);}
});
test('España no o régimen especial no significan exclusión de RGPD',()=>{
 for(const changes of [{dp_establecimiento_es:false},{dp_regimen_general:false}])assert.equal(diag(registro(),[operacion('b',changes)]).actividades[0].estado,'pendiente');
});
test('prevista prepara, residual incluye, terminada requiere aclaración',()=>{
 for(const [f,s]of [['prevista','preparacion_incluir'],['residual','actual_incluir'],['finalizada','pendiente']])assert.equal(diag(registro(),[operacion('b',{dp_fase:f})]).actividades[0].estado,s);
});
test('DPD y sujeto77 desconocidos no son ausencia; sujeto77 conocido fuera cobertura',()=>{
 for(const k of ['dpd','sujeto77']){const c=registro();c[k]=campo('pendiente');assert.equal(diag(c,[operacion()]).permiteRevisionFavorable,false);}
 const c=registro();c.sujeto77=campo();assert.ok(diag(c,[operacion()]).incidencias.includes('inventario_publico_sujeto77_fuera_de_cobertura'));
});
test('encargado requiere correspondencia de categorías por responsable',()=>{
 const c=registro('encargado');c.entradas[0].responsables=[];validar('registro_rat',c);assert.equal(diag(c,[operacion('b',{dp_rol:'encargado'})]).permiteRevisionFavorable,false);
});
test('revisión inmutable, conclusión coherente, evidencia exacta declarada',()=>{
 const r={registro:ref(),revisionAnterior:null,evidencias:[ref('c')],criterios:contrato.criterios.responsable.map(id=>({id,resultado:'favorable',motivo:'Examinado sintéticamente',evidenciaIds:[ref('c').id]})),conclusion:'favorable',periodoExaminado:{desde:'2026-10-16',hasta:'2026-10-16'},examinadaEn:'2026-10-16T01:00:00.000Z',motivo:'Prueba'};
 validar('revision_rat',r);assert.throws(()=>validar('revision_rat',{...r,version:1},true));
 for(const change of [x=>x.conclusion='desfavorable',x=>x.criterios[0].evidenciaIds=[],x=>x.evidencias=[]]){const x=structuredClone(r);change(x);assert.throws(()=>validar('revision_rat',x));}
});
test('contrato editorial 16 criterios, rutas 12/9 y no clasificación por rol de cuenta',()=>{
 assert.equal(contrato.criteriosEditoriales.criterios.length,16);assert.equal(contrato.criterios.responsable.length,12);assert.equal(contrato.criterios.encargado.length,9);
 const x=registro();x.funcion='administrador';assert.throws(()=>validar('registro_rat',x));
});
test('evidencia revisada cubre periodo inclusive RAT, no es futura ni carece de documento',()=>{
 const {validarEvidenciasRevision:v}=require('../validation/registroRAT');
 const id=ref('a').id,d={criterios:[{resultado:'favorable',evidenciaIds:[id]}],examinadaEn:'2026-10-16T12:00:00.000Z',periodoExaminado:{desde:'2026-10-16',hasta:'2026-10-16'}};
 const ev={tipo:'constatacion_revision',periodo:{desde:'2026-10-16',hasta:'2026-10-17',calendario:'gregoriano',jurisdiccion:'ES',zonaEvaluacion:'Europe/Madrid'},soporte:{tipo:'comprobacion',realizadaEn:'2026-10-16T11:00:00.000Z'}};
 v(d,new Map([[id,ev]]));
 for(const edit of [e=>e.periodo.hasta='2026-10-16',e=>e.periodo.desde='2026-10-17',e=>e.periodo.zonaEvaluacion='UTC',e=>e.tipo='registro_versionado',e=>e.tipo='constatacion_documento',e=>e.soporte.realizadaEn='2026-10-16T13:00:00.000Z']){const e=structuredClone(ev);edit(e);assert.throws(()=>v(d,new Map([[id,e]])));}
 assert.throws(()=>v(d,new Map([[id,ev],[ref('b').id,ev]])));
});
