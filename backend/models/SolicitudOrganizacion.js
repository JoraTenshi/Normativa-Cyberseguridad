'use strict';
const mongoose = require('mongoose');
const DatosSchema = new mongoose.Schema({
  razonSocial: { type:String, cast:false, required:true, maxlength:200 },
  pais: { type:String, cast:false, required:true, enum:['ES'] },
  nif: { type:String, cast:false, required:true, match:/^[A-Z0-9]{9}$/ },
  funcionProfesional: { type:String, cast:false, required:true, maxlength:120 },
  justificacion: { type:String, cast:false, required:true, maxlength:1000 }
}, { _id:false, versionKey:false, strict:'throw' });
const schema = new mongoose.Schema({
  solicitante: { type:mongoose.Schema.Types.ObjectId, ref:'Usuario', required:true, immutable:true },
  datos: { type:DatosSchema, required:true },
  estado: { type:String, cast:false, required:true, enum:['pendiente_revision','aclaracion_requerida','aprobada','rechazada'] },
  version: { type:Number, cast:false, required:true, min:1, max:50, validate:Number.isSafeInteger },
  organizacion: { type:mongoose.Schema.Types.ObjectId, ref:'Organizacion', default:null },
  membresia: { type:mongoose.Schema.Types.ObjectId, ref:'Membresia', default:null }
}, { collection:'solicitudes_organizacion', strict:'throw', timestamps:true });
// No hay unicidad por NIF: una declaración pendiente no reserva una empresa.
schema.index({ solicitante:1, _id:1 }, { name:'solicitudes_por_persona' });
schema.index({ estado:1, _id:1 }, { name:'solicitudes_por_estado' });
module.exports = mongoose.model('SolicitudOrganizacion', schema);
module.exports.DatosSchema = DatosSchema;
