import { ApiError, cleanFact, resourceId } from '../api-client';

export const RESOURCES = { requisitos:'Requisitos', sistemas:'Sistemas', 'sujetos-funcionales':'Personas y unidades', designaciones:'Designaciones', actuaciones:'Actuaciones', evidencias:'Evidencias', revisiones:'Revisiones' };
export const RESULTS = { favorable:'Favorable', desfavorable:'Desfavorable', no_determinado:'No determinada', sin_revisar:'Sin revisar', requiere_revision:'Requiere revisión', fuera_del_periodo_revisado:'Fuera del periodo revisado' };
export function normativePath(base, kind, id, version) {
  if (!Object.hasOwn(RESOURCES, kind)) throw new ApiError('Recurso normativo no reconocido',400);
  if (version !== undefined && (!Number.isInteger(version) || version < 1 || !id)) throw new ApiError('Versión no válida',400);
  return `${base}/normativa/${kind}${id ? '/'+resourceId(id) : ''}${version === undefined ? '' : '/versiones/'+version}`;
}
export function exactRef(dto) {
  const r = dto?.referencia;
  if (!r || r.id !== dto.id || r.version !== dto.version || !Number.isInteger(r.version) || r.version < 1 || !/^[a-f0-9]{64}$/.test(r.sha256 || '')) throw new ApiError('Falta la referencia exacta del registro. Vuelve a consultarlo.',400);
  return {id:resourceId(r.id),version:r.version,sha256:r.sha256};
}
export function scopeRef(dto) {
  const r = {id:dto?.id,version:dto?.revision?.numero,sha256:dto?.revision?.sha256};
  return exactRef({id:r.id,version:r.version,referencia:r});
}
export const isCurrent = dto => !!dto && dto.version === dto.versionActual;
export function canReview(dto) {
  return isCurrent(dto) && dto.permisos?.revisar === true && dto.evaluabilidad?.habilitaEvaluacion === true && dto.evaluabilidad?.fundamentosActuales === true && dto.evaluabilidad?.seRefiereAVersionActual === dto.version;
}
export function recordLabel(dto) {
  const c = dto.contenido;
  return c?.paquete?.ficha?.titulo || c?.nombre || c?.titulo || c?.sujeto?.nombre || (c?.designacion ? 'Designación: '+c.designacion.funcionId.replaceAll('_',' ') : null) || c?.alcance?.nombre || c?.evidencia?.titulo || (c?.revision ? 'Revisión '+(RESULTS[c.revision.conclusion] || c.revision.conclusion) : dto.nombre || dto.titulo || dto.operacion?.nombre || dto.id);
}
export function viewProps(dto, reviewDto = null) {
  const req = dto.contenido.requisito, ficha = dto.contenido.paquete.ficha;
  const decision = req.resultado.decision;
  return {ficha,requisito:req,showSatisfaction:false,decisionRecord:{id:req.decisionId,numero:dto.version,reglaId:ficha.reglaId,versionRegla:ficha.versionRegla,
    versionContexto:req.resultado.snapshot?.contexto?.version,decision},canReview:dto.permisos?.revisar === true,
    revision:reviewDto?.contenido?.revision || null,
    // Current status is shown separately, labelled with its version. Never attach it to a past snapshot.
    revisionStatus:isCurrent(dto) && reviewDto?.id === dto.estadoRevision?.revisionId ? dto.estadoRevision : null};
}
export function publicFacts(facts = []) { return facts.map(cleanFact); }
export function answerFact(facts, key, value) {
  const next = value === 'unknown' ? {clave:key,estado:'desconocido',motivo:'por_consultar'} : value === 'conflict' ? {clave:key,estado:'conflictivo',alternativas:[{valor:true},{valor:false}]} : {clave:key,estado:'conocido',valor:value === 'yes'};
  return [...publicFacts(facts).filter(f=>f.clave!==key),next];
}
export function period(desde, hasta) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde || '') || !/^\d{4}-\d{2}-\d{2}$/.test(hasta || '') || desde >= hasta) throw new ApiError('Indica un periodo válido: la fecha final es exclusiva y posterior a la inicial.',400);
  return {desde,hasta,calendario:'gregoriano',jurisdiccion:'ES',zonaEvaluacion:'Europe/Madrid'};
}
export function reviewConclusion(criteria) {
  if (!criteria.length || criteria.some(c=>!Object.hasOwn({favorable:1,desfavorable:1,no_determinado:1},c.resultado))) return null;
  return criteria.every(c=>c.resultado==='favorable') ? 'favorable' : criteria.some(c=>c.resultado==='desfavorable') ? 'desfavorable' : 'no_determinado';
}
export function routeFacts(dto, route) {
  const facts=dto.contenido.requisito.resultado.snapshot.contexto.hechos || [];
  return (route?.hechosRequeridos || []).map(guard=>{
    const fact=facts.find(f=>f.clave===guard.clave);
    return {...guard, fact, state:fact?.estado==='conocido' ? (fact.valor===guard.valor?'coincide':'no_coincide') : fact?.estado==='conflictivo'?'en_conflicto':'desconocido'};
  });
}
export function reviewCriteria(ficha, routeId) {
  if(ficha.schemaVersion!==2)return ficha.criterios;
  const route=ficha.satisfaccion.rutas.find(r=>r.id===routeId);
  return route ? route.requiereTodos.map(id=>ficha.criterios.find(c=>c.id===id)) : [];
}
export function reviewBody(dto, evidence, criteria, dates, motivo, ruta) {
  if (!canReview(dto)) throw new ApiError('El servidor no ha habilitado una revisión de esta versión.',409);
  const ficha=dto.contenido.paquete.ficha;
  const route=ficha.schemaVersion===2 ? ficha.satisfaccion.rutas.find(r=>r.id===ruta?.id) : null;
  if(ficha.schemaVersion===2 && (!route || !ruta.motivo?.trim()))throw new ApiError('Selecciona y justifica la alternativa que vas a revisar.',400);
  const expected = reviewCriteria(ficha, ruta?.id);
  if (criteria.length !== expected.length || new Set(criteria.map(c=>c.criterioId)).size !== expected.length || expected.some(c=>!criteria.some(r=>r.criterioId===c.id))) throw new ApiError('Revisa todos los criterios de la ficha, sin duplicarlos.',400);
  const conclusion = reviewConclusion(criteria);
  if (!conclusion || criteria.some(c=>!c.motivo.trim() || (c.resultado==='favorable' && !c.evidenciaIds.length))) throw new ApiError('Cada criterio necesita una valoración y un motivo; los favorables necesitan evidencia.',400);
  if(route && criteria.some(c=>!['compatible','desconocida','en_conflicto'].includes(c.compatibilidad?.estado) || !c.compatibilidad?.motivo?.trim() || (c.resultado==='favorable' && c.compatibilidad.estado!=='compatible')))throw new ApiError('Motiva la compatibilidad de cada criterio. Un conflicto o duda no admite valoración favorable.',400);
  if(route && conclusion==='favorable' && routeFacts(dto,route).some(f=>f.state!=='coincide'))throw new ApiError('Los datos de esta alternativa no están resueltos. Acláralos y actualiza la contextualización; no se cambiará la conclusión automáticamente.',400);
  const used = new Set(criteria.flatMap(c=>c.evidenciaIds));
  if ([...used].some(id=>!evidence.some(e=>e.id===id))) throw new ApiError('Vuelve a seleccionar la evidencia exacta consultada.',400);
  for(const row of criteria)for(const id of row.evidenciaIds)if(!evidenceEligible(evidence.find(e=>e.id===id),expected.find(c=>c.id===row.criterioId),dates,dto.contenido.requisito.alcance.id,dto,row.resultado))throw new ApiError('La evidencia ya no coincide con el tipo, objeto, periodo, designación o vigencia de este criterio.',400);
  return {requisito:exactRef(dto),tipo:'interna',periodo:period(dates.desde,dates.hasta),criterios:criteria,
    evidencias:evidence.filter(e=>used.has(e.id)).map(exactRef),conclusion,motivo,...(route?{ruta:{id:route.id,motivo:ruta.motivo}}:{})};
}
export function evidenceEligible(dto, criterion, dates, scopeId, requirement, result) {
  const e=dto.contenido?.evidencia;
  const d=e?.soporte?.tipo==='designacion_versionada'?e.soporte.designacion:null;
  const object=requirement?.contenido.objeto, scope=requirement?.contenido.requisito.alcance;
  const designationOK=!d || (!!object && d.objeto.tipo===object.tipo && d.objeto.id===object.id && d.objeto.version===object.version && d.alcance.version===scope.version && d.alcance.sha256===scope.sha256 && d.periodo.desde<=dates.desde && (!d.periodo.hasta || d.periodo.hasta>=dates.hasta) && (result!=='favorable'||d.estado==='identificada'));
  return isCurrent(dto) && dto.vigencia?.requiereRevision === false && e?.alcanceIds.includes(scopeId) && criterion.tiposEvidencia.includes(e.tipo) && !!dates.desde && !!dates.hasta && e.periodo.desde <= dates.desde && e.periodo.hasta >= dates.hasta && designationOK;
}

