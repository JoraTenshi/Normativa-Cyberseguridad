'use strict';
const H=require('../models/RegistroNormativo'),O=require('../models/Operacion'),RO=require('../models/RevisionOperacion');
const {huella,validarContexto,copiarJSON,exigir}=require('../validation/aplicabilidadContextual');
const {combinar}=require('../validation/contextoEmpresa');
const {datos,contrato}=require('../validation/solicitudDerechos');
const {contextoDeRevisionOperacion}=require('./operaciones');
const {fallo}=require('./datosOrganizacion');
const CLAVES=['dp_ambito_rgpd','dp_establecimiento_es','dp_regimen_general','dp_rol'];
const desconocido=clave=>({clave,estado:'desconocido',motivo:'por_consultar'});
// Sólo combina valores coincidentes de TODAS las operaciones declaradas. Ni
// mayoría ni prioridad del rol responsable frente al encargado de otra actividad.
function contextoComun(contextos,confirmado){return CLAVES.map(clave=>{
 if(!confirmado||!contextos.length)return desconocido(clave);
 const hs=contextos.map(c=>c.hechos.find(h=>h.clave===clave));
 if(hs.some(h=>!h||h.estado!=='conocido')||hs.some(h=>huella(h.valor)!==huella(hs[0].valor)))return desconocido(clave);
 return copiarJSON(hs[0]);
});}
function crearExtensionDerechos({alcance,registro,referenciado,evidenciaActual,referencia,compararRef,q,reloj}){
 async function operacion(org,ref,session,estricto=false){
  const o=await q(O.findOne({_id:ref.id,organizacion:org}),session);if(!o)fallo('RECURSO_NO_DISPONIBLE');
  const r=await q(RO.findOne({organizacion:org,operacion:o._id,numero:o.version_actual}),session),contexto=contextoDeRevisionOperacion(o,r);
  const actual={id:String(o._id),version:r.numero,sha256:r.sha256},motivos=[];
  if(estricto)compararRef(ref,actual);else if(huella(ref)!==huella(actual))motivos.push('operacion_modificada:'+ref.id);
  return {contexto,actual,motivos};
 }
 async function evidencias(org,refs,alcances,session,estricto){const motivos=[];
  for(const ref of refs){const e=await evidenciaActual(org,ref,session,estricto);if(!e.evidencia.alcanceIds.some(a=>alcances.includes(a)))fallo('RECURSO_NO_DISPONIBLE');
   if(huella(ref)!==huella(referencia(e.h,e.v)))motivos.push('evidencia_modificada:'+ref.id);motivos.push(...e.motivos);
  }return motivos;
 }
 async function basesSolicitud(org,c,session,estricto=false){const motivos=[],operaciones=[],alcances=[];
  for(const ref of c.alcances){const a=await alcance(org,ref,session,estricto);alcances.push(a);motivos.push(...a.motivos);}
  for(const ref of c.operaciones){const o=await operacion(org,ref,session,estricto);operaciones.push(o);motivos.push(...o.motivos);}
  // Un alcance vacío/desconocido no impide registrar recepción. Si se aportan
  // ambos conjuntos, deben corresponderse, nunca referencias de otra actividad.
  if(alcances.length)for(const op of c.operaciones)if(!alcances.some(a=>a.r.contenido.origen.operaciones.some(o=>o.id===op.id))){if(estricto)fallo('RECURSO_NO_DISPONIBLE');motivos.push('operacion_fuera_de_alcances:'+op.id);}
  motivos.push(...await evidencias(org,c.evidencias,c.alcances.map(a=>a.id),session,estricto));
  return {motivos:[...new Set(motivos)],operaciones,alcances};
 }
 async function basesPretension(org,c,session,estricto=false){
  const parent=estricto?await referenciado(org,'solicitud_derechos',c.solicitud,session):await registro(org,'solicitud_derechos',c.solicitud.id,session);
  const s=parent.v.contenido.solicitudDerechos,b=await basesSolicitud(org,s,session,estricto),motivos=[...b.motivos];
  if(huella(c.solicitud)!==huella(referencia(parent.h,parent.v)))motivos.push('solicitud_modificada');
  const op=s.operaciones.find(o=>o.id===c.operacion.id),ar=s.alcances.find(a=>a.id===c.alcance.id);
  if(!op||!ar){if(estricto)fallo('RECURSO_NO_DISPONIBLE');motivos.push('pretension_fuera_del_contexto_actual');}
  if(estricto){compararRef(c.operacion,op);compararRef(c.alcance,ar);}
  const actualOp=await operacion(org,c.operacion,session,estricto),a=await alcance(org,c.alcance,session,estricto);
  if(!a.r.contenido.origen.operaciones.some(o=>o.id===c.operacion.id)){if(estricto)fallo('RECURSO_NO_DISPONIBLE');motivos.push('operacion_fuera_de_alcance');}
  motivos.push(...actualOp.motivos,...a.motivos,...await evidencias(org,c.evidencias,[c.alcance.id],session,estricto));
  if(estricto&&motivos.length)fallo('VERSION_DESACTUALIZADA');return {motivos:[...new Set(motivos)],solicitud:s,parent,operacion:actualOp};
 }
 async function pretensiones(org,id,session){
  const filas=await q(H.find({organizacion:org,tipo:'pretension_derecho',requisito_ids:id}).sort({_id:1}).limit(101),session),lista=[];
  for(const h of filas.slice(0,100)){const r=await registro(org,'pretension_derecho',h._id,session),c=r.v.contenido.pretensionDerecho;exigir(c.solicitud.id===String(id),'parent_pretension');lista.push({...r,referencia:referencia(r.h,r.v)});}
  return {lista,truncado:filas.length>100};
 }
 async function sustitucion(org,c,identificador,session,estricto=false){
  if(!c.sustitucion)return {valida:false,motivos:[]};
  try{
   exigir(c.sustitucion.destino.id!==String(identificador),'sustitucion_propia');
   const r=await referenciado(org,'pretension_derecho',c.sustitucion.destino,session),d=r.v.contenido.pretensionDerecho;
   exigir(!d.sustitucion&&d.solicitud.id===c.solicitud.id&&d.peticion===c.peticion&&(c.derecho==='por_delimitar'||c.derecho===d.derecho),'sustitucion_no_equivalente');
   await basesPretension(org,d,session,true);return {valida:true,destino:referencia(r.h,r.v),motivos:[]};
  }catch(e){if(estricto)throw e;if(['RECURSO_NO_DISPONIBLE','VERSION_DESACTUALIZADA','DATOS_INVALIDOS','CONTRATO_APLICABILIDAD_INVALIDO'].includes(e.codigo))return {valida:false,motivos:['sustitucion_pendiente_de_revision:'+identificador]};throw e;}
 }
 async function resumen(org,c,identificador,session,bases){
  const b=bases||await basesSolicitud(org,c,session),hijos=await pretensiones(org,identificador,session),pendientes=[],motivos=[...b.motivos],estadoHijos=[];
  if(!c.inventarioPretensionesCompleto)pendientes.push('inventario_pretensiones_incompleto');
  if(hijos.truncado)pendientes.push('limite_pretensiones');
  if(c.recepcion.estado!=='conocida')pendientes.push('recepcion_por_determinar');
  if(c.personaReferencia===null)pendientes.push('persona_por_delimitar');
  if(c.canal.estado!=='conocido')pendientes.push('canal_por_determinar');
  if(!c.operaciones.length)pendientes.push('operaciones_por_delimitar');
  if(c.alcances.length!==1)pendientes.push(c.alcances.length?'procedimiento_multialcance_fuera_de_cobertura':'alcance_por_delimitar');
  const comunes=contextoComun(b.operaciones.map(o=>o.contexto),c.contextoOperacion==='confirmado');
  if(comunes.some(h=>h.estado!=='conocido'))pendientes.push('contexto_no_confirmado_o_no_homogeneo');
  let activas=0;
  for(const hijo of hijos.lista){const v=hijo.v.contenido.pretensionDerecho,s=await sustitucion(org,v,hijo.h._id,session);
   if(s.valida){estadoHijos.push({...hijo.referencia,derecho:v.derecho,estadoTecnico:'sustituida',destino:s.destino});continue;}
   activas++;motivos.push(...s.motivos);const bp=await basesPretension(org,v,session);motivos.push(...bp.motivos.map(m=>'pretension:'+hijo.h._id+':'+m));
   if(v.derecho==='por_delimitar')pendientes.push('derecho_por_delimitar:'+hijo.h._id);
   estadoHijos.push({...hijo.referencia,derecho:v.derecho,estadoTecnico:'activa',motivos:[...s.motivos,...bp.motivos]});
  }
  if(!activas)pendientes.push('pretensiones_por_delimitar');
  const hecho=c.hechos.find(h=>h.clave==='sol_expediente_delimitado');
  if(hecho?.estado!=='conocido'||hecho.valor!==true)pendientes.push('delimitacion_no_confirmada');
  pendientes.push(...motivos);
  return {b,hijos,estadoHijos,comunes,motivos:[...new Set(motivos)],pendientes:[...new Set(pendientes)],habilita:pendientes.length===0};
 }
 async function construir(tipo,d,ctx,h,n){const org=ctx.contexto.organizacionId,session=ctx.session,c=datos(d);
  if(tipo==='solicitud_derechos'){
   if(n>1){const prev=(await registro(org,tipo,h._id,session)).v.contenido.solicitudDerechos;
    exigir((huella([prev.operaciones,prev.alcances])!==huella([c.operaciones,c.alcances]))===d.confirmarBases,'confirmacion_bases_derechos');
    exigir((huella(prev.recepcion)!==huella(c.recepcion))===d.confirmarRecepcion,'confirmacion_recepcion');
   }
   if(c.recepcion.estado==='conocida'){
    const r=c.recepcion;if(r.precision==='instante')exigir(r.instante<=reloj().toISOString(),'recepcion_futura');
    else {const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:r.zona,year:'numeric',month:'2-digit',day:'2-digit'}).format(reloj());exigir(r.fecha<=hoy,'recepcion_futura');}
   }
   c.hechos=combinar([],c.hechos,ctx.contexto.membresiaId);await basesSolicitud(org,c,session,true);
   return {contenido:{solicitudDerechos:c},titulo:'Solicitud de derechos',alcanceIds:c.alcances.map(a=>a.id),requisitoIds:[]};
  }
  if(c.sustitucion){
   exigir(n>1,'sustitucion_solo_actualizacion');const prev=(await registro(org,tipo,h._id,session)).v.contenido.pretensionDerecho;
   const sinSustitucion=x=>{const {sustitucion,...resto}=x;return resto;};
   exigir(huella(sinSustitucion(prev))===huella(sinSustitucion(c))&&!d.confirmarBases,'sustitucion_no_reescribe_peticion');
   await sustitucion(org,c,h._id,session,true);
   return {contenido:{pretensionDerecho:c},titulo:'Pretensión de '+c.derecho.replaceAll('_',' '),alcanceIds:[c.alcance.id],requisitoIds:[c.solicitud.id]};
  }
  if(n>1){const prev=(await registro(org,tipo,h._id,session)).v.contenido.pretensionDerecho;
   exigir(prev.solicitud.id===c.solicitud.id&&prev.operacion.id===c.operacion.id&&prev.alcance.id===c.alcance.id,'identidad_pretension');
   exigir((huella([prev.solicitud,prev.operacion,prev.alcance])!==huella([c.solicitud,c.operacion,c.alcance]))===d.confirmarBases,'confirmacion_bases_pretension');
  }
  await basesPretension(org,c,session,true);
  return {contenido:{pretensionDerecho:c},titulo:'Pretensión de '+c.derecho.replaceAll('_',' '),alcanceIds:[c.alcance.id],requisitoIds:[c.solicitud.id]};
 }
 async function contexto(org,objeto,ar,session){
  const r=await registro(org,objeto.tipo,objeto.id,session);if(r.h.version_actual!==objeto.version)fallo('VERSION_DESACTUALIZADA');
  if(objeto.tipo==='pretension_derecho'){
   const c=r.v.contenido.pretensionDerecho;if(c.sustitucion)fallo('VERSION_DESACTUALIZADA');const b=await basesPretension(org,c,session,true);compararRef(c.alcance,ar.actual);
   const hechos=contextoComun([b.operacion.contexto],b.solicitud.contextoOperacion==='confirmado');
   return {contexto:validarContexto({id:'ctx_pre_'+r.h._id,version:r.v.numero,organizacionId:String(org),objeto:{tipo:objeto.tipo,id:String(r.h._id)},registradoEn:new Date(r.v.createdAt).toISOString(),hechos}),objetoSha256:r.v.sha256};
  }
  const c=r.v.contenido.solicitudDerechos,b=await basesSolicitud(org,c,session,true),res=await resumen(org,c,r.h._id,session,b),hijos=res.hijos;
  if(!c.alcances.some(a=>a.id===ar.actual.id))fallo('RECURSO_NO_DISPONIBLE');
  for(const a of c.alcances)if(a.id===ar.actual.id)compararRef(a,ar.actual);
  const propios=copiarJSON(c.hechos);if(!res.habilita){const i=propios.findIndex(h=>h.clave==='sol_expediente_delimitado');propios[i]=desconocido('sol_expediente_delimitado');}
  const hechos=[...res.comunes,...propios];
  return {contexto:validarContexto({id:'ctx_sol_'+r.h._id,version:r.v.numero,organizacionId:String(org),objeto:{tipo:objeto.tipo,id:String(r.h._id)},registradoEn:new Date(r.v.createdAt).toISOString(),hechos}),
   objetoSha256:huella({solicitud:r.v.sha256,pretensiones:hijos.lista.map(h=>h.referencia),truncado:hijos.truncado})};
 }
 async function estado(org,h,v,session){const actual=v.numero===h.version_actual?{h,v}:await registro(org,h.tipo,h._id,session),c=actual.v.contenido[h.tipo==='solicitud_derechos'?'solicitudDerechos':'pretensionDerecho'];
  const b=h.tipo==='solicitud_derechos'?await basesSolicitud(org,c,session):await basesPretension(org,c,session);
  const extra=h.tipo==='solicitud_derechos'?await resumen(org,c,h._id,session,b):null;
  const sub=h.tipo==='pretension_derecho'?await sustitucion(org,c,h._id,session):null;
  const motivos=extra?extra.motivos:sub?.valida?[]:[...b.motivos,...(sub?.motivos||[])];
  return {vigenciaBases:{requiereRevision:b.motivos.length>0,motivos:b.motivos,seRefiereAVersionActual:actual.v.numero},
   vigencia:{requiereRevision:motivos.length>0,motivos,seRefiereAVersionActual:actual.v.numero},
   gestionDerechos:{seRefiereAVersionActual:actual.v.numero,recepcion:(h.tipo==='solicitud_derechos'?c:b.solicitud).recepcion,vencimiento:'no_calculado',
    ...(extra?{pretensiones:extra.estadoHijos,listaCompleta:!extra.hijos.truncado,evaluabilidad:{habilitaContextualizacion:extra.habilita,pendientes:extra.pendientes}}:{estadoTecnico:sub?.valida?'sustituida':'activa',sustitucion:sub}),
    satisfaccionAutomatica:false,enviaRespuesta:false,aviso:'Registro de gestión, no resolución jurídica. Recepción y plazos no se reinician al editar o asignar. No hay calculador de vencimiento ni cierre favorable automático.'}};
 }
 return {construir,contexto,estado};
}
module.exports={crearExtensionDerechos,contextoComun};
