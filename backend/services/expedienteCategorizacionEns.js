'use strict';
const H=require('../models/RegistroNormativo'),V=require('../models/VersionRegistroNormativo');
const {huella,exigir}=require('../validation/aplicabilidadContextual');
const {fallo}=require('./datosOrganizacion');
const {calcular,versionarElementos,pendienteDocumental,soloDatos}=require('./calculoCategorizacionEns');
const civil=(at,zone)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
const {aniversario,validarTemporalidad}=require('./temporalidadCategorizacionEns');
function crearExtensionEns({alcance,referenciado,registro,designacionActual,evidenciaActual,referencia,compararRef,q,reloj}){
 async function evidencias(org,refs,c,session,estricto=true){
  const motivos=[];
  for(const ref of refs){const ev=await evidenciaActual(org,ref,session,estricto);if(!ev.evidencia.alcanceIds.includes(c.alcance.id))fallo('RECURSO_NO_DISPONIBLE');if(huella(ref)!==huella(referencia(ev.h,ev.v)))motivos.push('evidencia_modificada:'+ref.id);motivos.push(...ev.motivos);}
  return motivos;
 }
 async function responsable(org,ref,funcion,c,en,session,estricto=true){
  const r=await designacionActual(org,ref,session,estricto),d=r.designacion;
  if(d.objeto.tipo!=='sistema'||d.objeto.id!==c.sistema.id||d.alcance.id!==c.alcance.id)fallo('RECURSO_NO_DISPONIBLE');
  if(estricto){compararRef(c.alcance,d.alcance);compararRef(c.sistema,{id:d.objeto.id,version:d.objeto.version,sha256:d.objeto.sha256});}
  const motivos=[...r.motivos];
  if(huella(ref)!==huella(referencia(r.h,r.v)))motivos.push('responsable_modificado:'+ref.id);
  if(d.funcionId!==funcion||d.estado!=='identificada')motivos.push('autoridad_funcional_no_constatada:'+ref.id);
  const day=civil(en,d.periodo.zonaEvaluacion);if(day<d.periodo.desde||(d.periodo.hasta!==null&&day>=d.periodo.hasta))motivos.push('designacion_fuera_periodo:'+ref.id);
  if(estricto&&motivos.length)fallo('DATOS_INVALIDOS');return motivos;
 }
 async function bases(org,c,session,estricto=false){
  const motivos=[];
  const ar=await alcance(org,c.alcance,session,estricto);motivos.push(...ar.motivos);
  const s=await registro(org,'sistema',c.sistema.id,session);
  if(estricto)compararRef(c.sistema,referencia(s.h,s.v));else if(huella(c.sistema)!==huella(referencia(s.h,s.v)))motivos.push('sistema_modificado');
  if(s.v.contenido.alcance.id!==c.alcance.id)fallo('RECURSO_NO_DISPONIBLE');
  if(estricto)compararRef(c.alcance,s.v.contenido.alcance);
  motivos.push(...await evidencias(org,[...c.baseAplicabilidad.evidencias,...c.historialTemporal.evidencias],c,session,estricto));
  for(const e of c.inventario.elementos){
   motivos.push(...await evidencias(org,e.evidencias,c,session,estricto));
   if(e.responsable)motivos.push(...await responsable(org,e.responsable,e.tipo==='informacion'?'RESPONSABLE_INFORMACION':'RESPONSABLE_SERVICIO',c,e.valoradoEn||reloj().toISOString(),session,estricto));
  }
  return [...new Set(motivos)];
 }
 async function ultima(org,tipo,catId,session){const h=await q(H.findOne({organizacion:org,tipo,categorizacion_id:catId}).sort({_id:-1}),session);return h?registro(org,tipo,h._id,session):null;}
 async function construir(tipo,d,ctx,h,n){
  const org=ctx.contexto.organizacionId,session=ctx.session,ahora=reloj().toISOString();
  if(tipo==='categorizacion_ens'){
   const c=soloDatos(d);let anterior=null;
   if(n>1){anterior=(await registro(org,tipo,h._id,session)).v.contenido.categorizacion;if(anterior.sistema.id!==c.sistema.id||anterior.alcance.id!==c.alcance.id)fallo('DATOS_INVALIDOS');}
   for(const e of c.inventario.elementos)if(e.valoradoEn!==null&&e.valoradoEn>ahora)fallo('DATOS_INVALIDOS');
   const hist=c.historialTemporal;
   for(const k of ['fechaInicio','ultimaDeterminacionEn','ultimaReevaluacionEn'])if(hist[k]!==null&&hist[k]>ahora)fallo('DATOS_INVALIDOS');
   if(hist.estado==='conocido'){
    if(hist.fechaInicio&&hist.ultimaDeterminacionEn&&hist.fechaInicio>hist.ultimaDeterminacionEn)fallo('DATOS_INVALIDOS');
    if(hist.ultimaReevaluacionEn&&hist.ultimaDeterminacionEn&&hist.ultimaReevaluacionEn<hist.ultimaDeterminacionEn)fallo('DATOS_INVALIDOS');
   }
   await bases(org,c,session,true);
   c.identidadesElementos=versionarElementos(c.inventario.elementos,anterior?.inventario.elementos||[],anterior?.identidadesElementos||[]);
   c.propuesta=calcular(c.inventario);c.carenciasDocumentales=pendienteDocumental(c);
   c.cobertura='Categorización ENS en desarrollo; no selección de medidas ni certificación. Referencia: arts.40/41 y anexo I RD311/2022. Criterios CCN remitidos, no reproducidos.';
   return {contenido:{categorizacion:c},titulo:'Categorización ENS del sistema',alcanceIds:[c.alcance.id],requisitoIds:[],sistemaId:c.sistema.id,categorizacionId:String(h._id)};
  }
  const cat=await referenciado(org,'categorizacion_ens',d.categorizacion,session),c=cat.v.contenido.categorizacion;
  await bases(org,c,session,true);
  await evidencias(org,d.evidencias,c,session,true);
  if(tipo==='determinacion_ens'){
   if(d.determinadaEn>ahora||c.propuesta.estado!=='PROPUESTA_CALCULADA'||d.categoria!==c.propuesta.categoriaPropuesta||pendienteDocumental(c).length)fallo('DATOS_INVALIDOS');
   if(c.inventario.elementos.some(e=>e.valoradoEn>d.determinadaEn))fallo('DATOS_INVALIDOS');
   await responsable(org,d.responsable,'RESPONSABLE_SEGURIDAD',c,d.determinadaEn,session,true);
   return {contenido:{determinacion:{...soloDatos(d),naturaleza:'constancia_atribuida_no_revision_favorable',esCertificacion:false}},titulo:'Determinación ENS '+d.categoria,alcanceIds:[c.alcance.id],requisitoIds:[],sistemaId:c.sistema.id,categorizacionId:String(cat.h._id)};
  }
  if(d.examinadaEn>ahora)fallo('DATOS_INVALIDOS');
  const prev=await ultima(org,'revision_categorizacion_ens',cat.h._id,session);
  if(prev){if(!d.revisionAnterior)fallo('VERSION_DESACTUALIZADA');compararRef(d.revisionAnterior,referencia(prev.h,prev.v));if(d.examinadaEn<prev.v.contenido.revisionCategorizacion.examinadaEn)fallo('DATOS_INVALIDOS');}
  else if(d.revisionAnterior!==null)fallo('RECURSO_NO_DISPONIBLE');
  let det=null;
  if(d.determinacion){
   det=await referenciado(org,'determinacion_ens',d.determinacion,session);
   const x=det.v.contenido.determinacion;compararRef(x.categorizacion,d.categorizacion);
   if(x.determinadaEn>d.examinadaEn)fallo('DATOS_INVALIDOS');
   await responsable(org,x.responsable,'RESPONSABLE_SEGURIDAD',c,x.determinadaEn,session,true);await evidencias(org,x.evidencias,c,session,true);
  }
  validarTemporalidad(c,d,det);
  if(d.conclusion==='favorable'&&(!det||c.propuesta.estado!=='PROPUESTA_CALCULADA'||pendienteDocumental(c).length))fallo('DATOS_INVALIDOS');
  return {contenido:{revisionCategorizacion:{...soloDatos(d),registradaEn:ahora,esCertificacion:false}},titulo:'Revisión de categorización ENS: '+d.conclusion,alcanceIds:[c.alcance.id],requisitoIds:[],sistemaId:c.sistema.id,categorizacionId:String(cat.h._id)};
 }
 async function estado(org,h,v,session){
  const cat=h.tipo==='categorizacion_ens'?await registro(org,h.tipo,h._id,session):await registro(org,'categorizacion_ens',h.categorizacion_id,session);
  const c=cat.v.contenido.categorizacion,ref=referencia(cat.h,cat.v),motivos=[];
  // Removed/changed references invalidate the derived view, never historical snapshots.
  async function observar(fn){try{motivos.push(...await fn());}catch(e){if(['RECURSO_NO_DISPONIBLE','VERSION_DESACTUALIZADA','DATOS_INVALIDOS'].includes(e.codigo))motivos.push('fundamento_no_disponible_o_modificado');else throw e;}}
  await observar(()=>bases(org,c,session,false));
  const det=await ultima(org,'determinacion_ens',cat.h._id,session),rev=await ultima(org,'revision_categorizacion_ens',cat.h._id,session),ahora=reloj().toISOString(),avisos=[];
  let determinacion=null,revision=null;
  if(det){const d=det.v.contenido.determinacion;determinacion={referencia:referencia(det.h,det.v),categoria:d.categoria,determinadaEn:d.determinadaEn};if(huella(d.categorizacion)!==huella(ref))motivos.push('categorizacion_posterior_a_determinacion');await observar(()=>responsable(org,d.responsable,'RESPONSABLE_SEGURIDAD',c,ahora,session,false));await observar(()=>evidencias(org,d.evidencias,c,session,false));}
  if(rev){const r=rev.v.contenido.revisionCategorizacion;revision={referencia:referencia(rev.h,rev.v),conclusion:r.conclusion,periodoExaminado:r.periodoExaminado,examinadaEn:r.examinadaEn,tipoRevision:r.tipoRevision,modalidadTemporal:r.modalidadTemporal,finalidadRevision:r.finalidadRevision};if(huella(r.categorizacion)!==huella(ref))motivos.push('categorizacion_posterior_a_revision');if(r.determinacion&&(!det||huella(r.determinacion)!==huella(referencia(det.h,det.v))))motivos.push('determinacion_posterior_a_revision');await observar(()=>evidencias(org,r.evidencias,c,session,false));avisos.push('conclusion_limitada_al_periodo_examinado_no_prueba_continua');}
  const hist=c.historialTemporal;
  if(hist.estado!=='conocido')avisos.push('historial_temporal_no_resuelto');
  if(hist.cambiosSignificativos==='pendientes')motivos.push('cambio_significativo_pendiente');
  const ciclo=hist.ultimaReevaluacionEn||hist.ultimaDeterminacionEn||determinacion?.determinadaEn;
  if(ciclo&&aniversario(ciclo)<=ahora){motivos.push('reevaluacion_anual_pendiente');avisos.push('reevaluacion_anual_por_comprobar_no_caducidad_de_evidencias');}
  // Operational follow-up is distinct from historical proof. Elapsed milliseconds
  // do not invalidate a review; changed foundations and a due cycle do.
  const satisfaccionActual=motivos.length?'requiere_revision':!revision?'sin_revisar':revision.finalidadRevision!=='actual'?'no_determinado':revision.conclusion;
  if(revision&&revision.finalidadRevision!=='actual')avisos.push('conclusion_historica_no_cobertura_actual_automatica');
  if(revision?.finalidadRevision==='actual')avisos.push('estado_de_seguimiento_no_certificacion_ni_prueba_continua');
  return {vigencia:{requiereRevision:motivos.length>0,motivos:[...new Set(motivos)],seRefiereAVersionActual:cat.v.numero},estadoCategorizacion:{seRefiereAVersionActual:cat.v.numero,fase:rev?'revision_registrada':det?'determinacion_registrada':'propuesta',determinacion,revision,satisfaccionActual,avisos,esCertificacion:false}};
 }
 return {construir,estado};
}
module.exports={crearExtensionEns,aniversario};
