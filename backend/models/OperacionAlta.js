'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  actor: { type:mongoose.Schema.Types.ObjectId, ref:'Usuario', required:true },
  clave: { type:String, cast:false, required:true, match:/^[a-zA-Z0-9_-]{16,100}$/ },
  huella: { type:String, cast:false, required:true, match:/^[a-f0-9]{64}$/ },
  respuesta: { type:mongoose.Schema.Types.Mixed, required:true }
}, { collection:'operaciones_alta', strict:'throw', timestamps:{createdAt:true,updatedAt:false} });
schema.index({ actor:1, clave:1 }, { unique:true, name:'operacion_alta_unica' });
module.exports = mongoose.model('OperacionAlta', schema);
