'use strict';
// Implementación pura E1. NO HTTP, autorización, persistencia ni calificación jurídica.
// Los adaptadores de servidor deben resolver tenant, objeto, versión, hechos, rol y ámbito.
// Los motores quedan encapsulados: sus fixtures negativos NO se exportan ni son defaults.
const { createHash } = require('node:crypto');
const { validarSolicitudDeteccion, TIPOS } = require('../validation/deteccionDP');
const PROCEDENCIA = {
  "dpd": {
    "archivo": "outputs/dp-e1-20261015/dpd-deteccion.cjs",
    "sha256Archivo": "713b8c61cb20cbcda443ed51a6f00eb7d3fe41b031191a2eaeb1661b90261931"
  },
  "eipd": {
    "archivo": "outputs/dp-e1-20261015/eipd-deteccion.cjs",
    "sha256Archivo": "83a6d24d9fd6c48cbc8fd83ac041aceb0fa4ea1bedd61a131eea694bed6034c8"
  },
  "brecha": {
    "archivo": "outputs/dp-e1-20261015/brechas-deteccion.cjs",
    "sha256Archivo": "5074f4ab596194b1423071e1a86bffae9f8962d7c2271dc014f2526bedfcd36c"
  }
};
const dpd = (() => {
'use strict';
// Detector puro E1. Integra solo tras autorización, resolución de versiones y persistencia.
// Datos calificados por el usuario/revisor, no verificación jurídica automática.
const ESTADOS=['si','no','desconocido','conflicto'];
const SIMPLE=['a','b','e','f','g','h','i','j','m','n','ñ'];
const COMPLEJO={c:['entidadRegulada','habitualSistematico','granEscala'],d:['prestadorSSI','perfilesUsuarios','granEscala'],k:['actividadPublicidadProspeccion','preferencias','perfiles'],l:['centroHistoriasClinicas','profesionalIndividual'],o:['federacionDeportiva','datosMenores']};
function exact(o,keys,label){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(k=>!Object.hasOwn(o,k)))throw Error('ESTRUCTURA_'+label);}
function estado(v,label){if(!ESTADOS.includes(v))throw Error('ESTADO_'+label);}
function and(...v){return v.includes('no')?'no':v.every(x=>x==='si')?'si':v.includes('conflicto')?'conflicto':'desconocido';}
function or(...v){return v.includes('si')?'si':v.every(x=>x==='no')?'no':v.includes('conflicto')?'conflicto':'desconocido';}
function not(v){return v==='si'?'no':v==='no'?'si':v;}
function fecha(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('FECHA');const d=new Date(s+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)throw Error('FECHA');}
function validar(e){
 exact(e,['fecha','cobertura','rgpd','inventarioCompleto','actividades','sectores','otrasObligaciones','designado'],'entrada');fecha(e.fecha);
 if(!['privada_ES_RGPD','otra_jurisdiccion','sector_publico','regimen_especial','desconocida','conflictiva'].includes(e.cobertura))throw Error('COBERTURA');
 for(const k of['rgpd','inventarioCompleto','otrasObligaciones','designado'])estado(e[k],k);
 if(!Array.isArray(e.actividades)||e.actividades.length>5000)throw Error('ACTIVIDADES');const ids=new Set();
 for(const a of e.actividades){exact(a,['id','principal','observacionHabitualSistematica','granEscala','datosArt9','datosArt10'],'actividad');if(typeof a.id!=='string'||!a.id.trim()||ids.has(a.id))throw Error('ID_ACTIVIDAD');ids.add(a.id);for(const k of['principal','observacionHabitualSistematica','granEscala','datosArt9','datosArt10'])estado(a[k],k);}
 exact(e.sectores,[...SIMPLE,...Object.keys(COMPLEJO)],'sectores');for(const k of SIMPLE)estado(e.sectores[k],k);
 for(const[k,keys]of Object.entries(COMPLEJO)){exact(e.sectores[k],keys,k);for(const f of keys)estado(e.sectores[k][f],k+'.'+f);}
}
function sectoriales(s){const r=Object.fromEntries(SIMPLE.map(k=>[k,s[k]]));for(const k of['c','d','o'])r[k]=and(...Object.values(s[k]));r.k=and(s.k.actividadPublicidadProspeccion,or(s.k.preferencias,s.k.perfiles));r.l=and(s.l.centroHistoriasClinicas,not(s.l.profesionalIndividual));return r;}
function evaluar(e){
 validar(e);
 const out={versionDetector:'DPD_E1_1',fuentesRevisadasEn:'2026-10-16',requiereRevalidacionFuentes:e.fecha>'2026-10-16',calificaHechos:false,decision:'orientativa_sobre_hechos_declarados',satisfaccion:'no_evaluada',cobertura:'cubierta',obligatoriedad:'pendiente',regimenPorDesignacion:'pendiente',causas:[],pendientes:[],nota:'No evalúa satisfacción, habilitación profesional, plazos ni otros marcos.'};
 if(e.fecha<'2018-12-07'){out.cobertura='fuera_del_corte_temporal';out.pendientes.push('Revalidar fuentes y derecho temporal.');return out;}
 if(e.cobertura!=='privada_ES_RGPD'){out.cobertura=['desconocida','conflictiva'].includes(e.cobertura)?'pendiente':'fuera_de_cobertura';out.pendientes.push('Ámbito privado español no confirmado; no es ausencia de obligación.');return out;}
 if(e.rgpd!=='si'){out.cobertura=e.rgpd==='no'?'fuera_de_cobertura':'pendiente';out.pendientes.push('No se confirma ámbito RGPD de este itinerario.');return out;}
 for(const a of e.actividades){out.causas.push({id:'RGPD37.1.b:'+a.id,estado:and(a.principal,a.observacionHabitualSistematica,a.granEscala)},{id:'RGPD37.1.c:'+a.id,estado:and(a.principal,a.granEscala,or(a.datosArt9,a.datosArt10)),version:'correccion_2018_7'});}
 for(const[k,v]of Object.entries(sectoriales(e.sectores)))out.causas.push({id:'LOP34.1.'+k,estado:v});
 out.causas.push({id:'OTRA_OBLIGACION_37.4_VERIFICADA',estado:e.otrasObligaciones});
 const conjunto=or(...out.causas.map(x=>x.estado));
 if(conjunto==='si')out.obligatoriedad='obligatoria';
 else if(conjunto==='no'&&e.inventarioCompleto==='si')out.obligatoriedad='no_obligatoria_en_cobertura';
 if(e.inventarioCompleto!=='si')out.pendientes.push('Inventario global incompleto o contradictorio: no permite descartar obligación.');
 out.pendientes.push(...out.causas.filter(x=>['desconocido','conflicto'].includes(x.estado)).map(x=>'Determinar '+x.id+': '+x.estado));
 out.regimenPorDesignacion=e.designado==='si'?'activo_por_designacion':e.designado==='no'?'sin_designacion_acreditada':'pendiente';
 if(out.obligatoriedad==='obligatoria'&&e.designado==='no')out.pendientes.push('Designación necesaria no acreditada; revisar situación, no favorable automático.');
 return out;
}
function ejemploBase(){return{fecha:'2026-10-16',cobertura:'privada_ES_RGPD',rgpd:'si',inventarioCompleto:'si',actividades:[],sectores:{...Object.fromEntries(SIMPLE.map(k=>[k,'no'])),...Object.fromEntries(Object.entries(COMPLEJO).map(([k,v])=>[k,Object.fromEntries(v.map(f=>[f,'no']))]))},otrasObligaciones:'no',designado:'no'};}
return { evaluar };
})();
const eipd = (() => {
'use strict';
// Detector puro E1 de necesidad EIPD. No califica hechos/evidencias ni realiza una EIPD.
// No incluye consulta previa avanzada: usa su expediente separado, no aprobación automática.
const V=['si','no','desconocido','conflicto'];
function todos(...xs){if(xs.includes('no'))return 'no';if(xs.includes('conflicto'))return 'conflicto';if(xs.includes('desconocido'))return 'desconocido';return 'si';}
function alguno(...xs){if(xs.includes('si'))return 'si';if(xs.includes('conflicto'))return 'conflicto';if(xs.includes('desconocido'))return 'desconocido';return 'no';}
const N=['contextoCompleto','evaluacionSistematicaExhaustiva','baseAutomatizada','efectosSignificativos','granEscala','datos9','datos10','observacionSistematica','accesoPublico','altoRiesgoProbable','lista35_4','baseLegal6ce','leyEspecifica','eipdLegislativa','noExigenciaNacional','lista35_5'];

function validar(x,keys){if(!x||typeof x!=='object'||Array.isArray(x))throw Error('OBJETO');const permitidas=['regimen','rol',...keys];if(Object.keys(x).length!==permitidas.length||Object.keys(x).some(k=>!permitidas.includes(k)))throw Error('ESQUEMA');if(!['rgpd_privado_es','otro','pendiente'].includes(x.regimen))throw Error('REGIMEN');if(!['responsable','encargado','pendiente'].includes(x.rol))throw Error('ROL');for(const k of keys)if(!V.includes(x[k]))throw Error('HECHO_'+k);}
function entradaBase(keys){return{regimen:'rgpd_privado_es',rol:'responsable',...Object.fromEntries(keys.map(k=>[k,'no']))};}
function cobertura(x){if(x.regimen==='otro')return 'fuera_de_cobertura';if(x.regimen==='pendiente'||x.rol==='pendiente')return 'pendiente_ambito_rol';if(x.rol==='encargado')return 'asistencia_28_3_f';return null;}
function evaluarNecesidad(x){validar(x,N);const cover=cobertura(x);if(cover)return{estado:cover,conformidad:null};
const causas={art35_3_a:todos(x.evaluacionSistematicaExhaustiva,x.baseAutomatizada,x.efectosSignificativos),art35_3_b:todos(x.granEscala,alguno(x.datos9,x.datos10)),art35_3_c:todos(x.observacionSistematica,x.granEscala,x.accesoPublico),art35_1:x.altoRiesgoProbable,art35_4:x.lista35_4};
const excepcion35_10=todos(x.baseLegal6ce,x.leyEspecifica,x.eipdLegislativa,x.noExigenciaNacional),positivo=Object.values(causas).includes('si'),negativo=Object.values(causas).every(v=>v==='no');let estado;
if(excepcion35_10==='si')estado='excepcion_35_10_apartados_1_a_7';
else if(x.lista35_5==='si'&&positivo)estado='pendiente_contradiccion_excepcion_riesgo';
else if(x.lista35_5==='si')estado='excepcion_35_5_calificada';
else if(positivo&&(excepcion35_10!=='no'||x.lista35_5!=='no'))estado='indicios_obligacion_excepcion_pendiente';
else if(positivo)estado='eipd_exigible';
else if(negativo&&x.contextoCompleto==='si')estado='no_necesaria_en_contexto_revisado';
else estado='pendiente_analisis';
return{versionDetector:'EIPD_E1_1',fuentesRevisadasEn:'2026-10-16',satisfaccion:'no_evaluada',estado,causas,excepcion35_10,pendientes:Object.entries(x).filter(([,v])=>['desconocido','conflicto'].includes(v)).map(([k])=>k),conformidad:null,advertencia:'Calificación externa y contexto versionado requeridos. No evalúa satisfacción, riesgo real ni evidencia.'};}
return { evaluarNecesidad, N };
})();
const brecha = (() => {
'use strict';
// Detector E1 sobre hechos ya delimitados. No decide riesgo, competencia,
// validez de excepciones, cumplimiento ni realiza comunicaciones.
const estados=['si','no','desconocido','conflictivo'];
const roles=['responsable','encargado','corresponsable_delimitado','subencargado_delimitado','desconocido','controvertido'];
const riesgos=['improbable_constatado','no_improbable','desconocido','conflictivo'];
const excepciones=['ninguna','a_justificada','b_justificada','c_justificada','alegada_no_acreditada','desconocida','conflictiva'];
const ordenes=['ninguna','exige_comunicar','confirma_excepcion','desconocida','conflictiva'];
const campos=['fechaEvaluacion','ambitoRgpd','rol','brechaPersonal','riesgo33','altoRiesgo34','excepcion34','orden34','autoridadDeterminada'];
function civil(x){return typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/u.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;}
function evaluar(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('ENTRADA_INVALIDA');
 if(Object.keys(input).some(k=>!campos.includes(k)))throw Error('CAMPO_NO_ADMITIDO');
 const x={ambitoRgpd:'desconocido',rol:'desconocido',brechaPersonal:'desconocido',riesgo33:'desconocido',altoRiesgo34:'desconocido',excepcion34:'desconocida',orden34:'desconocida',autoridadDeterminada:'desconocido',...input};
 for(const k of ['ambitoRgpd','brechaPersonal','altoRiesgo34','autoridadDeterminada'])if(!estados.includes(x[k]))throw Error('ESTADO_INVALIDO_'+k);
 for(const [k,values]of [['rol',roles],['riesgo33',riesgos],['excepcion34',excepciones],['orden34',ordenes]])if(!values.includes(x[k]))throw Error('VALOR_INVALIDO_'+k);
 if(x.fechaEvaluacion!==undefined&&!civil(x.fechaEvaluacion))throw Error('FECHA_INVALIDA');
 const out={versionDetector:'BRECHA_E1_1',fuentesRevisadasEn:'2026-10-16',requiereRevalidacionFuentes:x.fechaEvaluacion>'2026-10-16',decision:'orientativa_sobre_hechos_declarados',cobertura:'por_determinar',satisfaccion:'no_evaluada',urgencia:'no_determinada',
  rutas:{avisoEncargado:'por_determinar',notificacionAutoridad:'por_determinar',comunicacionPersonas:'por_determinar',documentacion:'por_determinar'},
  destinoAutoridad:x.autoridadDeterminada==='si'?'determinacion_previa_requiere_trazabilidad':'determinar_sin_suspender_urgencia',motivos:[]};
 const end=(cobertura,motivo)=>({...out,cobertura,motivos:[...out.motivos,motivo]});
 if(x.fechaEvaluacion===undefined)return end('pendiente_fecha','No inventar fecha del caso.');
 if(x.fechaEvaluacion<'2018-05-25')return end('regimen_historico_no_cubierto','Examinar régimen histórico; no declarar ausencia de obligaciones.');
 if(x.ambitoRgpd==='no')return end('fuera_ambito_rgpd_constatado','Solo este tratamiento; pueden existir otros deberes.');
 if(x.ambitoRgpd!=='si')return end('pendiente_ambito','Delimitar ámbito sin convertir desconocimiento en exclusión.');
 if(!roles.slice(0,4).includes(x.rol))return end('pendiente_rol','El rol es por tratamiento, no por cuenta de acceso.');
 if(x.brechaPersonal==='no'){out.rutas=Object.fromEntries(Object.keys(out.rutas).map(k=>[k,'no_activada_en_incidente_descartado']));return end('dentro','Incidente descartado motivadamente como brecha personal; preparación y otros deberes permanecen.');}
 if(x.brechaPersonal!=='si'){out.urgencia='investigar_y_escalar_sin_demora';return end('pendiente_brecha','No esperar a cerrar un formulario para actuar.');}
 out.cobertura='dentro';out.urgencia='gestionar_sin_dilacion_indebida';
 if(['encargado','subencargado_delimitado'].includes(x.rol)){
  out.rutas={avisoEncargado:'aplica_sin_esperar_riesgo',notificacionAutoridad:'deber_responsable_representacion_solo_con_mandato',comunicacionPersonas:'deber_responsable_representacion_solo_con_mandato',documentacion:'apoyo_y_trazabilidad_no_33_5_directo_por_este_rol'};
  out.motivos.push('Avisar a cada responsable afectado y asistir; sin plazo universal de72horas para encargado.');return out;
 }
 out.rutas.avisoEncargado='no_activada_por_rol_responsable';out.rutas.documentacion='aplica_toda_brecha';
 const conflicto=x.riesgo33==='improbable_constatado'&&x.altoRiesgo34==='si';
 if(conflicto){out.rutas.notificacionAutoridad='pendiente_urgente_conflicto_riesgo';out.motivos.push('Incoherencia de valoración sobre el mismo grupo/periodo; no aprobar exclusión.');}
 else out.rutas.notificacionAutoridad=x.riesgo33==='improbable_constatado'?'no_exigida_excepcion_motivada':x.riesgo33==='no_improbable'?'aplica':'pendiente_urgente_regla_general_salvo_improbabilidad';
 // La orden debe estar autenticada y su alcance resuelto aguas arriba; no es checkbox libre.
 if(x.orden34==='exige_comunicar')out.rutas.comunicacionPersonas='comunicar_por_orden_aplicable';
 else if(x.orden34==='confirma_excepcion')out.rutas.comunicacionPersonas='seguir_decision_autoridad_y_alternativa_si_corresponde';
 else if(x.orden34!=='ninguna')out.rutas.comunicacionPersonas='pendiente_urgente_aclarar_decision_autoridad';
 else if(conflicto)out.rutas.comunicacionPersonas='pendiente_urgente_conflicto_riesgo';
 else if(x.altoRiesgo34==='no')out.rutas.comunicacionPersonas='no_exigida_por_umbral_con_motivo';
 else if(x.altoRiesgo34!=='si')out.rutas.comunicacionPersonas='pendiente_urgente_valorar_alto_riesgo';
 else if(x.excepcion34==='c_justificada')out.rutas.comunicacionPersonas='aplica_alternativa_publica_igualmente_efectiva';
 else if(['a_justificada','b_justificada'].includes(x.excepcion34))out.rutas.comunicacionPersonas='no_exigida_excepcion_'+x.excepcion34;
 else if(['ninguna','alegada_no_acreditada'].includes(x.excepcion34))out.rutas.comunicacionPersonas='aplica_sin_dilacion_indebida';
 else out.rutas.comunicacionPersonas='pendiente_urgente_excepcion_no_acreditada';
 out.motivos.push('No documentar o no notificar se evalúan por separado. Un pendiente no suspende urgencia ni reinicia relojes.');
 return out;
}
function instante(v){
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/u.test(v)||!civil(v.slice(0,10))||Number.isNaN(Date.parse(v)))throw Error('INSTANTE_CON_ZONA_INVALIDO');
 if(/[+-]14:(?!00)/u.test(v))throw Error('OFFSET_INVALIDO');return Date.parse(v);
}
function alertaOperativa(conocimiento,consulta){
 const fin=instante(consulta);
 const base={tipo:'alerta_operativa_conservadora_no_vencimiento_juridico',conclusionLegal:'no_evaluada',sinDilacionIndebida:'subsiste_independientemente_del_contador'};
 if(conocimiento===null||conocimiento===undefined)return {...base,estado:'constancia_pendiente_no_reiniciar',umbral:null,horasTranscurridas:null};
 const inicio=instante(conocimiento);if(inicio>fin)return {...base,estado:'cronologia_incoherente',umbral:null,horasTranscurridas:null};
 const umbral=inicio+72*3600000;
 return {...base,estado:fin>=umbral?'umbral_alcanzado_requiere_atencion':'umbral_no_alcanzado_no_autoriza_demora',umbral:new Date(umbral).toISOString(),horasTranscurridas:(fin-inicio)/3600000};
}
return { evaluar, alertaOperativa };
})();

