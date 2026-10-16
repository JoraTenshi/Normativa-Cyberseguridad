'use strict';
const H=require('../models/RegistroNormativo'),O=require('../models/Operacion'),RO=require('../models/RevisionOperacion'),M=require('../models/Membresia');
const {huella,exigir}=require('../validation/aplicabilidadContextual');
const {soloDatos,contrato,validarEvidenciasRevision}=require('../validation/registroRAT');
const {contextoDeRevisionOperacion}=require('./operaciones');
const {diagnosticarRAT}=require('./evaluacionRAT');
const {fallo}=require('./datosOrganizacion');
const dia=at=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
function crearExtensionRAT({alcance,registro,referenciado,evidenciaActual,referencia,compararRef,q,reloj}){
 async function inventario(org,ar,session){
  const total=await O.countDocuments({organizacion:org}).session(session).maxTimeMS(5000);
  const cabeceras=await q(O.find({organizacion:org}).sort({_id:1}).limit(200),session);
  const todas=[];
  for(const o of cabeceras){const r=await q(RO.findOne({organizacion:org,operacion:o._id,numero:o.version_actual}),session);todas.push({ref:{id:String(o._id),version:r?.numero,sha256:r?.sha256},contexto:contextoDeRevisionOperacion(o,r)});}
  const ids=new Set(ar.r.contenido.origen.operaciones.map(o=>o.id));
  return {total,todas,perimetro:todas.filter(o=>ids.has(o.ref.id))};
 }
 async function bases(org,c,session,estricto=false){
  const ar=await alcance(org,c.alcance,session,estricto),motivos=[...ar.motivos];
  const inv=await inventario(org,ar,session),ops=[];
  for(const ref of c.entradas.flatMap(e=>e.operaciones)){
   if(!ar.r.contenido.origen.operaciones.some(o=>o.id===ref.id)){
    if(estricto)fallo('RECURSO_NO_DISPONIBLE');
    motivos.push('operacion_fuera_del_perimetro_actual:'+ref.id);
   }
   const o=await q(O.findOne({_id:ref.id,organizacion:org}),session);if(!o)fallo('RECURSO_NO_DISPONIBLE');
   const r=await q(RO.findOne({operacion:o._id,organizacion:org,numero:o.version_actual}),session);
   const actual={id:String(o._id),version:r?.numero,sha256:r?.sha256};
   const contexto=contextoDeRevisionOperacion(o,r);
   if(estricto)compararRef(ref,actual);else if(huella(ref)!==huella(actual))motivos.push('operacion_modificada:'+ref.id);
   ops.push({ref:actual,contexto});
  }
  if(inv.perimetro.length!==ar.r.contenido.origen.operaciones.length)motivos.push('inventario_perimetro_no_cubierto_por_limite');
  const refs=[...c.evidencias,...c.entradas.flatMap(e=>e.evidencias)];
  for(const ref of refs){const ev=await evidenciaActual(org,ref,session,estricto);if(!ev.evidencia.alcanceIds.includes(c.alcance.id))fallo('RECURSO_NO_DISPONIBLE');if(huella(ref)!==huella(referencia(ev.h,ev.v)))motivos.push('evidencia_modificada:'+ref.id);motivos.push(...ev.motivos);}
  return {motivos:[...new Set(motivos)],diagnostico:diagnosticarRAT(c,ops,inv.perimetro,inv.total,inv.todas),inventarioEntidad:inv.todas.map(o=>o.ref)};
 }
 async function ultima(org,h,session){return h.ultima_revision?registro(org,'revision_rat',h.ultima_revision,session):null;}
 async function construir(tipo,d,ctx,h,n){
  const org=ctx.contexto.organizacionId,session=ctx.session;
  if(tipo==='registro_rat'){
   const c=soloDatos(d);exigir(c.fechaReferencia<=dia(reloj()),'fecha_rat_futura');
   if(n>1){const prev=(await registro(org,tipo,h._id,session)).v.contenido.registroRAT;exigir(prev.funcion===c.funcion&&prev.alcance.id===c.alcance.id,'identidad_rat_inmutable');}
   const b=await bases(org,c,session,true);
   c.diagnostico=b.diagnostico;c.inventarioEntidad=b.inventarioEntidad;c.fuentes=contrato.fuentes;
   c.aviso='Registro declarado y revisión interna; no certificación ni comunicación externa automática.';
   return {contenido:{registroRAT:c},titulo:c.nombre,alcanceIds:[c.alcance.id],requisitoIds:[]};
  }
  const rat=await referenciado(org,'registro_rat',d.registro,session),c=rat.v.contenido.registroRAT;
  if(tipo==='actuacion_rat'){
   const m=await q(M.findOne({_id:d.responsableMembresiaId,organizacion:org,estado:'activa'}),session);if(!m)fallo('RECURSO_NO_DISPONIBLE');
   if(n>1){const anterior=(await registro(org,tipo,h._id,session)).v.contenido.actuacionRAT;exigir(anterior.registro.id===d.registro.id,'identidad_actuacion_rat');if(d.estado==='archivada'&&!['terminada','archivada'].includes(anterior.estado))fallo('TRANSICION_INVALIDA');}
   else if(d.estado==='archivada')fallo('TRANSICION_INVALIDA');
   return {contenido:{actuacionRAT:{...soloDatos(d),efectoSobreSatisfaccion:'ninguno'}},titulo:d.titulo,alcanceIds:[c.alcance.id],requisitoIds:[String(rat.h._id)]};
  }
  const anterior=await ultima(org,rat.h,session);
  if(anterior){if(!d.revisionAnterior)fallo('VERSION_DESACTUALIZADA');compararRef(d.revisionAnterior,referencia(anterior.h,anterior.v));}
  else if(d.revisionAnterior)fallo('VERSION_DESACTUALIZADA');
  const esperado=contrato.criterios[c.funcion];exigir(huella([...d.criterios.map(x=>x.id)].sort())===huella([...esperado].sort()),'criterios_rat_incompletos');
  exigir(d.examinadaEn<=reloj().toISOString()&&d.periodoExaminado.hasta<=dia(d.examinadaEn),'examen_rat_futuro');
  const b=await bases(org,c,session,true);
  if(huella(c.inventarioEntidad)!==huella(b.inventarioEntidad))fallo('VERSION_DESACTUALIZADA');
  const examinadas=new Map();
  for(const ref of d.evidencias){const ev=await evidenciaActual(org,ref,session,true);if(!ev.evidencia.alcanceIds.includes(c.alcance.id))fallo('RECURSO_NO_DISPONIBLE');examinadas.set(ref.id,ev.evidencia);}
  validarEvidenciasRevision(d,examinadas);
  if(d.conclusion==='favorable')exigir(b.diagnostico.permiteRevisionFavorable&&b.motivos.length===0,'rat_pendiente_no_favorable');
  await H.updateOne({_id:rat.h._id,organizacion:org,tipo:'registro_rat',version_actual:rat.h.version_actual},{$set:{ultima_revision:h._id},$inc:{__v:1}},{session,runValidators:true});
  return {contenido:{revisionRAT:{...soloDatos(d),funcion:c.funcion,alcance:c.alcance,criteriosSha256:huella(contrato.criteriosEditoriales),autorMembresiaId:ctx.contexto.membresiaId,diagnosticoExaminado:b.diagnostico,esCertificacion:false}},titulo:'Revisión RAT: '+c.nombre,alcanceIds:[c.alcance.id],requisitoIds:[String(rat.h._id)]};
 }
 async function estado(org,h,v,session){
  if(h.tipo==='actuacion_rat'){
   const r=await registro(org,'registro_rat',v.contenido.actuacionRAT.registro.id,session);
   return {vigencia:{requiereRevision:huella(v.contenido.actuacionRAT.registro)!==huella(referencia(r.h,r.v)),efectoSobreSatisfaccion:'ninguno'}};
  }
  const rat=h.tipo==='registro_rat'?(v.numero===h.version_actual?{h,v}:await registro(org,'registro_rat',h._id,session)):await registro(org,'registro_rat',v.contenido.revisionRAT.registro.id,session);
  const c=rat.v.contenido.registroRAT,b=await bases(org,c,session),motivos=[...b.motivos];
  if(huella(c.inventarioEntidad)!==huella(b.inventarioEntidad))motivos.push('inventario_entidad_modificado');
  const rv=h.tipo==='revision_rat'?{h,v}:await ultima(org,rat.h,session),revision=rv?.v.contenido.revisionRAT;
  if(revision){
   if(revision.criteriosSha256!==huella(contrato.criteriosEditoriales))motivos.push('criterios_editoriales_modificados');
   if(huella(revision.registro)!==huella(referencia(rat.h,rat.v)))motivos.push('registro_rat_modificado');
   for(const ref of revision.evidencias){const ev=await evidenciaActual(org,ref,session);if(huella(ref)!==huella(referencia(ev.h,ev.v)))motivos.push('evidencia_revision_modificada:'+ref.id);motivos.push(...ev.motivos);}
  }
  const hoy=dia(reloj()),cubrePeriodo=!!revision&&revision.periodoExaminado.desde<=hoy&&hoy<=revision.periodoExaminado.hasta;
  return {estadoRAT:{seRefiereAVersionActual:rat.v.numero,conclusionHistorica:revision?.conclusion??null,revision:rv?referencia(rv.h,rv.v):null,
   satisfaccionActual:motivos.length?'requiere_revision':!revision?'sin_revisar':!cubrePeriodo?'no_determinado':revision.conclusion,
   requiereRevision:motivos.length>0,motivos:[...new Set(motivos)],cubrePeriodo,diagnosticoActual:b.diagnostico,esCertificacion:false,
   aviso:'La conclusión histórica se conserva; fuera del periodo examinado no se extrapola automáticamente.'}};
 }
 return {construir,estado};
}
module.exports={crearExtensionRAT};
