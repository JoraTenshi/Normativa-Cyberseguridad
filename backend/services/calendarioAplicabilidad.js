'use strict';
const { exigir, objeto, fecha, fechaCivil, zonaEvaluacion, validarVigencia } = require('../validation/aplicabilidadContextual');

function referenciaTemporal(regla, instante) {
  fecha(instante);
  validarVigencia(regla.vigencia, regla.contratoVersion);
  const v = regla.vigencia;
  if (v.estado !== 'definida' || v.tipo !== 'fecha_civil') return null;
  // ICU usa la zona indicada por el paquete. Nunca la TZ del proceso/navegador.
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: v.zonaEvaluacion, calendar: 'gregory', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(instante)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  const civil = fechaCivil(`${partes.year.padStart(4, '0')}-${partes.month}-${partes.day}`);
  const localComoUTC = `${civil}T${partes.hour}:${partes.minute}:${partes.second}.000Z`;
  const desplazamientoSegundos = (fecha(localComoUTC) - Math.floor(fecha(instante) / 1000) * 1000) / 1000;
  const r = { fechaCivil: civil, desplazamientoSegundos, zonaEvaluacion: v.zonaEvaluacion,
    jurisdiccion: v.jurisdiccion, calendario: v.calendario,
    versionTzdb: process.versions.tz || 'no_informada', versionIcu: process.versions.icu || 'no_informada' };
  return validarReferenciaTemporal(regla, instante, r);
}

// Testigo calculado por el servidor y almacenado EN el snapshot protegido por huella.
// Reproducir usa ese desplazamiento observado; no reinterpreta el pasado si cambia ICU.
// No es un sello certificado ni una prueba de la corrección jurídica de la zona elegida.
function validarReferenciaTemporal(regla, instante, r) {
  const ms = fecha(instante), v = regla.vigencia;
  if (v.estado !== 'definida' || v.tipo !== 'fecha_civil') {
    exigir(r === null, 'referencia_temporal_inesperada'); return null;
  }
  objeto(r, ['fechaCivil', 'desplazamientoSegundos', 'zonaEvaluacion', 'jurisdiccion', 'calendario', 'versionTzdb', 'versionIcu']);
  fechaCivil(r.fechaCivil); zonaEvaluacion(r.zonaEvaluacion);
  exigir(r.zonaEvaluacion === v.zonaEvaluacion && r.jurisdiccion === v.jurisdiccion &&
    r.calendario === v.calendario, 'referencia_temporal_ambito');
  exigir(Number.isInteger(r.desplazamientoSegundos) && Math.abs(r.desplazamientoSegundos) <= 24 * 60 * 60,
    'desplazamiento_temporal');
  for (const k of ['versionTzdb', 'versionIcu'])
    exigir(typeof r[k] === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(r[k]), k);
  exigir(new Date(ms + r.desplazamientoSegundos * 1000).toISOString().slice(0, 10) === r.fechaCivil,
    'referencia_temporal_incoherente');
  return r;
}

function periodo(regla, instante, observada) {
  fecha(instante); validarVigencia(regla.vigencia, regla.contratoVersion);
  if (regla.vigencia.estado === 'pendiente') return 'por_determinar';
  let actual = instante;
  if (regla.vigencia.tipo === 'fecha_civil') {
    const r = observada === undefined ? referenciaTemporal(regla, instante)
      : validarReferenciaTemporal(regla, instante, observada);
    actual = r.fechaCivil;
  }
  return regla.vigencia.desde !== null && actual < regla.vigencia.desde ? 'futura' :
    regla.vigencia.hasta !== null && actual >= regla.vigencia.hasta ? 'finalizada' : 'en_periodo';
}
function periodoCobertura(regla, instante, observada) {
  const p = regla.cobertura?.periodo;
  if (!p) return 'en_periodo';
  const r = observada === undefined ? referenciaTemporal(regla, instante)
    : validarReferenciaTemporal(regla, instante, observada);
  exigir(r !== null, 'cobertura_calendario_civil');
  return (p.desde === null || r.fechaCivil >= p.desde) && (p.hasta === null || r.fechaCivil < p.hasta)
    ? 'en_periodo' : 'fuera_de_periodo';
}
module.exports = { referenciaTemporal, validarReferenciaTemporal, periodo, periodoCobertura };
