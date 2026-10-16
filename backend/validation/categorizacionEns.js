'use strict';
const { copiarJSON, objeto, exigir, mongoId, fecha, zonaEvaluacion } = require('./aplicabilidadContextual');
const { texto, version } = require('./paqueteNormativo');
const DIMENSIONES = Object.freeze(['C','I','T','A','D']);
const NIVELES = Object.freeze(['BAJO','MEDIO','ALTO','NO_AFECTADA','DESCONOCIDO','CONFLICTIVO']);
const CRITERIOS = Object.freeze(['CAT_AMBITO','CAT_VALORACIONES','CAT_AGREGACION','CAT_DETERMINACION','CAT_REEVALUACION']);
const TIPOS = Object.freeze(['categorizacion_ens','determinacion_ens','revision_categorizacion_ens']);
const INMUTABLES = Object.freeze(['determinacion_ens','revision_categorizacion_ens']);
const LIMITES = Object.freeze({elementos:50,referencias:50,nombre:120,descripcion:1000,justificacion:2000,motivo:300});
function ref(r) { objeto(r,['id','version','sha256']); mongoId(r.id); version(r.version); exigir(r.version<=999999999,'version'); exigir(typeof r.sha256==='string'&&/^[a-f0-9]{64}$/.test(r.sha256),'sha256'); return r; }
function lista(a,max=50,min=0){exigir(Array.isArray(a)&&a.length>=min&&a.length<=max,'lista');return a;}
function refs(a,min=0){lista(a,50,min).forEach(ref);exigir(new Set(a.map(r=>r.id)).size===a.length,'referencias_duplicadas');return a;}
function periodo(p){objeto(p,['desdeEn','hastaEn','zonaEvaluacion']);fecha(p.desdeEn);fecha(p.hastaEn);exigir(p.desdeEn<=p.hastaEn,'periodo');zonaEvaluacion(p.zonaEvaluacion);return p;}
function elemento(e){
 objeto(e,['id','version','tipo','nombre','descripcion','responsable','evidencias','valoradoEn','limitaciones','dimensiones']);
 exigir(typeof e.id==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(e.id)&&!['constructor','prototype','__proto__','toJSON'].includes(e.id),'elemento_id');
 version(e.version);exigir(e.version<=999999999,'elemento_version');exigir(['informacion','servicio'].includes(e.tipo),'tipo_elemento');texto(e.nombre,120);texto(e.descripcion,1000);texto(e.limitaciones,2000);
 if(e.responsable!==null)ref(e.responsable);refs(e.evidencias);if(e.valoradoEn!==null)fecha(e.valoradoEn);
 objeto(e.dimensiones,DIMENSIONES);
 for(const d of DIMENSIONES){const x=e.dimensiones[d];objeto(x,['nivel','motivo','criteriosImpacto']);exigir(NIVELES.includes(x.nivel),'nivel');texto(x.motivo,2000);texto(x.criteriosImpacto,2000);}
 return e;
}
function validar(tipo,entrada,editar=false){
 exigir(TIPOS.includes(tipo)&&!(editar&&INMUTABLES.includes(tipo)),'tipo_categorizacion');
 const d=copiarJSON(entrada),comunes=['motivo',...(editar?['version']:[])];
 if(tipo==='categorizacion_ens'){
  objeto(d,[...comunes,'sistema','alcance','baseAplicabilidad','inventario','historialTemporal']);ref(d.sistema);ref(d.alcance);
  objeto(d.baseAplicabilidad,['tipo','motivo','evidencias']);exigir(['por_aclarar','legal','contractual','voluntaria'].includes(d.baseAplicabilidad.tipo),'base_aplicabilidad');texto(d.baseAplicabilidad.motivo,2000);refs(d.baseAplicabilidad.evidencias);
  const inv=d.inventario;objeto(inv,['completo','delimitacion','exclusiones','dependencias','elementos']);exigir(typeof inv.completo==='boolean','inventario_completo');
  for(const k of ['delimitacion','exclusiones','dependencias'])texto(inv[k],2000);
  lista(inv.elementos,50).forEach(elemento);exigir(new Set(inv.elementos.map(e=>e.id)).size===inv.elementos.length,'elemento_duplicado');
  const h=d.historialTemporal;objeto(h,['estado','origenSistema','fechaInicio','ultimaDeterminacionEn','ultimaReevaluacionEn','cambiosSignificativos','motivo','evidencias']);
  exigir(['conocido','desconocido','conflictivo'].includes(h.estado),'historial_estado');exigir(['nuevo','existente','desconocido'].includes(h.origenSistema),'historial_origen');
  exigir(['no','pendientes','examinados','desconocido'].includes(h.cambiosSignificativos),'historial_cambios');texto(h.motivo,2000);refs(h.evidencias);
  for(const k of ['fechaInicio','ultimaDeterminacionEn','ultimaReevaluacionEn'])if(h[k]!==null)fecha(h[k]);
 }else if(tipo==='determinacion_ens'){
  objeto(d,[...comunes,'categorizacion','categoria','responsable','determinadaEn','evidencias']);ref(d.categorizacion);ref(d.responsable);refs(d.evidencias,1);fecha(d.determinadaEn);exigir(['BASICA','MEDIA','ALTA'].includes(d.categoria),'categoria');
 }else{
  objeto(d,[...comunes,'categorizacion','determinacion','evidencias','criterios','conclusion','periodoExaminado','examinadaEn','tipoRevision','revisionAnterior','modalidadTemporal','finalidadRevision']);ref(d.categorizacion);if(d.determinacion!==null)ref(d.determinacion);refs(d.evidencias);periodo(d.periodoExaminado);fecha(d.examinadaEn);exigir(d.periodoExaminado.hastaEn<=d.examinadaEn,'examen_antes_de_periodo');
  exigir(['inicial_sin_reevaluacion_vencida','determinacion_previa_sin_reevaluacion_vencida','reevaluacion_documentada','no_determinada'].includes(d.modalidadTemporal),'modalidad_temporal');
  exigir(['actual','historica'].includes(d.finalidadRevision),'finalidad_revision');
  exigir(['inicial','anual','cambio_significativo','otra'].includes(d.tipoRevision),'tipo_revision');if(d.revisionAnterior!==null)ref(d.revisionAnterior);
  lista(d.criterios,5,5);exigir(new Set(d.criterios.map(c=>c.id)).size===5,'criterios_duplicados');
  for(const c of d.criterios){objeto(c,['id','resultado','motivo','evidenciaIds']);exigir(CRITERIOS.includes(c.id),'criterio');exigir(['favorable','desfavorable','no_determinado'].includes(c.resultado),'resultado');texto(c.motivo,2000);lista(c.evidenciaIds);exigir(new Set(c.evidenciaIds).size===c.evidenciaIds.length,'evidencias_duplicadas');for(const ev of c.evidenciaIds){mongoId(ev);exigir(d.evidencias.some(r=>r.id===ev),'evidencia_no_aportada');}if(c.resultado==='favorable')exigir(c.evidenciaIds.length>0,'favorable_sin_evidencia');}
  const conclusion=d.criterios.some(c=>c.resultado==='desfavorable')?'desfavorable':d.criterios.some(c=>c.resultado==='no_determinado')?'no_determinado':'favorable';exigir(d.conclusion===conclusion,'conclusion_incoherente');
 }
 texto(d.motivo,300);if(editar){version(d.version);exigir(d.version<=999999999,'version');}return d;
}
module.exports={validar,DIMENSIONES,NIVELES,CRITERIOS,TIPOS,INMUTABLES,LIMITES};
