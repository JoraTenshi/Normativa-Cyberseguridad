'use strict';
const mongoose = require('mongoose');
// Capacidad acotada, no Usuario.rol ni membresía empresarial. Sin API de concesión.
const schema = new mongoose.Schema({
  _id: { type:String, enum:['revision_altas'], required:true },
  usuario: { type:mongoose.Schema.Types.ObjectId, ref:'Usuario', required:true, immutable:true },
  estado: { type:String, cast:false, enum:['activo','revocado'], required:true },
  concedidaEn: { type:Date, required:true, immutable:true },
  referenciaAutorizacion: { type:String, cast:false, required:true, maxlength:500, immutable:true }
}, { collection:'permiso_altas_plataforma', strict:'throw' });
module.exports = mongoose.model('PermisoAltasPlataforma', schema);