const FUENTES = {
 dpd: [{url:'https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807',preceptos:'37.1 y 37.4'},{url:'https://www.boe.es/buscar/doc.php?id=DOUE-L-2018-80845',preceptos:'corrección 7, artículo37.1.c'},{url:'https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673',preceptos:'34.1–2'}],
 eipd: [{url:'https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807',preceptos:'35.1–5,35.10–11,28.3.f'},{url:'https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/realizacion-de-evaluaciones-de',preceptos:'listas35.4 y35.5, calificación documentada externa al motor'}],
 brecha: [{url:'https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807',preceptos:'4.12,28.3.f,33–34'}]
};
function canon(value) {
 if (Array.isArray(value)) return '[' + value.map(canon).join(',') + ']';
 if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canon(value[k])).join(',') + '}';
 return JSON.stringify(value);
}
function evaluarDeteccionDP(request) {
 const q = validarSolicitudDeteccion(request);
 let resultado;
 try {
  if(q.tipo==='dpd') resultado=dpd.evaluar({...q.entrada,fecha:q.fechaEvaluacion});
  else if(q.tipo==='eipd') {
   resultado=eipd.evaluarNecesidad(q.entrada);
   if(q.fechaEvaluacion<'2018-05-25') resultado={estado:'regimen_historico_no_cubierto',conformidad:null};
  } else resultado=brecha.evaluar({...q.entrada,fechaEvaluacion:q.fechaEvaluacion});
 } catch(error) {
  const normalized=new Error('DETECCION_DP_INVALIDA: '+error.message);
  normalized.codigo='DETECCION_DP_INVALIDA'; normalized.campo='entrada';throw normalized;
 }
 const snapshot={
  contrato:'DETECCION_DP_E1',version:1,tipo:q.tipo,fechaEvaluacion:q.fechaEvaluacion,
  fuentesRevisadasEn:'2026-10-16',requiereRevalidacionFuentes:q.fechaEvaluacion>'2026-10-16',
  entrada:q.entrada,resultado,procedencia:PROCEDENCIA[q.tipo],fuentes:FUENTES[q.tipo],
  calificaHechos:false,satisfaccion:'no_evaluada',cumplimientoGlobal:null,
  esCertificacion:false,dictamenJuridicoProfesional:false,enviaComunicaciones:false,
  limites:['Hechos declarados o calificados fuera del motor; no verifica documentos ni riesgo real.',
  'No autoriza acceso ni resuelve referencias; integrar con H/V, ACL, versiones y auditoría antes de exponer API.',
  'No se considera realizada EIPD, designado correctamente DPD ni notificada una brecha por calcular esta salida.',
  'Pendiente no suspende obligaciones, urgencia ni plazos; fecha de consulta no caduca la ley.',
  'Cobertura acotada: otras jurisdicciones, regímenes y obligaciones requieren análisis visible.']
 };
 // Huella del contenido, NO referencia de objeto persistido ni prueba de identidad/autorización.
 return {...JSON.parse(JSON.stringify(snapshot)),sha256Contenido:createHash('sha256').update(canon(snapshot)).digest('hex')};
}
function crearBorradorDeteccion(tipo,fechaEvaluacion) {
 let entrada;
 if(tipo==='dpd'){
  const simple=['a','b','e','f','g','h','i','j','m','n','ñ'];
  const complejo={c:['entidadRegulada','habitualSistematico','granEscala'],d:['prestadorSSI','perfilesUsuarios','granEscala'],k:['actividadPublicidadProspeccion','preferencias','perfiles'],l:['centroHistoriasClinicas','profesionalIndividual'],o:['federacionDeportiva','datosMenores']};
  entrada={cobertura:'desconocida',rgpd:'desconocido',inventarioCompleto:'desconocido',actividades:[],
   sectores:{...Object.fromEntries(simple.map(k=>[k,'desconocido'])),...Object.fromEntries(Object.entries(complejo).map(([k,vs])=>[k,Object.fromEntries(vs.map(v=>[v,'desconocido']))]))},
   otrasObligaciones:'desconocido',designado:'desconocido'};
 } else if(tipo==='eipd') entrada={regimen:'pendiente',rol:'pendiente',...Object.fromEntries(eipd.N.map(k=>[k,'desconocido']))};
 else if(tipo==='brecha') entrada={ambitoRgpd:'desconocido',rol:'desconocido',brechaPersonal:'desconocido',riesgo33:'desconocido',altoRiesgo34:'desconocido',excepcion34:'desconocida',orden34:'desconocida',autoridadDeterminada:'desconocido'};
 else throw Object.assign(new Error('DETECCION_DP_INVALIDA: tipo'),{codigo:'DETECCION_DP_INVALIDA',campo:'tipo'});
 return validarSolicitudDeteccion({tipo,fechaEvaluacion,entrada});
}
function contratoDeteccionDP() {
 return JSON.parse(JSON.stringify({id:'DETECCION_DP_E1',version:1,tipos:TIPOS,
  request:['tipo','fechaEvaluacion','entrada'],fuentes:FUENTES,procedencia:PROCEDENCIA,
  identidad:'El adaptador vincula referencias exactas de organización/operación/incidente; esta fachada no las valida ni persiste.',
  unidad:{dpd:'Organización y conjunto completo de actividades para exclusiones; no una página parcial.',eipd:'Operación o conjunto similar delimitado, incluida preparación.',brecha:'Incidente concreto, rol, grupos y decisiones delimitados.'},
  resultado:'Orientativo, nunca revisión favorable o certificación.',
  estadoInicial:'Desconocido. Los fixtures de test con respuestas negativas no se exportan.',
  permisos:'A resolver antes de invocar; este contrato no concede facultades técnicas ni jurídicas.'}));
}
module.exports={evaluarDeteccionDP,crearBorradorDeteccion,contratoDeteccionDP};

