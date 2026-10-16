import { cleanFact, resourceId } from '../api-client';
import { exactRef, scopeRef } from './normative-api-model';
import { operationRef } from './rat-model';
import { typedFactError } from './typed-facts';

export const SUPPORTED_UNIT_TYPES=['finalidad_tratamiento','flujo_transferencia','unidad_informativa'];
export const isUnitType=type=>SUPPORTED_UNIT_TYPES.includes(type);

export const UNIT_LABELS={fuente:'De dónde proceden los datos',canal:'Canal de información a las personas',textoAviso:'Texto de privacidad comunicado',versionAviso:'Versión del aviso',momentoObtencion:'Cuándo se obtienen los datos',primeraComunicacion:'Primera comunicación con la persona',primeraRevelacion:'Primera revelación a otro destinatario',nuevoFin:'Nueva finalidad prevista',excepcionesInvocadas:'Excepciones invocadas y su justificación',finalidad:'Para qué necesitas tratar los datos',datos:'Categorías de datos',personas:'Personas a las que se refieren',relacion:'Relación con esas personas',fundamento:'Fundamento que se ha valorado',cambioFinalidad:'Posibles cambios de finalidad',exportador:'Entidad que comunica o permite acceder',destinatario:'Entidad destinataria',destino:'País u organización de destino',modalidadAcceso:'Cómo se comunican o consultan los datos',mecanismo:'Mecanismo de transferencia valorado',transferenciasUlteriores:'Comunicaciones posteriores previstas'};
export const UNIT_QUESTIONS={tra_unidad_delimitada:'¿Está delimitada esta comunicación de privacidad?',tra_origen:'¿Los datos se obtienen de la persona o de otra fuente?',lic_finalidad_delimitada:'¿Se ha delimitado esta finalidad concreta?',lic_base6:'¿Qué base del artículo 6 se ha valorado para esta finalidad?',tr_flujo_delimitado:'¿Se ha delimitado este flujo concreto?',tr_otro_destinatario:'¿Interviene una entidad destinataria distinta?',tr_destino_tercero_oi:'¿El destino es un tercer país u organización internacional?',tr_via:'¿Qué vía se ha valorado para este flujo?'};

