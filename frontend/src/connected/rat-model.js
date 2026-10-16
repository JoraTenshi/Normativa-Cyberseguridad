import { resourceId } from '../api-client';
import { exactRef, scopeRef } from './normative-api-model';

export const RAT_RESOURCES = { 'registros-rat':'Registros de actividades', 'revisiones-rat':'Revisiones del RAT', 'actuaciones-rat':'Trabajo del RAT' };
export const RAT_LABELS = {
  representante:'Representante, cuando corresponda', dpd:'Delegado de protección de datos', sujeto77:'Condición de entidad del artículo 77.1 LOPDGDD', comunicacionDPD:'Cambios comunicados al delegado', disponibilidadAutoridad:'Disponibilidad para la autoridad de control',
  finalidades:'Finalidades del tratamiento', interesados:'Categorías de personas afectadas', datos:'Categorías de datos personales', destinatarios:'Categorías de destinatarios', transferencias:'Transferencias internacionales y garantías', supresion:'Plazos previstos de supresión', medidas:'Descripción general de medidas de seguridad', corresponsables:'Corresponsables, cuando corresponda', categorias:'Categorías de tratamientos por cuenta del responsable'
};
export const RAT_CRITERIA = { RAT_PERIMETRO:'Perímetro e inventario de actividades', RAT_R_IDENTIDAD:'Identidad y contactos del responsable', RAT_E_IDENTIDAD:'Identidad y contactos del encargado y sus responsables', RAT_R_FIN:'Finalidades', RAT_R_DATOS:'Personas afectadas y categorías de datos', RAT_R_DESTINATARIOS:'Destinatarios', RAT_R_TRANSFERENCIAS:'Transferencias internacionales', RAT_E_TRANSFERENCIAS:'Transferencias internacionales', RAT_R_SUPRESION:'Plazos de supresión', RAT_R_MEDIDAS:'Descripción de las medidas', RAT_E_MEDIDAS:'Descripción de las medidas', RAT_E_CATEGORIAS:'Categorías de tratamientos por responsable', RAT_ESCRITO:'Registro documentado', RAT_AUTORIDAD:'Disponibilidad para la autoridad', RAT_DPD_CAMBIOS:'Cambios y comunicación al delegado', RAT_ACTUALIDAD:'Actualidad de los datos y referencias' };
export const pendingRATField = () => ({ estado:'pendiente', contenido:'', motivo:'Pendiente de aportar y contrastar.' });
export const storedRef = (r, name) => ({ id:r.id, version:r.version, referencia:r, revision:{numero:r.version,sha256:r.sha256}, nombre:name || 'Referencia guardada '+r.id });
export function operationRef(dto) {
  if (dto.referencia) return exactRef(dto);
  const r={id:dto.operacion?.id,version:dto.contexto?.version,sha256:dto.revision?.sha256};
  return exactRef({id:r.id,version:r.version,referencia:r});
}
export function ratPath(base, kind, id, version) {
  if (!Object.hasOwn(RAT_RESOURCES,kind)) throw new Error('Recurso RAT desconocido.');
  if (version !== undefined && (!id || !Number.isInteger(version) || version < 1)) throw new Error('Versión RAT inválida.');
  return base+'/normativa/'+kind+(id?'/'+resourceId(id):'')+(version!==undefined?'/versiones/'+version:'');
}
export function ratRecordBody(draft, scope, evidence, reason, contract) {
  if (!scope || !reason.trim()) throw new Error('Selecciona el alcance e indica el motivo del registro.');
  const fields=draft.funcion==='responsable'?contract.camposResponsable:contract.camposEncargado;
  const validateField=(key,c)=>{
    if (!c || !contract.campo.estados.includes(c.estado) || (c.estado==='conocido'?!c.contenido.trim():!c.motivo.trim())) throw new Error((RAT_LABELS[key]||key)+': completa el contenido o explica por qué queda pendiente.');
    if (c.estado==='no_corresponde'&&!contract.condicionales.includes(key)) throw new Error('No corresponde no está permitido en '+key);
    if (c.estado==='imposible_motivado'&&!contract.cuandoSeaPosible.includes(key)) throw new Error('Imposibilidad no permitida en '+key);
    return {estado:c.estado,contenido:c.contenido,motivo:c.motivo};
  };
  const contact=c=>{if(!c?.nombre.trim()||!c?.contacto.trim())throw new Error('Completa el nombre y contacto profesional de las entidades.');return {...c};};
  const entries=draft.entradas.map(e=>{
    if(!e.titulo.trim()||!e.operaciones.length)throw new Error('Cada entrada necesita un título y al menos una operación consultada.');
    return {id:e.id,titulo:e.titulo,operaciones:e.operaciones.map(operationRef),campos:Object.fromEntries(fields.map(k=>[k,validateField(k,e.campos[k])])),responsables:draft.funcion==='encargado'?e.responsables.map(r=>({id:r.id,responsable:contact(r.responsable),...Object.fromEntries(['representante','dpd','categorias','finalidades'].map(k=>[k,validateField(k,r[k])]))})):[],evidencias:e.evidencias.map(exactRef)};
  });
  const ids=entries.flatMap(e=>e.operaciones.map(r=>r.id));
  if(new Set(ids).size!==ids.length)throw new Error('Una operación no puede estar repetida en varias entradas del mismo registro.');
  if(entries.length>contract.limites.entradas||ids.length>contract.limites.operaciones)throw new Error('Se ha superado el límite de entradas u operaciones del registro.');
  if(!draft.nombre.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(draft.fechaReferencia))throw new Error('Completa el nombre y la fecha de referencia.');
  return {nombre:draft.nombre,funcion:draft.funcion,fechaReferencia:draft.fechaReferencia,inventarioCompleto:draft.inventarioCompleto,entidad:contact(draft.entidad),alcance:scopeRef(scope),...Object.fromEntries(['representante','dpd','sujeto77','comunicacionDPD','disponibilidadAutoridad'].map(k=>[k,validateField(k,draft[k])])),entradas:entries,evidencias:evidence.map(exactRef),motivo:reason.trim()};
}
