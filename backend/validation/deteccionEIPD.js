'use strict';
const contrato = require('../contracts/deteccionEIPD.v1.json');
const {copiarJSON, exigir} = require('./aplicabilidadContextual');
const {campos, texto} = require('../services/datosOrganizacion');
const {numero} = require('./contextoEmpresa');
const {ref} = require('./unidadDP');
function refs(xs) {
  exigir(Array.isArray(xs) && xs.length <= contrato.limites.evidencias, 'evidencias_deteccion');
  const rs = xs.map(ref);
  exigir(new Set(rs.map(r => r.id)).size === rs.length, 'evidencia_duplicada');
  return rs;
}
function fechaCivil(value) {
  exigir(typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value),'fecha_deteccion');
  const fecha=new Date(value+'T00:00:00Z');
  exigir(Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0,10)===value,'fecha_deteccion');
  return value;
}
function validar(entrada, editar=false) {
  const d=copiarJSON(entrada);
  exigir(Buffer.byteLength(JSON.stringify(d),'utf8')<=contrato.limites.bytes,'tamano_deteccion');
  campos(d,['operacion','alcance','contextoOperacion','motivoContexto','fechaEvaluacion','declaraciones','evidencias','confirmarBases','motivo',...(editar?['version']:[])]);
  d.operacion=ref(d.operacion);d.alcance=ref(d.alcance);
  exigir(['confirmado','pendiente'].includes(d.contextoOperacion),'contexto_deteccion');
  d.motivoContexto=texto(d.motivoContexto,1000);d.motivo=texto(d.motivo,300);
  fechaCivil(d.fechaEvaluacion);
  exigir(typeof d.confirmarBases==='boolean' && (editar || !d.confirmarBases),'confirmar_bases_deteccion');
  if(editar)d.version=numero(d.version);
  d.evidencias=refs(d.evidencias);campos(d.declaraciones,contrato.campos);
  exigir(Object.keys(d.declaraciones).length===contrato.campos.length,'declaraciones_completas');
  for(const k of contrato.campos) {
    const c=d.declaraciones[k];campos(c,['estado','motivo','evidencias','fundamento']);
    exigir(contrato.estados.includes(c.estado),'estado_deteccion');
    c.motivo=texto(c.motivo,contrato.limites.motivoCampo);c.evidencias=refs(c.evidencias);
    if(contrato.camposCalificados.includes(k) && ['si','no'].includes(c.estado)) {
      campos(c.fundamento,['referencia','localizador','fechaVersion']);
      c.fundamento.referencia=texto(c.fundamento.referencia,1000);
      c.fundamento.localizador=texto(c.fundamento.localizador,1000);
      fechaCivil(c.fundamento.fechaVersion);
      exigir(c.fundamento.fechaVersion<=d.fechaEvaluacion,'fundamento_futuro');
    } else exigir(c.fundamento===null,'fundamento_no_calificado');
    for(const r of c.evidencias)exigir(d.evidencias.some(e=>e.id===r.id&&e.version===r.version&&e.sha256===r.sha256),'evidencia_fuera_inventario');
  }
  return d;
}
function entradaMotor(c,padre) {
  // El navegador no puede escribir regimen/rol, ni el snapshot calculado.
  const valor=k=>c.contextoOperacion==='confirmado' && padre.hechos.find(h=>h.clave===k)?.estado==='conocido'
    ? padre.hechos.find(h=>h.clave===k).valor : undefined;
  const comunes=['dp_ambito_rgpd','dp_establecimiento_es','dp_regimen_general','dp_entidad_privada'].map(valor);
  const regimen=comunes.includes(false)?'otro':comunes.every(x=>x===true)?'rgpd_privado_es':'pendiente';
  const rolOriginal=valor('dp_rol');
  const rol=['responsable','corresponsable_delimitado'].includes(rolOriginal)?'responsable'
    : ['encargado','subencargado_delimitado'].includes(rolOriginal)?'encargado':'pendiente';
  return {regimen,rol,...Object.fromEntries(contrato.campos.map(k=>[k,c.declaraciones[k].estado]))};
}
module.exports={contrato,validar,entradaMotor};
