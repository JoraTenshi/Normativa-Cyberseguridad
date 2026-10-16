'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const O=require('../models/Operacion'),RO=require('../models/RevisionOperacion');
const {contextoDeRevisionOperacion}=require('./operaciones');
const {huella,copiarJSON}=require('../validation/aplicabilidadContextual');
const {contrato,entradaMotor}=require('../validation/deteccionEIPD');
const {evaluarDeteccionDP}=require('./deteccionDP');
const {fallo}=require('./datosOrganizacion');
// Huella técnica de la versión ejecutada, no un sello de tiempo certificado.
const implementacion=huella({contrato,archivos:[__filename,require.resolve('./deteccionDP'),require.resolve('../validation/deteccionDP'),require.resolve('../validation/deteccionEIPD')]
  .map(p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'))});
function crearExtensionDeteccionEIPD({alcance,registro,evidenciaActual,referencia,compararRef,q,reloj}) {
  async function bases(org,c,session,estricto=false) {
    const ar=await alcance(org,c.alcance,session,estricto),motivos=[...ar.motivos];
    if(!ar.r.contenido.origen.operaciones.some(o=>o.id===c.operacion.id)) {
      if(estricto)fallo('RECURSO_NO_DISPONIBLE');motivos.push('operacion_fuera_del_alcance');
    }
    const o=await q(O.findOne({_id:c.operacion.id,organizacion:org}),session);
    if(!o)fallo('RECURSO_NO_DISPONIBLE');
    const ro=await q(RO.findOne({organizacion:org,operacion:o._id,numero:o.version_actual}),session);
    const padre=contextoDeRevisionOperacion(o,ro),actual={id:String(o._id),version:ro.numero,sha256:ro.sha256};
    if(estricto)compararRef(c.operacion,actual);
    else if(huella(c.operacion)!==huella(actual))motivos.push('operacion_modificada');
    for(const r of c.evidencias) {
      const ev=await evidenciaActual(org,r,session,estricto);
      if(!ev.evidencia.alcanceIds.includes(c.alcance.id))fallo('RECURSO_NO_DISPONIBLE');
      if(huella(r)!==huella(referencia(ev.h,ev.v)))motivos.push('evidencia_modificada:'+r.id);
      motivos.push(...ev.motivos);
    }
    if(estricto&&motivos.length)fallo('VERSION_DESACTUALIZADA');
    return {padre,motivos:[...new Set(motivos)]};
  }
  async function construir(d,ctx,h,n) {
    const org=ctx.contexto.organizacionId,session=ctx.session;
    // Madrid es el ámbito civil de este itinerario, no el timezone de la máquina.
    const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(reloj());
    if(d.fechaEvaluacion>hoy)fallo('DATOS_INVALIDOS');
    if(n>1) {
      const previo=(await registro(org,'deteccion_eipd',h._id,session)).v.contenido.deteccionEIPD;
      if(previo.operacion.id!==d.operacion.id||previo.alcance.id!==d.alcance.id)fallo('DATOS_INVALIDOS');
      if((huella([previo.operacion,previo.alcance])!==huella([d.operacion,d.alcance]))!==d.confirmarBases)fallo('DATOS_INVALIDOS');
    }
    const {version,clave,confirmarBases,motivo,...datos}=d;
    const c=copiarJSON(datos),b=await bases(org,c,session,true);
    const entrada=entradaMotor(c,b.padre);
    const snapshot=evaluarDeteccionDP({tipo:'eipd',fechaEvaluacion:c.fechaEvaluacion,entrada});
    c.atribucion={tipo:'declarado',membresiaId:ctx.contexto.membresiaId};
    c.contextoResuelto={hechos:copiarJSON(b.padre.hechos.filter(h=>['dp_ambito_rgpd','dp_establecimiento_es','dp_regimen_general','dp_entidad_privada','dp_rol','dp_fase'].includes(h.clave))),regimen:entrada.regimen,rol:entrada.rol};
    c.calculo={implementacion,snapshot};
    return {contenido:{deteccionEIPD:c},titulo:'Detección orientativa de necesidad EIPD',alcanceIds:[c.alcance.id],requisitoIds:[]};
  }
  async function estado(org,h,v,session) {
    const actual=v.numero===h.version_actual?{h,v}:await registro(org,'deteccion_eipd',h._id,session);
    const c=actual.v.contenido.deteccionEIPD,b=await bases(org,c,session),motivos=[...b.motivos];
    if(c.calculo.implementacion!==implementacion)motivos.push('detector_modificado');
    const corte=c.calculo.snapshot.fuentesRevisadasEn;
    const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(reloj());
    return {vigencia:{requiereRevision:motivos.length>0,motivos,seRefiereAVersionActual:actual.v.numero},
      actualidadFuentes:{revisadasEn:corte,fechaConsultaResultado:hoy,posteriorAlCorteEditorial:hoy>corte,
        vigenciaJuridicaComprobadaAhora:false,seRefiereAVersionActual:actual.v.numero,
        aviso:'La fecha del corte editorial no es una fecha de caducidad jurídica ni demuestra que la norma haya cambiado.'},
      deteccion:{tipo:'eipd',orientativa:true,satisfaccion:'no_evaluada',eipdRealizada:false,
        seRefiereAVersionActual:actual.v.numero,contextoPendiente:c.contextoOperacion!=='confirmado'||c.contextoResuelto.regimen==='pendiente'||c.contextoResuelto.rol==='pendiente',
        declaracionesPendientes:contrato.campos.filter(k=>['desconocido','conflicto'].includes(c.declaraciones[k].estado))},
      aviso:'Snapshot conservado, no recalculado al consultar. Las declaraciones y evidencias no han sido calificadas por el servidor. Esta detección no completa una EIPD ni acredita cumplimiento.'};
  }
  return {construir,estado};
}
module.exports={crearExtensionDeteccionEIPD,implementacion};
