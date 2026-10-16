import {ApiError, resourceId} from '../api-client';
import {exactRef} from './normative-api-model';

export const DIMENSIONS = {C:'Confidencialidad', I:'Integridad', T:'Trazabilidad', A:'Autenticidad', D:'Disponibilidad'};
export const LEVELS = {DESCONOCIDO:'Pendiente de aclarar', CONFLICTIVO:'Información contradictoria', NO_AFECTADA:'Dimensión no afectada', BAJO:'Bajo', MEDIO:'Medio', ALTO:'Alto'};
export const CATEGORY_RESOURCES = ['categorizaciones-ens','determinaciones-ens','revisiones-categorizacion-ens'];
export const REVIEW_CRITERIA = {CAT_AMBITO:'Delimitación del sistema y completitud del inventario',CAT_VALORACIONES:'Valoraciones motivadas y responsables competentes',CAT_AGREGACION:'Cálculo por dimensiones y categoría',CAT_DETERMINACION:'Determinación del responsable de seguridad',CAT_REEVALUACION:'Examen temporal y reevaluación cuando corresponda'};
export const text = value => String(value||'').replace(/\s+/g,' ').trim();
export const blankHistory = () => ({estado:'desconocido',origenSistema:'desconocido',fechaInicio:null,ultimaDeterminacionEn:null,ultimaReevaluacionEn:null,cambiosSignificativos:'desconocido',motivo:'',evidencias:[]});
export function categoryPath(base,kind='categorizaciones-ens',id,version) {
  if(!CATEGORY_RESOURCES.includes(kind))throw new ApiError('Recurso de categorización no válido.',400);
  if(version!==undefined&&(!id||!Number.isInteger(version)||version<1))throw new ApiError('Versión no válida.',400);
  return `${base}/normativa/${kind}${id?'/'+resourceId(id):''}${version===undefined?'':'/versiones/'+version}`;
}
export const reference = r => exactRef({id:r?.id,version:r?.version,referencia:r});
export const selectedReference = r => ({id:r.id,version:r.version,referencia:r,nombre:'Referencia conservada · '+r.id});
export function newElement(uuid=()=>crypto.randomUUID()) {
  return {id:'e_'+uuid().replaceAll('-',''),version:1,tipo:'informacion',nombre:'',descripcion:'',responsable:null,evidencias:[],valoradoEn:null,limitaciones:'',dimensiones:Object.fromEntries(Object.keys(DIMENSIONS).map(k=>[k,{nivel:'DESCONOCIDO',motivo:'',criteriosImpacto:''}]))};
}
export function cleanElement(e) {
  return {id:e.id,version:e.version,tipo:e.tipo,nombre:text(e.nombre),descripcion:text(e.descripcion),responsable:e.responsable?reference(e.responsable):null,evidencias:e.evidencias.map(reference),valoradoEn:e.valoradoEn,limitaciones:text(e.limitaciones),dimensiones:Object.fromEntries(Object.keys(DIMENSIONS).map(k=>[k,{nivel:e.dimensiones[k].nivel,motivo:text(e.dimensiones[k].motivo),criteriosImpacto:text(e.dimensiones[k].criteriosImpacto)}]))};
}
export function versionElements(elements,previous=[]) {
  return elements.map(e=>{
    const clean=cleanElement(e),old=previous.find(p=>p.id===e.id);
    if(!old)return {...clean,version:1};
    const withoutVersion=value=>{const {version,...rest}=cleanElement(value);return JSON.stringify(rest);};
    return {...clean,version:old.version+(withoutVersion(old)===withoutVersion(clean)?0:1)};
  });
}
export function categoryBody(draft,previous,system,replaceBases=false) {
  const required=(value,label,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw new ApiError(`Completa ${label} (máximo ${max} caracteres).`,400);};
  required(draft.motivo,'el motivo del registro',300);
  required(draft.baseAplicabilidad.motivo,'el motivo de la base declarada',2000);
  for(const key of ['delimitacion','exclusiones','dependencias'])required(draft.inventario[key],key,2000);
  const elements=versionElements(draft.inventario.elementos,previous?.inventario.elementos);
  if(elements.length>50)throw new ApiError('El inventario admite hasta 50 elementos por expediente.',400);
  for(const e of elements){required(e.nombre,'el nombre del elemento',120);required(e.descripcion,'la descripción de '+e.nombre,1000);required(e.limitaciones,'las limitaciones de '+e.nombre,2000);}
  if(new Set(elements.map(e=>e.id)).size!==elements.length)throw new ApiError('Hay elementos repetidos en el inventario.',400);
  for(const e of elements)for(const [key,value] of Object.entries(e.dimensiones)) {
    if(!Object.hasOwn(LEVELS,value.nivel)||!value.motivo.trim())throw new ApiError(`Explica la valoración o la incertidumbre de ${DIMENSIONS[key]} en ${e.nombre||'el elemento'}.`,400);
    required(value.criteriosImpacto,'los criterios considerados o pendientes en '+DIMENSIONS[key]+' de '+e.nombre,2000);
  }
  const h=draft.historialTemporal;
  required(h.motivo,'el motivo del conocimiento del historial',2000);
  return {sistema:previous&&!replaceBases?reference(previous.sistema):exactRef(system),alcance:reference(previous&&!replaceBases?previous.alcance:system.contenido.alcance),baseAplicabilidad:{tipo:draft.baseAplicabilidad.tipo,motivo:text(draft.baseAplicabilidad.motivo),evidencias:draft.baseAplicabilidad.evidencias.map(reference)},historialTemporal:{estado:h.estado,origenSistema:h.origenSistema,fechaInicio:h.fechaInicio,ultimaDeterminacionEn:h.ultimaDeterminacionEn,ultimaReevaluacionEn:h.ultimaReevaluacionEn,cambiosSignificativos:h.cambiosSignificativos,motivo:text(h.motivo),evidencias:h.evidencias.map(reference)},inventario:{completo:draft.inventario.completo,delimitacion:text(draft.inventario.delimitacion),exclusiones:text(draft.inventario.exclusiones),dependencias:text(draft.inventario.dependencias),elementos:elements},motivo:text(draft.motivo)};
}
// The control is explicitly UTC, not a guessed browser timezone or a civil date at midnight.
export const utcInput = value => value ? value.replace(/Z$/,'') : '';
export function utcValue(value) {
  if(!value)return null;
  const date=new Date(value+'Z');
  if(!Number.isFinite(date.getTime()))throw new ApiError('Indica una fecha y hora UTC válidas.',400);
  return date.toISOString();
}
export function designationFits(dto,system,role) {
  const d=dto.contenido?.designacion;
  return !!d && dto.version===dto.versionActual && d.funcionId===role && d.estado==='identificada' && d.objeto?.tipo==='sistema' && d.objeto.id===system.id && d.objeto.version===system.version && d.alcance?.id===system.contenido.alcance.id && d.alcance.version===system.contenido.alcance.version && d.alcance.sha256===system.contenido.alcance.sha256;
}
