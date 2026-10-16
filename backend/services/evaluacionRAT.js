'use strict';
const {huella}=require('../validation/aplicabilidadContextual');
const triggers=['rat_no_ocasional','rat_riesgo_derechos','rat_art9','rat_art10'];
const funciones={responsable:'responsable',corresponsable_delimitado:'responsable',encargado:'encargado',subencargado_delimitado:'encargado'};
const conocido=(facts,key)=>{const h=facts.get(key);return h?.estado==='conocido'?h.valor:undefined;};
function diagnosticarRAT(c,operaciones,operacionesPerimetro,totalOrganizacion,operacionesEntidad=operacionesPerimetro){
 const incidencias=[],avisos=[],actividades=[],camposPendientes=[];
 const head=new Map();
 for(const o of operacionesEntidad){const f=new Map(o.contexto.hechos.map(h=>[h.clave,h])),date=conocido(f,'rat_fecha_personas_empleadas'),n=conocido(f,'rat_personas_empleadas');if(typeof date==='string'&&Number.isSafeInteger(n)&&n>=0){if(!head.has(date))head.set(date,new Set());head.get(date).add(n);}}
 const fechasDiscrepantes=[...head].filter(([,s])=>s.size>1).map(([d])=>d);
 for(const date of fechasDiscrepantes)avisos.push('plantilla_discrepante:'+date);
 const seleccionadas=new Set(c.entradas.flatMap(e=>e.operaciones.map(r=>r.id)));
 const omitidas=operacionesPerimetro.filter(o=>!seleccionadas.has(o.ref.id)&&funciones[conocido(new Map(o.contexto.hechos.map(h=>[h.clave,h])),'dp_rol')]===c.funcion).map(o=>o.ref.id);
 const sinRol=operacionesPerimetro.filter(o=>!funciones[conocido(new Map(o.contexto.hechos.map(h=>[h.clave,h])),'dp_rol')]).map(o=>o.ref.id);
 if(!c.inventarioCompleto)incidencias.push('inventario_declarado_incompleto');
 if(!c.entradas.length)incidencias.push('registro_sin_entradas');
 if(omitidas.length)incidencias.push('operaciones_del_perimetro_omitidas');
 if(sinRol.length)incidencias.push('roles_del_perimetro_pendientes');
 if(totalOrganizacion>200)incidencias.push('limite_inventario_organizacion_superado');
 for(const o of operaciones){
  const f=new Map(o.contexto.hechos.map(h=>[h.clave,h])),get=k=>conocido(f,k),pendientes=[];
  const rol=get('dp_rol'),fase=get('dp_fase'),fecha=get('rat_fecha_personas_empleadas'),n=get('rat_personas_empleadas');
  let estado='pendiente',motivos=[];
  for(const k of ['dp_ambito_rgpd','dp_establecimiento_es','dp_regimen_general','dp_rol','dp_fase'])if(get(k)===undefined)pendientes.push(k);
  if(get('dp_establecimiento_es')!==true||get('dp_regimen_general')!==true)motivos.push('itinerario_no_delimitado');
  else if(get('dp_ambito_rgpd')===false){estado='fuera_ambito_declarado';motivos.push('exclusion_declarada_necesita_fundamento');}
  else if(get('dp_ambito_rgpd')!==true||funciones[rol]!==c.funcion)motivos.push('ambito_o_funcion_por_aclarar');
  else if(!['activa','residual','prevista'].includes(fase))motivos.push('fase_o_conservacion_residual_por_aclarar');
  else{
   const positivos=triggers.filter(k=>get(k)===true);pendientes.push(...triggers.filter(k=>get(k)===undefined));
   const fechaValida=fecha===c.fechaReferencia&&!fechasDiscrepantes.includes(fecha)&&totalOrganizacion<=200;
   const plantillaValida=Number.isSafeInteger(n)&&n>=0&&fechaValida;
   if(!plantillaValida)pendientes.push('plantilla_o_fecha_por_aclarar');
   if(positivos.length||(plantillaValida&&n>=250)){estado=fase==='prevista'?'preparacion_incluir':'actual_incluir';motivos=[...positivos,...(plantillaValida&&n>=250?['emplea_250_o_mas']:[])];}
   else if(plantillaValida&&n<250&&triggers.every(k=>get(k)===false)){estado=fase==='prevista'?'preparacion_exencion_propuesta':'exencion_propuesta';motivos.push('negativas_declaradas_requieren_fundamento');}
   else motivos.push('excepcion_no_aclarada');
  }
  actividades.push({operacion:o.ref,rol:rol??null,fase:fase??null,estado,motivos,pendientes,satisfaccion:'no_evaluada'});
 }
 function revisarCampo(path,x){if(['pendiente','conflictivo'].includes(x.estado))camposPendientes.push(path);}
 for(const k of ['representante','dpd','sujeto77','comunicacionDPD','disponibilidadAutoridad'])revisarCampo(k,c[k]);
 for(const e of c.entradas){for(const [k,x]of Object.entries(e.campos))revisarCampo(e.id+'.'+k,x);if(c.funcion==='encargado'&&!e.responsables.length)camposPendientes.push(e.id+'.responsables');for(const r of e.responsables)for(const k of ['representante','dpd','categorias','finalidades'])revisarCampo(e.id+'.'+r.id+'.'+k,r[k]);}
 if(camposPendientes.length)incidencias.push('contenido_pendiente');
 // Un motivo positivo decisivo permite inclusión aun con hechos no decisivos pendientes.
 if(actividades.some(a=>a.estado!=='actual_incluir'))incidencias.push('aplicabilidad_o_fase_requiere_revision');
 if(c.sujeto77.estado==='conocido')incidencias.push('inventario_publico_sujeto77_fuera_de_cobertura');
 return {actividades,incidencias:[...new Set(incidencias)],avisos,camposPendientes,fechasDiscrepantes,omitidas,sinRol,
  cobertura:{operacionesPerimetro:operacionesPerimetro.length,operacionesSeleccionadas:seleccionadas.size,totalOrganizacion,integridadDeclarada:c.inventarioCompleto,integridadVerificada:false,extrapolableEmpresa:false},
  inventarioBase:operacionesPerimetro.map(o=>o.ref),inventarioBaseSha256:huella(operacionesPerimetro.map(o=>o.ref)),
  permiteRevisionFavorable:incidencias.length===0,cumplimientoGlobal:null};
}
module.exports={diagnosticarRAT};