export function validateUnitContract(contract){
  if(contract?.version!==1||contract.tipoRegistro!=='unidad_dp'||contract.ruta!=='unidades-dp'||!contract.clases||!contract.campos?.estados||!Number.isInteger(contract.limites?.bytes))throw new Error('Contrato de unidades no compatible. No se sustituyen sus datos por ejemplos.');
  for(const cfg of Object.values(contract.clases)){if(!Array.isArray(cfg.campos)||!Array.isArray(cfg.hechos)||!Array.isArray(cfg.relaciones)||new Set(cfg.campos).size!==cfg.campos.length||new Set(cfg.hechos.map(h=>h.clave)).size!==cfg.hechos.length)throw new Error('Diccionario de unidades no compatible.');}
  return contract;
}
export function unitPath(base,id,version){
  if(version!==undefined&&(!id||!Number.isInteger(version)||version<1))throw new Error('Versión de unidad inválida.');
  return base+'/normativa/unidades-dp'+(id?'/'+resourceId(id):'')+(version!==undefined?'/versiones/'+version:'');
}
export function newUnitDraft(contract,clase){
  validateUnitContract(contract);const cfg=contract.clases[clase];if(!cfg)throw new Error('Clase de unidad desconocida.');
  return {clase,nombre:'',descripcion:'',contextoOperacion:'pendiente',motivoContexto:'',campos:Object.fromEntries(cfg.campos.map(k=>[k,{estado:'pendiente',contenido:'',motivo:''}])),hechos:cfg.hechos.map(f=>({clave:f.clave,estado:'desconocido',motivo:'por_consultar'}))};
}
const text=(v,max,label)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(label+': completa un texto válido de hasta '+max+' caracteres.');return v.trim();};
const sameRef=(a,b)=>a.id===b.id&&a.version===b.version&&a.sha256===b.sha256;
export function unitBody({contract,draft,operation,scope,evidence=[],relations=[],original=null,confirmBases=false,reason}){
  validateUnitContract(contract);const cfg=contract.clases[draft.clase];if(!cfg)throw new Error('Clase de unidad desconocida.');
  if(!operation||!scope)throw new Error('Consulta la operación y el alcance antes de guardar.');
  const op=operationRef(operation),ar=scopeRef(scope);
  if(original&&(original.clase!==draft.clase||original.operacion.id!==op.id||original.alcance.id!==ar.id))throw new Error('La clase, operación y alcance de una unidad guardada no pueden cambiar de identidad.');
  const basesChanged=!!original&&(!sameRef(original.operacion,op)||!sameRef(original.alcance,ar));
  if(basesChanged!==confirmBases)throw new Error(basesChanged?'Examina y confirma expresamente las nuevas versiones de las bases.':'No hay un cambio de bases que confirmar.');
  if(!['confirmado','pendiente'].includes(draft.contextoOperacion))throw new Error('Aclara si el contexto de la operación corresponde a esta unidad.');
  if(Object.keys(draft.campos).sort().join('|')!==[...cfg.campos].sort().join('|'))throw new Error('Los campos no coinciden con la clase de unidad.');
  const campos=Object.fromEntries(cfg.campos.map(k=>{
    const f=draft.campos[k],label=UNIT_LABELS[k]||k;
    if(!contract.campos.estados.includes(f?.estado))throw new Error(label+': estado inválido.');
    if(f.estado==='conocido'){if(f.motivo!=='')throw new Error(label+': el dato conocido no admite un motivo pendiente oculto.');return [k,{estado:f.estado,contenido:text(f.contenido,contract.campos.maxTexto,label),motivo:''}];}
    if(f.contenido!=='')throw new Error(label+': no conserves contenido como conocido si está pendiente o es contradictorio.');
    return [k,{estado:f.estado,contenido:'',motivo:text(f.motivo,contract.campos.maxTexto,label)}];
  }));
  const facts=draft.hechos;
  if(!Array.isArray(facts)||facts.length!==cfg.hechos.length||new Set(facts.map(f=>f.clave)).size!==facts.length||facts.some(f=>!cfg.hechos.some(h=>h.clave===f.clave)))throw new Error('Declara solo y todas las cuestiones propias de esta unidad; no se permite asignar el contexto de la operación.');
  facts.forEach(f=>{const issue=typedFactError(cfg.hechos.find(h=>h.clave===f.clave),f);if(issue)throw new Error((UNIT_QUESTIONS[f.clave]||f.clave)+': '+issue);});
  function references(rows,max){if(rows.length>max)throw new Error('Demasiadas referencias.');const result=rows.map(exactRef);if(new Set(result.map(r=>r.id)).size!==result.length)throw new Error('Referencia repetida.');return result;}
  relations.forEach(r=>{const u=r.contenido?.unidadDP;if(u&&(!cfg.relaciones.includes(u.clase)||u.operacion.id!==op.id||u.alcance.id!==ar.id))throw new Error('La unidad relacionada no pertenece a esta clase, operación y alcance.');});
  if(!cfg.relaciones.length&&relations.length)throw new Error('Esta clase no admite unidades relacionadas.');
  return {clase:draft.clase,nombre:text(draft.nombre,120,'Nombre'),descripcion:text(draft.descripcion,500,'Descripción'),operacion:op,alcance:ar,contextoOperacion:draft.contextoOperacion,motivoContexto:text(draft.motivoContexto,1000,'Motivo del contexto'),campos,hechos:facts.map(cleanFact),relaciones:references(relations,contract.limites.relaciones),evidencias:references(evidence,contract.limites.evidencias),confirmarBases:confirmBases,motivo:text(reason,300,'Motivo del registro')};
}
