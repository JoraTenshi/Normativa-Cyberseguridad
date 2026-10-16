'use strict';
const {contrato}=require('../../validation/unidadDP');
const ref=(c='a')=>({id:c.repeat(24),version:1,sha256:c.repeat(64)});
const conocido=(clave,valor)=>({clave,estado:'conocido',valor});
function unidad(clase='finalidad_tratamiento',operacion=ref('b'),alcance=ref()) {
  const cfg=contrato.clases[clase];
  return {clase,nombre:'Unidad FICTICIA',descripcion:'Prueba, no tratamiento real',operacion,alcance,
    contextoOperacion:'confirmado',motivoContexto:'Misma actividad y función que la operación sintética',
    campos:Object.fromEntries(cfg.campos.map(k=>[k,{estado:'conocido',contenido:'Contenido FICTICIO '+k,motivo:''}])),
    hechos:cfg.hechos.map(h=>conocido(h.clave,h.tipo==='booleano'?true:h.valores[0])),
    relaciones:[],evidencias:[],confirmarBases:false,motivo:'Prueba técnica'};
}
module.exports={unidad,ref,conocido};
