'use strict';
// Lectura de paquetes explícitos y casos sintéticos. No importa la app, no abre
// Mongo, no publica catálogo y NO cambia fechas de consulta de fuentes reales.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { validarPaquete } = require('../validation/paqueteNormativo');
const { evaluarAplicabilidadContextual, reproducirSnapshot } = require('../services/aplicabilidadContextual');
const { periodo, periodoCobertura } = require('../services/calendarioAplicabilidad');
const { copiarJSON, huella } = require('../validation/aplicabilidadContextual');
const { conocido, desconocido, conflicto } = require('../tests/fixtures/aplicabilidadContextual');
function comprobar(entrada) {
  const p = copiarJSON(entrada), validado = validarPaquete(p), casos = p.casosAplicabilidad;
  assert.equal(casos.schemaVersion, 1); assert.equal(casos.reglaId, p.regla.id);
  assert.ok(Array.isArray(casos.casos) && casos.casos.length > 0 && casos.casos.length <= 100);
  const resultados = [];
  for (const c of casos.casos) {
    const valores = { ...casos.base, ...c.cambios, ...c.extras };
    const hechos = new Map(Object.entries(valores).map(([k, v]) => [k, conocido(k, v)]));
    for (const k of c.desconocidos || []) hechos.set(k, desconocido(k));
    for (const k of c.conflictivos || []) hechos.set(k, conflicto(k));
    const fechaEvaluacion = c.fechaCivil ? c.fechaCivil + 'T12:00:00.000Z' : casos.fechaBase;
    const x = { organizacionId: '100000000000000000000001', regla: p.regla, fechaEvaluacion,
      contexto: { id: 'CTX_SINTETICO', version: 1, organizacionId: '100000000000000000000001',
        objeto: { tipo: p.regla.tiposObjeto[0], id: 'objeto_sintetico' }, registradoEn: fechaEvaluacion,
        hechos: [...hechos.values()] } };
    if (c.fechaCivil) {
      // SOLO guardia del calendario. No asigna aplica/no_aplica retrospectivo
      // a una ficha preparada en 2026. La evaluación completa DEBE rechazarla.
      const coberturaTemporal = periodoCobertura(p.regla, fechaEvaluacion);
      assert.equal(coberturaTemporal, c.esperado.coberturaTemporal ||
        (c.esperado.cobertura === 'dentro_de_cobertura' ? 'en_periodo' : 'fuera_de_periodo'), c.id);
      assert.throws(() => evaluarAplicabilidadContextual(x), e =>
        ['revision_futura', 'consulta_fuente_futura'].includes(e.campo), c.id + ': no antedatar fuentes');
      resultados.push({ id: c.id, tipo: 'solo_calendario_y_rechazo_fuentes_futuras',
        coberturaTemporal, temporal: periodo(p.regla, fechaEvaluacion) });
      continue;
    }
    const r = evaluarAplicabilidadContextual(x), d = r.decision;
    for (const [k, v] of Object.entries(c.esperado)) {
      if (k === 'cobertura') assert.equal(d.cobertura.estado, v, c.id);
      else if (k === 'coberturaTemporal') assert.equal(d.cobertura.temporal, v, c.id);
      else if (['estado', 'habilitaEvaluacion', 'traza'].includes(k)) assert.deepEqual(d[k], v, c.id + ':' + k);
      // alerta/ambitoConclusion son criterios de presentación, no campos del motor.
    }
    assert.deepEqual(reproducirSnapshot(r.snapshot), r, c.id + ': reproducción');
    resultados.push({ id: c.id, tipo: 'motor_con_hechos_sinteticos', estado: d.estado,
      cobertura: d.cobertura.estado, preguntas: d.preguntasPendientes.map(x => x.clave) });
  }
  assert.equal(new Set(resultados.map(r => r.id)).size, resultados.length);
  return { fichaId: p.ficha.id, versionFicha: p.ficha.version, reglaId: p.regla.id, versionRegla: p.regla.version,
    paqueteSha256: validado.sha256, archivoLogicoSha256: huella(p), resultados,
    limites: 'No prueba persistencia, autorización, interfaz, revisión jurídica ni publicación; pruebas de presentación no ejecutadas.' };
}
if (require.main === module) {
  try {
    if (process.argv.length < 3) throw Error('Indica rutas explícitas de paquetes JSON');
    for (const ruta of process.argv.slice(2)) {
      if (fs.statSync(ruta).size > 128 * 1024) throw Error('Paquete demasiado grande');
      console.log(JSON.stringify(comprobar(JSON.parse(fs.readFileSync(ruta, 'utf8'))), null, 2));
    }
  } catch (e) { console.error(e.stack); process.exitCode = 1; }
}
module.exports = { comprobar };
