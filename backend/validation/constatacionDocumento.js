'use strict';
const { objeto } = require('./aplicabilidadContextual');
const { texto } = require('./paqueteNormativo');

// Referencia a un documento examinado fuera de la aplicación. No descarga su
// contenido, no exige PDF y no acredita autenticidad ni suficiencia jurídica.
function validarDocumentoExaminado(d) {
  objeto(d, ['identificador', 'version', 'localizador', 'contenidoExaminado']);
  for (const [campo, max] of Object.entries({ identificador: 500, version: 200, localizador: 1000, contenidoExaminado: 2000 })) texto(d[campo], max);
  return d;
}
function faltaDocumentoExaminado(e) {
  return e.tipo === 'constatacion_documento' && e.soporte?.tipo === 'comprobacion' && !e.soporte.documentoExaminado;
}
module.exports = { validarDocumentoExaminado, faltaDocumentoExaminado };
