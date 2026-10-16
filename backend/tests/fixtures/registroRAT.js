'use strict';
const contrato=require('../../contracts/registroRAT.v1.json');
const ref=(c='a')=>({id:c.repeat(24),version:1,sha256:c.repeat(64)});
const campo=(estado='conocido',contenido='Contenido sintético delimitado')=>({estado,contenido:estado==='conocido'?contenido:'',motivo:estado==='conocido'?'':'Motivo sintético explícito'});
function registro(funcion='responsable',op=ref('b'),scope=ref()){
 return {alcance:scope,funcion,nombre:'RAT ficticio '+funcion,fechaReferencia:'2026-10-16',inventarioCompleto:true,entidad:{nombre:'Entidad ficticia',contacto:'contacto@example.invalid'},
  representante:campo('no_corresponde'),dpd:campo('no_corresponde'),sujeto77:campo('no_corresponde'),comunicacionDPD:campo('no_corresponde'),disponibilidadAutoridad:campo(),
  entradas:[{id:'actividad_1',titulo:'Actividad ficticia',operaciones:[op],campos:Object.fromEntries((funcion==='responsable'?contrato.camposResponsable:contrato.camposEncargado).map(k=>[k,campo()])),
  responsables:funcion==='responsable'?[]:[{id:'cliente_1',responsable:{nombre:'Cliente responsable ficticio',contacto:'cliente@example.invalid'},representante:campo('no_corresponde'),dpd:campo('no_corresponde'),categorias:campo(),finalidades:campo()}],evidencias:[]}],evidencias:[],motivo:'Fixture técnica, no conclusión jurídica'};
}
function operacion(c='b',changes={}){
 const values={dp_ambito_rgpd:true,dp_establecimiento_es:true,dp_regimen_general:true,dp_rol:'responsable',dp_fase:'activa',rat_personas_empleadas:249,rat_fecha_personas_empleadas:'2026-10-16',rat_no_ocasional:true,rat_riesgo_derechos:false,rat_art9:false,rat_art10:false,...changes};
 return {ref:ref(c),contexto:{hechos:Object.entries(values).filter(([,v])=>v!==undefined).map(([clave,valor])=>({clave,estado:'conocido',valor}))}};
}
module.exports={ref,campo,registro,operacion};
