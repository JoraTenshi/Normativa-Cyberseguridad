'use strict';
const {contrato}=require('../../validation/deteccionEIPD');
const {ref}=require('./unidadDP');
function deteccion(operacion=ref('b'),alcance=ref('a')) {
  return {operacion,alcance,contextoOperacion:'pendiente',motivoContexto:'Contexto por delimitar',
    fechaEvaluacion:'2026-10-16',declaraciones:Object.fromEntries(contrato.campos.map(k=>[k,{estado:'desconocido',motivo:'Por examinar',evidencias:[],fundamento:null}])),
    evidencias:[],confirmarBases:false,motivo:'Detección ficticia de prueba'};
}
function declarar(d,k,estado) {
  d.declaraciones[k]={estado,motivo:'Calificación FICTICIA para prueba técnica',evidencias:[],
    fundamento:contrato.camposCalificados.includes(k)&&['si','no'].includes(estado)?{referencia:'Fuente FICTICIA',localizador:'Apartado sintético',fechaVersion:'2026-10-15'}:null};
  return d;
}
module.exports={deteccion,declarar};
