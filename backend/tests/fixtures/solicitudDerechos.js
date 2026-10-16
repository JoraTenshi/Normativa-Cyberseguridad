'use strict';
const {ref}=require('./unidadDP');
const pendiente=()=>({estado:'pendiente',contenido:'',motivo:'Por consultar'});
const recepcion=()=>({estado:'pendiente',precision:null,instante:null,fecha:null,zona:null,motivo:'Conservar recepción por determinar sin asignar fecha de alta'});
function solicitud(){return {personaReferencia:null,descripcion:'Solicitud FICTICIA recibida, contenido pendiente de delimitar',recepcion:recepcion(),canal:pendiente(),operaciones:[],alcances:[],contextoOperacion:'pendiente',motivoContexto:'Tratamientos por identificar',inventarioPretensionesCompleto:false,hechos:[{clave:'sol_expediente_delimitado',estado:'desconocido',motivo:'por_consultar'}],evidencias:[],confirmarBases:false,confirmarRecepcion:false,motivo:'Admisión sin atribución de cumplimiento'};}
function pretension(){return {solicitud:ref('c'),operacion:ref('b'),alcance:ref('a'),derecho:'por_delimitar',peticion:'Contenido FICTICIO por interpretar',campos:Object.fromEntries(['alcanceSolicitado','identidad','representacion','actuacionMaterial','respuesta','resultadoComunicacion'].map(k=>[k,pendiente()])),estadoGestion:'pendiente',evidencias:[],confirmarBases:false,motivo:'Separar pretensión para su examen'};}
module.exports={solicitud,pretension,pendiente,recepcion};
