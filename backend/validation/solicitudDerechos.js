'use strict';
const contrato=require('../contracts/solicitudDerechos.v1.json');
const {copiarJSON,exigir,objeto,fecha,fechaCivil,zonaEvaluacion}=require('./aplicabilidadContextual');
const {texto}=require('../services/datosOrganizacion');
const {numero,preparar:hechos}=require('./contextoEmpresa');
const {ref}=require('./unidadDP');
const TIPOS=contrato.tipos;
function refs(xs,max=20){exigir(Array.isArray(xs)&&xs.length<=max,'referencias_derechos');const r=xs.map(ref);exigir(new Set(r.map(x=>x.id)).size===r.length,'referencias_duplicadas');return r;}
function campo(c){objeto(c,['estado','contenido','motivo']);exigir(contrato.camposNarrativos.estados.includes(c.estado),'campo_derechos');if(c.estado==='conocido'){texto(c.contenido,2000);exigir(c.motivo==='','motivo_conocido');}else{exigir(c.contenido==='','contenido_pendiente');texto(c.motivo,2000);}return c;}
function recepcion(r){objeto(r,contrato.recepcion.campos);exigir(contrato.recepcion.estados.includes(r.estado),'estado_recepcion');if(r.estado!=='conocida'){exigir(r.precision===null&&r.instante===null&&r.fecha===null&&r.zona===null,'recepcion_pendiente');texto(r.motivo,1000);return r;}
 exigir(contrato.recepcion.precisiones.includes(r.precision),'precision_recepcion');zonaEvaluacion(r.zona);texto(r.motivo,1000);
 if(r.precision==='instante'){fecha(r.instante);exigir(r.fecha===null,'fecha_recepcion_duplicada');}else{fechaCivil(r.fecha);exigir(r.instante===null,'instante_recepcion_inventado');}return r;
}
function validar(tipo,entrada,editar=false){
 exigir(TIPOS.includes(tipo),'tipo_derechos');const d=copiarJSON(entrada);exigir(Buffer.byteLength(JSON.stringify(d))<=contrato.limites.bytes,'tamano_derechos');
 const cfg=tipo==='solicitud_derechos'?contrato.solicitud:contrato.pretension;const requeridos=[...cfg.campos,...(editar?['version']:[])];objeto(d,[...requeridos,...(tipo==='pretension_derecho'?['sustitucion']:[])],requeridos);
 d.motivo=texto(d.motivo,300);exigir(typeof d.confirmarBases==='boolean'&&(editar||!d.confirmarBases),'confirmar_bases');if(editar)d.version=numero(d.version);d.evidencias=refs(d.evidencias);
 if(tipo==='solicitud_derechos'){
  exigir(d.personaReferencia===null||typeof d.personaReferencia==='string'&&/^persona_[a-zA-Z0-9_-]{8,64}$/.test(d.personaReferencia),'persona_seudonima');
  d.descripcion=texto(d.descripcion,2000);d.recepcion=recepcion(d.recepcion);d.canal=campo(d.canal);d.operaciones=refs(d.operaciones);d.alcances=refs(d.alcances);
  exigir(['confirmado','pendiente'].includes(d.contextoOperacion),'confirmacion_contexto');d.motivoContexto=texto(d.motivoContexto,1000);exigir(typeof d.inventarioPretensionesCompleto==='boolean','inventario_pretensiones');
  exigir(typeof d.confirmarRecepcion==='boolean'&&(editar||!d.confirmarRecepcion),'confirmar_recepcion');
  d.hechos=hechos({hechos:d.hechos,motivo:d.motivo},false,'derechos-validacion').hechos;exigir(d.hechos.length===1&&d.hechos[0].clave==='sol_expediente_delimitado','hechos_solicitud');const h=d.hechos[0];
  if(h.estado!=='desconocido')for(const v of h.estado==='conflictivo'?h.alternativas.map(a=>a.valor):[h.valor])exigir(typeof v==='boolean','tipo_hecho_solicitud');
 }else{
  d.solicitud=ref(d.solicitud);d.operacion=ref(d.operacion);d.alcance=ref(d.alcance);exigir(contrato.derechos.includes(d.derecho),'derecho');d.peticion=texto(d.peticion,2000);objeto(d.campos,contrato.pretension.camposDetalle);for(const k of contrato.pretension.camposDetalle)campo(d.campos[k]);exigir(contrato.pretension.estadosGestion.includes(d.estadoGestion),'estado_gestion');
  if(d.sustitucion!==undefined&&d.sustitucion!==null){exigir(editar,'sustitucion_solo_actualizacion');objeto(d.sustitucion,['destino','motivo','confirmarMismaPeticion']);d.sustitucion.destino=ref(d.sustitucion.destino);d.sustitucion.motivo=texto(d.sustitucion.motivo,1000);exigir(d.sustitucion.confirmarMismaPeticion===true,'confirmar_misma_peticion');}
 }
 return d;
}
function datos(d){const {version,clave,motivo,confirmarBases,confirmarRecepcion,...r}=d;return r;}
module.exports={contrato,TIPOS,validar,datos,recepcion};
