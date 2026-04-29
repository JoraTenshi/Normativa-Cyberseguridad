/**
 * models/Normativa.js
 * Modelo Mongoose para la colección "normativas"
 * Define la estructura de cada normativa con sus bloques y preguntas ponderadas
 */

const mongoose = require('mongoose');

// Sub-esquema para cada pregunta dentro de un bloque
const PreguntaSchema = new mongoose.Schema({
  id: { type: String, required: true },         // Identificador único: "ps_1", "ga_2"...
  texto: { type: String, required: true },       // Texto de la pregunta
  peso: { type: Number, required: true, min: 1 } // Peso / importancia de la pregunta
}, { _id: false }); // No generamos _id para subdocumentos

// Sub-esquema para cada bloque temático de preguntas
const BloqueSchema = new mongoose.Schema({
  id: { type: String, required: true },          // Identificador del bloque: "politicas", "accesos"...
  nombre: { type: String, required: true },      // Nombre legible del bloque
  preguntas: [PreguntaSchema]                    // Lista de preguntas del bloque
}, { _id: false });

// Esquema principal de la normativa
const NormativaSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // "iso27001", "ens", etc.
  nombre: { type: String, required: true },            // "ISO 27001"
  descripcion: { type: String },                       // Descripción breve
  bloques: [BloqueSchema]                              // Lista de bloques temáticos
}, {
  timestamps: true // Añade createdAt y updatedAt automáticamente
});

module.exports = mongoose.model('Normativa', NormativaSchema);
