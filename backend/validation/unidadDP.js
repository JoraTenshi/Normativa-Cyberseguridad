'use strict';
const contrato = require('../contracts/unidadDP.v1.json');
const {copiarJSON, exigir, huella} = require('./aplicabilidadContextual');
const {campos, id, texto} = require('../services/datosOrganizacion');
const {numero, preparar: prepararHechos, combinar} = require('./contextoEmpresa');
const CLASES = Object.keys(contrato.clases);
function ref(r) {
  campos(r,['id','version','sha256']);
  exigir(typeof r.sha256==='string' && /^[a-f0-9]{64}$/.test(r.sha256),'referencia_unidad');
  return {id:id(r.id),version:numero(r.version),sha256:r.sha256};
}
function refs(rs) {
  exigir(Array.isArray(rs)&&rs.length<=20,'referencias_unidad');
  const r=rs.map(ref); exigir(new Set(r.map(x=>x.id)).size===r.length,'referencia_duplicada');return r;
}
function campo(c) {
  campos(c,['estado','contenido','motivo']);
  exigir(contrato.campos.estados.includes(c.estado),'estado_campo_unidad');
  if(c.estado==='conocido') {texto(c.contenido,2000); exigir(c.motivo==='','motivo_campo_conocido');}
  else {exigir(c.contenido==='','contenido_campo_pendiente');texto(c.motivo,2000);}
  return c;
}
function validar(entrada, editar=false) {
  const d=copiarJSON(entrada);
  exigir(Buffer.byteLength(JSON.stringify(d))<=contrato.limites.bytes,'tamano_unidad');
  campos(d,['clase','nombre','descripcion','operacion','alcance','contextoOperacion','motivoContexto','campos','hechos','relaciones','evidencias','confirmarBases','motivo',...(editar?['version']:[])]);
  exigir(CLASES.includes(d.clase),'clase_unidad');
  d.nombre=texto(d.nombre,120); d.descripcion=texto(d.descripcion,500);d.motivo=texto(d.motivo,300);
  d.operacion=ref(d.operacion);d.alcance=ref(d.alcance);
  exigir(['confirmado','pendiente'].includes(d.contextoOperacion),'contexto_unidad');
  d.motivoContexto=texto(d.motivoContexto,1000);
  exigir(typeof d.confirmarBases==='boolean' && (editar||!d.confirmarBases),'confirmacion_bases');
  if(editar)d.version=numero(d.version);
  const cfg=contrato.clases[d.clase]; campos(d.campos,cfg.campos);cfg.campos.forEach(k=>campo(d.campos[k]));
  const hs=prepararHechos({hechos:d.hechos,motivo:d.motivo},false,'unidad-validacion').hechos;
  exigir(huella(hs.map(h=>h.clave).sort())===huella(cfg.hechos.map(h=>h.clave).sort()),'hechos_unidad_cerrados');
  for(const h of hs) {
    if(h.estado==='desconocido')continue;
    const c=cfg.hechos.find(c=>c.clave===h.clave);
    const vs=h.estado==='conflictivo'?h.alternativas.map(x=>x.valor):[h.valor];
    for(const v of vs)exigir(c.tipo==='booleano'?typeof v==='boolean':typeof v==='string'&&c.valores.includes(v),'tipo_hecho_unidad');
  }
  d.evidencias=refs(d.evidencias);d.relaciones=refs(d.relaciones);
  exigir(cfg.relaciones.length>0||d.relaciones.length===0,'relacion_unidad');return d;
}
const desconocido=clave=>({clave,estado:'desconocido',motivo:'por_consultar'});
function contextoUnidad(c, padre) {
  const propios=copiarJSON(c.hechos), cfg=contrato.clases[c.clase];
  const faltantes=cfg.camposDelimitacion.filter(k=>c.campos[k].estado!=='conocido');
  // No inferir un juicio de los textos. Una afirmación de delimitación no puede
  // esconder campos pendientes; se conserva declarada pero no guía la evaluación.
  const guardia=propios.find(h=>h.clave===cfg.hechoDelimitacion);
  if(faltantes.length && guardia?.estado==='conocido' && guardia.valor===true)
    propios.splice(propios.indexOf(guardia),1,desconocido(cfg.hechoDelimitacion));
  const comunes=contrato.contexto.desdeOperacion.map(k=>c.contextoOperacion==='confirmado'
    ? copiarJSON(padre.hechos.find(h=>h.clave===k)||desconocido(k)) : desconocido(k));
  return {hechos:[...comunes,...propios],pendientesDelimitacion:faltantes};
}
function datos(d, miembro) {
  const {version,clave,confirmarBases,motivo,...c}=d;
  return {...c,hechos:combinar([],c.hechos,miembro)};
}
module.exports={contrato,CLASES,validar,contextoUnidad,datos,ref};
