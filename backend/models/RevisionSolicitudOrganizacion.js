'use strict';
const mongoose = require('mongoose');
const { DatosSchema } = require('./SolicitudOrganizacion');
const schema = new mongoose.Schema({
  solicitud: { type:mongoose.Schema.Types.ObjectId, ref:'SolicitudOrganizacion', required:true },
  version: { type:Number, cast:false, required:true, min:1, max:50, validate:Number.isSafeInteger },
  actor: { type:mongoose.Schema.Types.ObjectId, ref:'Usuario', required:true },
  actorTipo: { type:String, cast:false, enum:['solicitante','plataforma'], required:true },
  accion: { type:String, cast:false, required:true, enum:['solicitada','corregida','aprobada','rechazada','aclaracion_solicitada'] },
  estado: { type:String, cast:false, required:true, enum:['pendiente_revision','aclaracion_requerida','aprobada','rechazada'] },
  datos: { type:DatosSchema, required:true },
  motivoPublico: { type:String, cast:false, required:true, maxlength:1000 },
  notaInterna: { type:String, cast:false, default:'', maxlength:2000, select:false },
  fecha: { type:Date, required:true },
  organizacion: { type:mongoose.Schema.Types.ObjectId, default:null },
  membresia: { type:mongoose.Schema.Types.ObjectId, default:null }
}, { collection:'revisiones_solicitud_organizacion', strict:'throw', versionKey:false });
// Solo inserciones por servicio. No API para editar/borrar estas decisiones.
// No es un registro inviolable ante un administrador directo de MongoDB.
schema.index({ solicitud:1, version:1 }, { unique:true, name:'revision_solicitud_unica' });
module.exports = mongoose.model('RevisionSolicitudOrganizacion', schema);
