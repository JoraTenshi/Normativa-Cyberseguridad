'use strict';
// SOLO fixtures. No es un paquete ENS/RGPD, no contiene criterios jurídicos.
const { entrada, definicion, conocido, eq } = require('./aplicabilidadContextual');
function entradaCivil() {
  const x = entrada();
  x.fechaEvaluacion = '2026-10-14T12:00:00.000Z';
  x.contexto.registradoEn = '2020-01-01T00:00:00.000Z';
  x.regla.revision.fecha = x.regla.fuentes[0].consultadaEn = x.contexto.registradoEn;
  x.regla.contratoVersion = 2;
  x.regla.cobertura = { descripcion: 'Solo el caso sintético explícitamente cubierto', condicion: eq('cubierto') };
  x.regla.hechos.push(definicion('cubierto'));
  x.contexto.hechos.push(conocido('cubierto', true));
  x.regla.vigencia = { estado: 'definida', tipo: 'fecha_civil', calendario: 'gregoriano',
    jurisdiccion: 'ES', zonaEvaluacion: 'Europe/Madrid', desde: '2026-10-14', hasta: '2026-10-15' };
  return x;
}
module.exports = { entradaCivil };
