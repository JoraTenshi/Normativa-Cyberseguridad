'use strict';
const {exigir}=require('../validation/aplicabilidadContextual');

function aniversario(at){
 const d=new Date(at),mes=d.getUTCMonth();
 d.setUTCFullYear(d.getUTCFullYear()+1);
 if(d.getUTCMonth()!==mes)d.setUTCDate(0);
 return d.toISOString();
}

// Validates facts as of the examination, not dates inferred from app registration.
// The evidence itself and exact references are checked by the persistent service.
function validarTemporalidad(c,revision,determinacion){
 const h=c.historialTemporal,en=revision.examinadaEn;
 exigir(c.inventario.elementos.every(e=>e.valoradoEn===null||e.valoradoEn<=en),'valoracion_posterior_al_examen');
 for(const k of ['fechaInicio','ultimaDeterminacionEn','ultimaReevaluacionEn'])exigir(h[k]===null||h[k]<=en,'historia_posterior_al_examen');
 const temporal=revision.criterios.find(x=>x.id==='CAT_REEVALUACION');
 if(temporal.resultado!=='favorable')return;
 exigir(h.estado==='conocido'&&h.origenSistema!=='desconocido'&&h.evidencias.length>0,'historia_no_constatada');
 exigir(!['pendientes','desconocido'].includes(h.cambiosSignificativos),'cambios_sin_resolver');
 if(revision.modalidadTemporal==='inicial_sin_reevaluacion_vencida'){
  exigir(h.origenSistema==='nuevo'&&h.fechaInicio!==null&&h.ultimaDeterminacionEn===null&&h.ultimaReevaluacionEn===null&&revision.tipoRevision==='inicial'&&!!determinacion,'inicial_no_acreditada');
  exigir(aniversario(h.fechaInicio)>en,'revision_inicial_vencida');
 }else if(revision.modalidadTemporal==='determinacion_previa_sin_reevaluacion_vencida'){
  exigir(h.origenSistema==='existente'&&h.ultimaDeterminacionEn!==null&&h.ultimaReevaluacionEn===null&&!!determinacion,'determinacion_previa_no_acreditada');
  exigir(aniversario(h.ultimaDeterminacionEn)>en,'determinacion_previa_vencida');
 }else if(revision.modalidadTemporal==='reevaluacion_documentada'){
  exigir(h.ultimaReevaluacionEn!==null&&aniversario(h.ultimaReevaluacionEn)>en,'reevaluacion_no_acreditada_o_vencida');
 }else exigir(false,'modalidad_temporal_no_resuelta');
}
module.exports={aniversario,validarTemporalidad};
