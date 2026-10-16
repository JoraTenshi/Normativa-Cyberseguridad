import { cleanFact, resourceId } from '../api-client';
import { exactRef, scopeRef } from './normative-api-model';
import { operationRef } from './rat-model';
import { typedFactError } from './typed-facts';
export const CASES={solicitud_derechos:{route:'solicitudes-derechos',key:'solicitudDerechos',label:'Solicitud de derechos'},pretension_derecho:{route:'pretensiones-derechos',key:'pretensionDerecho',label:'Petición concreta'},deteccion_eipd:{route:'detecciones-eipd',key:'deteccionEIPD',label:'Detección orientativa EIPD'}};
export const isRightsType=t=>['solicitud_derechos','pretension_derecho'].includes(t);
export const casePath=(base,type,id,version)=>{
  if(!CASES[type]||(version!==undefined&&(!id||!Number.isInteger(version)||version<1)))throw Error('Registro o versión no compatible.');
  return base+'/normativa/'+CASES[type].route+(id?'/'+resourceId(id):'')+(version!==undefined?'/versiones/'+version:'');
};
export const pendingNarrative=()=>({estado:'pendiente',contenido:'',motivo:''});
export const sameReferences=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const textRequired=(value,max,label)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(label+': completa el texto (máximo '+max+').');return value.trim();};
export function validateCaseContract(c,type){
  if(c?.version!==1||!Number.isInteger(c.limites?.bytes))throw Error('Contrato no compatible. No se usarán datos simulados.');
  if(type==='deteccion_eipd'){
    if(c.tipo!==type||c.ruta!==CASES[type].route||!Array.isArray(c.campos)||!Array.isArray(c.camposCalificados)||!Array.isArray(c.estados))throw Error('Contrato EIPD no compatible.');
  }else if(!isRightsType(type)||!c.tipos?.includes(type)||c.rutas?.[type]!==CASES[type].route||!c.recepcion||!c.pretension?.camposDetalle||!c.camposNarrativos)throw Error('Contrato de derechos no compatible.');
  return c;
}
export function newCaseDraft(type,c){
  validateCaseContract(c,type);
  if(type==='solicitud_derechos')return {personaReferencia:'',descripcion:'',recepcion:{estado:'pendiente',precision:null,instante:null,fecha:null,zona:null,motivo:''},canal:pendingNarrative(),contextoOperacion:'pendiente',motivoContexto:'',inventarioPretensionesCompleto:false,hechos:[{clave:'sol_expediente_delimitado',estado:'desconocido',motivo:'por_consultar'}]};
  if(type==='pretension_derecho')return {derecho:'por_delimitar',peticion:'',campos:Object.fromEntries(c.pretension.camposDetalle.map(k=>[k,pendingNarrative()])),estadoGestion:'pendiente'};
  return {contextoOperacion:'pendiente',motivoContexto:'',fechaEvaluacion:'',declaraciones:Object.fromEntries(c.campos.map(k=>[k,{estado:'desconocido',motivo:'',evidencias:[],fundamento:null}]))};
}
function narrative(f,label){
  if(!['conocido','pendiente','conflictivo'].includes(f?.estado))throw Error(label+': estado inválido.');
  if(f.estado==='conocido'){if(f.motivo!=='')throw Error(label+': motivo pendiente incompatible.');return {estado:f.estado,contenido:textRequired(f.contenido,2000,label),motivo:''};}
  if(f.contenido!=='')throw Error(label+': conserva la contradicción en el motivo.');return {estado:f.estado,contenido:'',motivo:textRequired(f.motivo,2000,label)};
}
export function civil(value,label){const d=new Date(value+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw Error(label+': fecha civil inválida.');return value;}
function refs(rows,mapper=exactRef){if(rows.length>20)throw Error('Máximo 20 referencias.');const out=rows.map(mapper);if(new Set(out.map(r=>r.id)).size!==out.length)throw Error('Referencia repetida.');return out;}
export function caseReferences(type,{operations=[],scopes=[],parents=[],evidence=[]}){
  const op=refs(operations,operationRef),ar=refs(scopes,scopeRef),ev=refs(evidence);
  if(type==='solicitud_derechos')return {operaciones:op,alcances:ar,evidencias:ev};
  if(op.length!==1||ar.length!==1)throw Error('Selecciona una operación y un alcance exactos.');
  const out={operacion:op[0],alcance:ar[0],evidencias:ev};
  if(type==='pretension_derecho'){if(parents.length!==1)throw Error('Selecciona la solicitud a la que pertenece.');out.solicitud=exactRef(parents[0]);}
  return out;
}
export function changedCaseBases(type,original,r){if(!original)return false;const keys=type==='solicitud_derechos'?['operaciones','alcances']:type==='pretension_derecho'?['solicitud','operacion','alcance']:['operacion','alcance'];return keys.some(k=>!sameReferences(original[k],r[k]));}
export function caseBody({type,contract,draft,references,original,confirmBases=false,confirmReception=false,reason}){
  validateCaseContract(contract,type);const r=caseReferences(type,references);
  if(changedCaseBases(type,original,r)!==confirmBases)throw Error('Revisa y confirma expresamente el cambio de bases, sin cambiarlo automáticamente.');
  if(original&&type!=='solicitud_derechos'&&['operacion','alcance',...(type==='pretension_derecho'?['solicitud']:[])].some(k=>original[k].id!==r[k].id))throw Error('No puedes cambiar la identidad de estas bases. Utiliza la sustitución técnica para corregir una petición.');
  const out={...r,confirmarBases:confirmBases,motivo:textRequired(reason,300,'Motivo del registro')};
  if(type!=='pretension_derecho'){
    if(!['pendiente','confirmado'].includes(draft.contextoOperacion))throw Error('Contexto inválido.');
    Object.assign(out,{contextoOperacion:draft.contextoOperacion,motivoContexto:textRequired(draft.motivoContexto,1000,'Motivo del contexto')});
  }
  if(type==='solicitud_derechos'){
    if(draft.hechos?.length!==1||draft.hechos[0].clave!=='sol_expediente_delimitado'||typedFactError({tipo:'booleano'},draft.hechos[0]))throw Error('Declara únicamente el estado de delimitación del expediente, sin inferirlo.');
    const person=draft.personaReferencia||null;if(person!==null&&!/^persona_[a-zA-Z0-9_-]{8,64}$/.test(person))throw Error('Utiliza una referencia persona_ de 8 a 64 caracteres; no un nombre, correo ni DNI.');
    const reception={...draft.recepcion,motivo:textRequired(draft.recepcion.motivo,1000,'Recepción')};
    if(!contract.recepcion.estados.includes(reception.estado))throw Error('Recepción inválida.');
    if(reception.estado==='conocida'){
      if(reception.zona!=='Europe/Madrid')throw Error('Indica Europe/Madrid para esta recepción.');
      if(reception.precision==='fecha_civil'){civil(reception.fecha,'Recepción');reception.instante=null;}
      else if(reception.precision==='instante'){if(!/T.*(Z|[+-]\d{2}:\d{2})$/.test(reception.instante||'')||!Number.isFinite(Date.parse(reception.instante)))throw Error('Indica el instante con zona explícita, por ejemplo 2026-10-16T09:00:00+02:00.');reception.instante=new Date(reception.instante).toISOString();reception.fecha=null;}
      else throw Error('Indica si conoces el instante o solo la fecha de recepción.');
    }else Object.assign(reception,{precision:null,instante:null,fecha:null,zona:null});
    if((!!original&&!sameReferences(original.recepcion,reception))!==confirmReception)throw Error('Confirma la corrección de la recepción; no se reinicia ningún plazo.');
    Object.assign(out,{personaReferencia:person,descripcion:textRequired(draft.descripcion,2000,'Descripción'),recepcion:reception,canal:narrative(draft.canal,'Canal'),inventarioPretensionesCompleto:draft.inventarioPretensionesCompleto===true,hechos:draft.hechos.map(cleanFact),confirmarRecepcion:confirmReception});
  }else if(type==='pretension_derecho'){
    if(original?.sustitucion)throw Error('Esta petición tiene una sustitución técnica. Revisa o actualiza esa vinculación sin reescribir la petición original.');
    if(!contract.derechos.includes(draft.derecho)||!contract.pretension.estadosGestion.includes(draft.estadoGestion))throw Error('Clasificación o estado no compatible.');
    Object.assign(out,{derecho:draft.derecho,peticion:textRequired(draft.peticion,2000,'Petición'),estadoGestion:draft.estadoGestion,campos:Object.fromEntries(contract.pretension.camposDetalle.map(k=>[k,narrative(draft.campos[k],k)]))});
  }else{
    civil(draft.fechaEvaluacion,'Fecha de evaluación');const declarations={};
    for(const k of contract.campos){const d=draft.declaraciones[k];if(!contract.estados.includes(d?.estado))throw Error('Estado inválido: '+k);const ev=refs(d.evidencias.map(x=>({id:x.id,version:x.version,referencia:x})));if(ev.some(x=>!r.evidencias.some(y=>sameReferences(x,y))))throw Error('La evidencia de una declaración no está en el inventario.');let fundamento=null;
      if(contract.camposCalificados.includes(k)&&['si','no'].includes(d.estado)){const f=d.fundamento;fundamento={referencia:textRequired(f?.referencia,1000,'Fuente de '+k),localizador:textRequired(f?.localizador,1000,'Localizador de '+k),fechaVersion:civil(f?.fechaVersion,'Fecha de la fuente')};if(fundamento.fechaVersion>draft.fechaEvaluacion)throw Error('La fuente no puede ser posterior a la evaluación.');}
      declarations[k]={estado:d.estado,motivo:textRequired(d.motivo,2000,'Motivo de '+k),evidencias:ev,fundamento};
    }
    Object.assign(out,{fechaEvaluacion:draft.fechaEvaluacion,declaraciones:declarations});
  }
  return out;
}
export function substitutionBody(original,target,reason,confirmed){
  const c=target?.contenido?.pretensionDerecho;if(!c||c.sustitucion||c.solicitud.id!==original.solicitud.id||c.peticion!==original.peticion||(original.derecho!=='por_delimitar'&&c.derecho!==original.derecho)||target.version!==target.versionActual||target.vigencia?.requiereRevision)throw Error('Selecciona una petición activa y actual, equivalente y de la misma solicitud.');
  if(!confirmed)throw Error('Confirma que se trata de la misma petición, no una retirada ni una denegación.');
  return {...original,sustitucion:{destino:exactRef(target),motivo:textRequired(reason,1000,'Motivo de sustitución'),confirmarMismaPeticion:true},confirmarBases:false,motivo:textRequired(reason,300,'Motivo del registro')};
}
