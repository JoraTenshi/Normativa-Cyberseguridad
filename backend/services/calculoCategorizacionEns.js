'use strict';
// Annex I maximum rule only. Never determines legal applicability or authority.
const {DIMENSIONES}=require('../validation/categorizacionEns');
const {exigir,huella,copiarJSON}=require('../validation/aplicabilidadContextual');
const niveles=['BAJO','MEDIO','ALTO'];
const categoria=n=>({BAJO:'BASICA',MEDIO:'MEDIA',ALTO:'ALTA'})[n]||null;
const mayor=ns=>niveles.filter(n=>ns.includes(n)).at(-1)||null;
function calcular(inventario){
 const carencias=[];
 if(!inventario.completo)carencias.push({tipo:'INVENTARIO_INCOMPLETO'});
 if(!inventario.elementos.length)carencias.push({tipo:'INVENTARIO_VACIO'});
 for(const e of inventario.elementos)for(const dim of DIMENSIONES){const nivel=e.dimensiones[dim].nivel;if(['DESCONOCIDO','CONFLICTIVO'].includes(nivel))carencias.push({tipo:nivel,elemento:e.id,version:e.version,dimension:dim});}
 const dimensiones=Object.fromEntries(DIMENSIONES.map(dim=>{
  const valores=inventario.elementos.map(e=>e.dimensiones[dim].nivel),max=mayor(valores);
  const incompleta=!inventario.completo||!valores.length||valores.some(n=>['DESCONOCIDO','CONFLICTIVO'].includes(n));
  return [dim,{estado:incompleta?'INCOMPLETA':max?'VALORADA':'NO_AFECTADA',nivelCalculado:incompleta?null:max,minimoConocido:max}];
 }));
 const max=mayor(Object.values(dimensiones).map(d=>d.minimoConocido));
 return {estado:carencias.length?'INCOMPLETO':max?'PROPUESTA_CALCULADA':'SIN_NIVEL_DETERMINADO',categoriaPropuesta:carencias.length?null:categoria(max),categoriaMinimaConocida:categoria(max),dimensiones,carencias,esDeterminacionFormal:false};
}
function versionarElementos(elementos,anteriores=[],identidades=[]){
 const mapa=new Map(identidades.map(x=>[x.id,x])),activos=new Map(anteriores.map(e=>[e.id,e]));
 for(const e of elementos){
  const {version,...payload}=e,hash=huella(payload),prev=mapa.get(e.id),activo=activos.get(e.id);
  if(!prev)exigir(version===1,'elemento_nuevo_version');
  else if(activo&&prev.sha256===hash)exigir(version===prev.version,'elemento_sin_cambio_version');
  else exigir(version===prev.version+1&&prev.version<999999999,'elemento_modificado_version');
  mapa.set(e.id,{id:e.id,version,sha256:hash});
 }
 // Retired IDs stay reserved. Reappearance requires a new version, not v1 reuse.
 return [...mapa.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
function pendienteDocumental(c){
 const faltas=[];
 for(const e of c.inventario.elementos){if(e.responsable===null)faltas.push({tipo:'RESPONSABLE_PENDIENTE',elemento:e.id});if(e.valoradoEn===null)faltas.push({tipo:'FECHA_VALORACION_PENDIENTE',elemento:e.id});if(!e.evidencias.length)faltas.push({tipo:'SOPORTE_VALORACION_PENDIENTE',elemento:e.id});}
 return faltas;
}
function soloDatos(d){const {clave,version,motivo,...rest}=d;return copiarJSON(rest);}
module.exports={calcular,versionarElementos,pendienteDocumental,soloDatos};
