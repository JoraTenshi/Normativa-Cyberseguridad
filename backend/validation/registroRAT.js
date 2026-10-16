'use strict';
const {copiarJSON,objeto,exigir,mongoId,fechaCivil,fecha}=require('./aplicabilidadContextual');
const {texto,version}=require('./paqueteNormativo');
const {faltaDocumentoExaminado}=require('./constatacionDocumento');
function ref(r){objeto(r,['id','version','sha256']);mongoId(r.id);version(r.version);exigir(r.version<=999999999,'version');exigir(typeof r.sha256==='string'&&/^[a-f0-9]{64}$/.test(r.sha256),'sha256');return r;}
const contrato=require('../contracts/registroRAT.v1.json');
contrato.criteriosEditoriales=require('../contracts/criteriosRAT.v1.json');
const TIPOS=['registro_rat','revision_rat','actuacion_rat'],INMUTABLES=['revision_rat'];
const list=(a,max=50,min=0)=>{exigir(Array.isArray(a)&&a.length>=min&&a.length<=max,'lista_rat');return a;};
function refs(a,min=0,max=50){list(a,max,min).forEach(ref);exigir(new Set(a.map(r=>r.id)).size===a.length,'referencia_duplicada');return a;}
function identificador(v){exigir(typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(v)&&!['constructor','prototype','__proto__','toJSON'].includes(v),'id_entrada_rat');}
function contacto(c){objeto(c,['nombre','contacto']);texto(c.nombre,120);texto(c.contacto,500);}
function campo(c,nombre){
 objeto(c,['estado','contenido','motivo']);exigir(contrato.campo.estados.includes(c.estado),'estado_campo_rat');
 exigir(typeof c.contenido==='string'&&c.contenido.length<=2000&&typeof c.motivo==='string'&&c.motivo.length<=2000,'texto_campo_rat');
 if(c.estado==='conocido')texto(c.contenido,2000);else texto(c.motivo,2000);
 if(c.contenido)texto(c.contenido,2000);if(c.motivo)texto(c.motivo,2000);
 if(c.estado==='no_corresponde')exigir(contrato.condicionales.includes(nombre),'no_corresponde_invalido');
 if(c.estado==='imposible_motivado')exigir(contrato.cuandoSeaPosible.includes(nombre),'imposibilidad_invalida');
}
function validar(tipo,entrada,editar=false){
 exigir(TIPOS.includes(tipo)&&!(editar&&INMUTABLES.includes(tipo)),'tipo_rat');
 const d=copiarJSON(entrada),comunes=['motivo',...(editar?['version']:[])];
 if(tipo==='registro_rat'){
  objeto(d,[...comunes,'alcance','funcion','nombre','fechaReferencia','inventarioCompleto','entidad','representante','dpd','sujeto77','comunicacionDPD','disponibilidadAutoridad','entradas','evidencias']);
  ref(d.alcance);exigir(contrato.funciones.includes(d.funcion),'funcion_rat');texto(d.nombre,120);fechaCivil(d.fechaReferencia);exigir(typeof d.inventarioCompleto==='boolean','completitud_rat');contacto(d.entidad);refs(d.evidencias);
  for(const k of ['representante','dpd','sujeto77','comunicacionDPD','disponibilidadAutoridad'])campo(d[k],k);
  const opIds=[];list(d.entradas,50).forEach(e=>{
   objeto(e,['id','titulo','operaciones','campos','responsables','evidencias']);identificador(e.id);texto(e.titulo,120);refs(e.operaciones,1,20);refs(e.evidencias);opIds.push(...e.operaciones.map(r=>r.id));
   const keys=d.funcion==='responsable'?contrato.camposResponsable:contrato.camposEncargado;objeto(e.campos,keys);for(const k of keys)campo(e.campos[k],k);
   list(e.responsables,20);if(d.funcion==='responsable')exigir(e.responsables.length===0,'responsables_solo_encargado');
   for(const r of e.responsables){objeto(r,['id','responsable','representante','dpd','categorias','finalidades']);identificador(r.id);contacto(r.responsable);for(const k of ['representante','dpd','categorias','finalidades'])campo(r[k],k);}
   exigir(new Set(e.responsables.map(r=>r.id)).size===e.responsables.length,'responsable_duplicado');
  });
  exigir(new Set(d.entradas.map(e=>e.id)).size===d.entradas.length,'entrada_duplicada');exigir(opIds.length<=200&&new Set(opIds).size===opIds.length,'operacion_duplicada_o_limite');
 }else if(tipo==='revision_rat'){
  objeto(d,[...comunes,'registro','revisionAnterior','evidencias','criterios','conclusion','periodoExaminado','examinadaEn']);ref(d.registro);if(d.revisionAnterior!==null)ref(d.revisionAnterior);refs(d.evidencias);fecha(d.examinadaEn);
  objeto(d.periodoExaminado,['desde','hasta']);fechaCivil(d.periodoExaminado.desde);fechaCivil(d.periodoExaminado.hasta);exigir(d.periodoExaminado.desde<=d.periodoExaminado.hasta,'periodo_rat');
  list(d.criterios,20,1);exigir(new Set(d.criterios.map(c=>c.id)).size===d.criterios.length,'criterios_duplicados');
  for(const c of d.criterios){objeto(c,['id','resultado','motivo','evidenciaIds']);exigir(Object.values(contrato.criterios).flat().includes(c.id),'criterio_rat');exigir(['favorable','desfavorable','no_determinado'].includes(c.resultado),'resultado_rat');texto(c.motivo,2000);list(c.evidenciaIds);exigir(new Set(c.evidenciaIds).size===c.evidenciaIds.length,'evidencia_duplicada');for(const ev of c.evidenciaIds){mongoId(ev);exigir(d.evidencias.some(r=>r.id===ev),'evidencia_no_aportada');}if(c.resultado==='favorable')exigir(c.evidenciaIds.length>0,'favorable_sin_evidencia');}
  const conclusion=d.criterios.some(c=>c.resultado==='desfavorable')?'desfavorable':d.criterios.some(c=>c.resultado==='no_determinado')?'no_determinado':'favorable';exigir(d.conclusion===conclusion,'conclusion_rat_incoherente');
 }else{
  objeto(d,[...comunes,'registro','titulo','descripcion','responsableMembresiaId','estado']);ref(d.registro);texto(d.titulo,120);texto(d.descripcion,2000);mongoId(d.responsableMembresiaId);exigir(['pendiente','en_curso','terminada','archivada'].includes(d.estado),'estado_actuacion_rat');
 }
 texto(d.motivo,300);if(editar){version(d.version);exigir(d.version<=999999999,'version');}return d;
}
function soloDatos(d){const c=copiarJSON(d);for(const k of ['version','motivo','clave'])delete c[k];return c;}
function validarEvidenciasRevision(d,evidencias){
 const usadas=new Set();
 for(const criterio of d.criterios)for(const id of criterio.evidenciaIds){
  const ev=evidencias.get(id);exigir(!!ev,'evidencia_rat_ausente');
  exigir(['version_documento','constatacion_documento','constatacion_revision'].includes(ev.tipo),'tipo_evidencia_rat');
  exigir(ev.periodo.calendario==='gregoriano'&&ev.periodo.jurisdiccion==='ES'&&ev.periodo.zonaEvaluacion==='Europe/Madrid'&&ev.periodo.desde<=d.periodoExaminado.desde&&ev.periodo.hasta>d.periodoExaminado.hasta,'periodo_evidencia_rat_insuficiente');
  exigir(criterio.resultado!=='favorable'||!faltaDocumentoExaminado(ev),'documento_rat_no_identificado');
  exigir(ev.soporte.tipo!=='comprobacion'||ev.soporte.realizadaEn<=d.examinadaEn,'evidencia_rat_posterior_examen');usadas.add(id);
 }
 exigir(usadas.size===evidencias.size,'evidencia_rat_no_examinada');
}
module.exports={validar,soloDatos,validarEvidenciasRevision,TIPOS,INMUTABLES,contrato};
