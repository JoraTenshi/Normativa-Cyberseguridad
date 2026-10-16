'use strict';
const O=require('../models/Operacion'), RO=require('../models/RevisionOperacion');
const {contextoDeRevisionOperacion}=require('./operaciones');
const {huella,validarContexto}=require('../validation/aplicabilidadContextual');
const {datos,contextoUnidad,contrato}=require('../validation/unidadDP');
const {fallo}=require('./datosOrganizacion');
function crearExtensionUnidadDP({alcance,registro,referenciado,evidenciaActual,referencia,compararRef,q}) {
  async function bases(org,c,session,estricto=false,visitas=new Set()) {
    const ar=await alcance(org,c.alcance,session,estricto), motivos=[...ar.motivos];
    if(!ar.r.contenido.origen.operaciones.some(o=>o.id===c.operacion.id)) {
      if(estricto)fallo('RECURSO_NO_DISPONIBLE');motivos.push('operacion_fuera_del_alcance');
    }
    const o=await q(O.findOne({_id:c.operacion.id,organizacion:org}),session);
    if(!o)fallo('RECURSO_NO_DISPONIBLE');
    const ro=await q(RO.findOne({organizacion:org,operacion:o._id,numero:o.version_actual}),session);
    const padre=contextoDeRevisionOperacion(o,ro), actual={id:String(o._id),version:ro.numero,sha256:ro.sha256};
    if(estricto)compararRef(c.operacion,actual);
    else if(huella(c.operacion)!==huella(actual))motivos.push('operacion_modificada');
    for(const ref of c.evidencias) {
      const ev=await evidenciaActual(org,ref,session,estricto);
      if(!ev.evidencia.alcanceIds.includes(c.alcance.id))fallo('RECURSO_NO_DISPONIBLE');
      if(huella(ref)!==huella(referencia(ev.h,ev.v)))motivos.push('evidencia_modificada:'+ref.id);
      motivos.push(...ev.motivos);
    }
    for(const ref of c.relaciones) {
      if(visitas.has(ref.id))fallo('DATOS_INVALIDOS');
      const r=estricto?await referenciado(org,'unidad_dp',ref,session):await registro(org,'unidad_dp',ref.id,session);
      const rc=r.v.contenido.unidadDP;
      if(!contrato.clases[c.clase].relaciones.includes(rc.clase)||rc.operacion.id!==c.operacion.id||rc.alcance.id!==c.alcance.id)fallo('RECURSO_NO_DISPONIBLE');
      if(huella(ref)!==huella(referencia(r.h,r.v)))motivos.push('unidad_relacionada_modificada:'+ref.id);
      const b=await bases(org,rc,session,estricto,new Set([...visitas,ref.id]));
      motivos.push(...b.motivos.map(m=>'relacion:'+ref.id+':'+m));
    }
    if(estricto&&motivos.length)fallo('VERSION_DESACTUALIZADA');
    return {motivos:[...new Set(motivos)],padre};
  }
  async function construir(d,ctx,h,n) {
    const org=ctx.contexto.organizacionId,session=ctx.session;
    if(n>1) {
      const anterior=(await registro(org,'unidad_dp',h._id,session)).v.contenido.unidadDP;
      if(anterior.clase!==d.clase||anterior.operacion.id!==d.operacion.id||anterior.alcance.id!==d.alcance.id)fallo('DATOS_INVALIDOS');
      const cambio=huella([anterior.operacion,anterior.alcance])!==huella([d.operacion,d.alcance]);
      if(cambio!==d.confirmarBases)fallo('DATOS_INVALIDOS');
    }
    const c=datos(d,ctx.contexto.membresiaId);await bases(org,c,session,true,new Set([String(h._id)]));
    return {contenido:{unidadDP:c},titulo:c.nombre,alcanceIds:[c.alcance.id],requisitoIds:[]};
  }
  async function contexto(org,objeto,ar,session) {
    const r=await registro(org,'unidad_dp',objeto.id,session),c=r.v.contenido.unidadDP;
    if(c.clase!==objeto.tipo)fallo('RECURSO_NO_DISPONIBLE');
    if(r.h.version_actual!==objeto.version)fallo('VERSION_DESACTUALIZADA');
    compararRef(c.alcance,ar.actual);const b=await bases(org,c,session,true,new Set([String(r.h._id)]));
    return {contexto:validarContexto({id:'ctx_udp_'+r.h._id,version:r.v.numero,organizacionId:String(org),
      objeto:{tipo:c.clase,id:String(r.h._id)},registradoEn:new Date(r.v.createdAt).toISOString(),hechos:contextoUnidad(c,b.padre).hechos}),objetoSha256:r.v.sha256};
  }
  async function estado(org,h,v,session) {
    const actual=v.numero===h.version_actual?{h,v}:await registro(org,'unidad_dp',h._id,session);
    const c=actual.v.contenido.unidadDP,b=await bases(org,c,session),res=contextoUnidad(c,b.padre);
    return {vigencia:{requiereRevision:b.motivos.length>0,motivos:b.motivos,seRefiereAVersionActual:actual.v.numero},
      delimitacion:{contextoOperacion:c.contextoOperacion,pendientes:res.pendientesDelimitacion,seRefiereAVersionActual:actual.v.numero},
      aviso:'Datos declarados de una unidad concreta; guardarlos no aprueba ningún requisito ni acredita cumplimiento.'};
  }
  return {construir,contexto,estado};
}
module.exports={crearExtensionUnidadDP};
