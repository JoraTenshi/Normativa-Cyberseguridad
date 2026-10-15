'use strict';
// Contrato editorial/técnico interno. Validar NO publica el paquete ni acredita
// suficiencia jurídica. No admite un catálogo o funciones recibidos por HTTP.
const { copiarJSON, objeto, exigir, fecha, fechaCivil, validarRegla, huella, valor } = require('./aplicabilidadContextual');
const identificador = v => exigir(typeof v === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(v) &&
  !['constructor', 'prototype', 'toJSON'].includes(v), 'identificador_ficha');
const version = v => exigir(Number.isSafeInteger(v) && v >= 1 && v <= 999999999, 'version_ficha');
const texto = (v, max = 1200) => exigir(typeof v === 'string' && v.length > 0 && v.trim() === v &&
  v.length <= max && !/[\u0000-\u001f\u007f]/.test(v), 'texto_ficha');
function lista(v, max, min = 0) { exigir(Array.isArray(v) && v.length >= min && v.length <= max, 'lista_ficha'); }
function unicos(xs) { exigir(new Set(xs).size === xs.length, 'duplicados_ficha'); }
function validarFicha(entrada, reglaEntrada) {
  const f = copiarJSON(entrada), r = validarRegla(copiarJSON(reglaEntrada));
  const obligatorios = ['schemaVersion', 'paqueteId', 'id', 'version', 'reglaId', 'versionRegla', 'titulo',
    'explicacion', 'fuentes', 'criterios', 'fuentesYCalendario', 'usoContenido', 'revisionEditorial',
    'actuacionesSugeridas', 'condicionesRevision', 'limites'];
  objeto(f, [...obligatorios, 'coberturaTemporalDelPaquete', 'sustituyeVersionPreparacion',
    ...(f.schemaVersion === 2 ? ['satisfaccion'] : [])], obligatorios);
  exigir([1, 2].includes(f.schemaVersion) && r.contratoVersion === 2, 'version_contrato_ficha');
  [f.id, f.reglaId, f.paqueteId].forEach(identificador); [f.version, f.versionRegla].forEach(version);
  exigir(f.reglaId === r.id && f.versionRegla === r.version, 'ficha_regla_no_coincide');
  texto(f.titulo, 300); texto(f.explicacion, 2000);
  exigir(huella(f.fuentes) === huella(r.fuentes), 'fuentes_ficha_regla_no_coinciden');
  if (Object.hasOwn(f, 'sustituyeVersionPreparacion')) {
    version(f.sustituyeVersionPreparacion); exigir(f.sustituyeVersionPreparacion < f.version, 'version_sustituida');
  }
  const fuentes = new Set(f.fuentes.map(x => x.id));
  lista(f.criterios, 80, 1); unicos(f.criterios.map(c => c.id));
  for (const c of f.criterios) {
    objeto(c, ['id', 'descripcion', 'origen', 'fuenteIds', 'preceptos', 'tiposEvidencia', 'exigeConclusionMotivada']);
    identificador(c.id); texto(c.descripcion, 2000);
    exigir(['norma', 'metodologia'].includes(c.origen), 'origen_criterio');
    exigir(c.exigeConclusionMotivada === true, 'conclusion_motivada');
    lista(c.fuenteIds, 20, c.origen === 'norma' ? 1 : 0); unicos(c.fuenteIds);
    exigir(c.fuenteIds.every(id => fuentes.has(id)), 'fuente_criterio_ausente');
    lista(c.preceptos, 20, c.origen === 'norma' ? 1 : 0);
    for (const p of c.preceptos) {
      objeto(p, ['fuenteId', 'localizador']); exigir(c.fuenteIds.includes(p.fuenteId), 'precepto_fuente_ajena');
      texto(p.localizador, 300);
    }
    lista(c.tiposEvidencia, 20, 1); unicos(c.tiposEvidencia); c.tiposEvidencia.forEach(identificador);
  }
  if (f.schemaVersion === 2) {
    const s = f.satisfaccion;
    objeto(s, ['tipo', 'hechos', 'rutas']); exigir(s.tipo === 'rutas_cerradas', 'tipo_satisfaccion');
    lista(s.hechos, 80); unicos(s.hechos.map(h => h.clave));
    const definiciones = new Map(), usados = new Set(), cubiertos = new Set();
    for (const h of s.hechos) {
      objeto(h, ['clave', 'tipo', 'pregunta']); identificador(h.clave);
      exigir(['booleano', 'numero', 'texto'].includes(h.tipo), 'tipo_hecho_satisfaccion');
      objeto(h.pregunta, ['id', 'texto', 'grupo', 'motivo']); identificador(h.pregunta.id);
      ['texto', 'grupo', 'motivo'].forEach(k => texto(h.pregunta[k]));
      const existente = r.hechos.find(x => x.clave === h.clave);
      exigir(!existente || existente.tipo === h.tipo, 'tipo_hecho_incompatible');
      definiciones.set(h.clave, h);
    }
    unicos(s.hechos.map(h => h.pregunta.id));
    lista(s.rutas, 20, 1); unicos(s.rutas.map(x => x.id));
    for (const ruta of s.rutas) {
      objeto(ruta, ['id', 'titulo', 'explicacion', 'requiereTodos', 'hechosRequeridos']);
      identificador(ruta.id); texto(ruta.titulo, 300); texto(ruta.explicacion, 2000);
      lista(ruta.requiereTodos, 80, 1); unicos(ruta.requiereTodos);
      for (const id of ruta.requiereTodos) {
        exigir(f.criterios.some(c => c.id === id), 'criterio_ruta_ausente'); cubiertos.add(id);
      }
      lista(ruta.hechosRequeridos, 80); unicos(ruta.hechosRequeridos.map(h => h.clave));
      for (const h of ruta.hechosRequeridos) {
        objeto(h, ['clave', 'valor']); exigir(definiciones.has(h.clave), 'hecho_ruta_ausente');
        valor(h.valor, definiciones.get(h.clave).tipo); usados.add(h.clave);
      }
    }
    exigir(cubiertos.size === f.criterios.length, 'criterio_sin_ruta');
    exigir(usados.size === definiciones.size, 'hecho_satisfaccion_sin_uso');
  }
  lista(f.actuacionesSugeridas, 40); unicos(f.actuacionesSugeridas.map(a => a.id));
  const acciones = new Map(f.actuacionesSugeridas.map(a => [a.id, a]));
  for (const a of acciones.values()) {
    objeto(a, ['id', 'titulo', 'funcionSugerida', 'criterioCierreTarea', 'dependeDe']);
    identificador(a.id); texto(a.titulo, 300); texto(a.funcionSugerida, 500); texto(a.criterioCierreTarea);
    lista(a.dependeDe, 40); unicos(a.dependeDe);
    exigir(a.dependeDe.every(id => id !== a.id && acciones.has(id)), 'dependencia_ausente');
  }
  const visitados = new Set();
  function recorrer(id, camino = []) {
    exigir(!camino.includes(id), 'dependencia_ciclica');
    if (visitados.has(id)) return;
    for (const otro of acciones.get(id).dependeDe) recorrer(otro, [...camino, id]);
    visitados.add(id);
  }
  for (const id of acciones.keys()) recorrer(id);
  lista(f.limites, 40, 1); f.limites.forEach(x => texto(x, 2000));
  const cr = f.condicionesRevision;
  objeto(cr, ['unidadContada', 'favorable', 'evidencia', 'aprobacionAutomatica', 'revisor', 'caducidadUniversal',
    'desencadenantes', 'preservarHistorico']);
  ['unidadContada', 'favorable', 'evidencia', 'revisor'].forEach(k => texto(cr[k], 2000));
  exigir(cr.aprobacionAutomatica === false && cr.caducidadUniversal === null && cr.preservarHistorico === true, 'politica_revision');
  lista(cr.desencadenantes, 30, 1); cr.desencadenantes.forEach(x => texto(x));
  objeto(f.revisionEditorial, ['actor', 'tipo', 'fecha', 'dictamenJuridicoProfesional', 'publicacion']);
  for (const k of ['actor', 'tipo', 'publicacion']) texto(f.revisionEditorial[k], 300);
  fecha(f.revisionEditorial.fecha);
  exigir(f.revisionEditorial.dictamenJuridicoProfesional === false, 'sin_dictamen_profesional_en_este_contrato');
  exigir(!r.revision || f.revisionEditorial.fecha === r.revision.fecha, 'fecha_revision_ficha');
  exigir(f.fuentes.every(s => s.consultadaEn <= f.revisionEditorial.fecha), 'fuente_posterior_revision');
  objeto(f.usoContenido, ['tipo', 'atribucion', 'urlCondiciones', 'advertencia', 'incluyeISOoCCNProtegido']);
  for (const k of ['tipo', 'atribucion', 'advertencia']) texto(f.usoContenido[k], 2000);
  texto(f.usoContenido.urlCondiciones, 2000);
  let url; try { url = new URL(f.usoContenido.urlCondiciones); } catch { exigir(false, 'url_uso'); }
  exigir(url.protocol === 'https:' && !url.username && !url.password, 'url_uso');
  exigir(f.usoContenido.incluyeISOoCCNProtegido === false, 'contenido_protegido_no_autorizado');
  exigir(f.fuentesYCalendario && typeof f.fuentesYCalendario === 'object' && !Array.isArray(f.fuentesYCalendario), 'calendario_editorial');
  fechaCivil(f.fuentesYCalendario.consultaVigencia); texto(f.fuentesYCalendario.limiteVerificacion, 2000);
  if (Object.hasOwn(f, 'coberturaTemporalDelPaquete')) {
    const p = f.coberturaTemporalDelPaquete;
    objeto(p, ['desde', 'hasta', 'tipo', 'motivo', 'accionFuera', 'obligatoriaAntesDeEvaluar', 'implementacion'],
      ['desde', 'hasta', 'tipo', 'motivo', 'accionFuera', 'obligatoriaAntesDeEvaluar']);
    exigir(p.tipo === 'limite_de_cobertura_historica_no_fecha_legal' && p.obligatoriaAntesDeEvaluar === true &&
      p.accionFuera === 'requiere_analisis_fuera_de_cobertura', 'limite_temporal_ficha');
    exigir(r.cobertura.periodo && p.desde === r.cobertura.periodo.desde && p.hasta === r.cobertura.periodo.hasta &&
      p.motivo === r.cobertura.periodo.motivo, 'guardia_temporal_no_integrada');
  }
  return f;
}
function validarPaquete(entrada) {
  const p = copiarJSON(entrada);
  objeto(p, ['ficha', 'regla', 'casosAplicabilidad'], ['ficha', 'regla']);
  const regla = validarRegla(p.regla), ficha = validarFicha(p.ficha, regla);
  return { ficha, regla, sha256: huella({ ficha, regla }),
    aviso: 'Contrato técnico coherente; no publica reglas ni acredita revisión jurídica o funcionamiento integrado.' };
}
module.exports = { validarFicha, validarPaquete, identificador, version, texto, lista, unicos };
