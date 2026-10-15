'use strict';

// Contrato interno B1. Sin BD, red, credenciales ni publicación de reglas.
const crypto = require('node:crypto');
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
class ErrorAplicabilidad extends Error {
  constructor(codigo, campo) {
    super(codigo + ': ' + campo);
    this.name = 'ErrorAplicabilidad';
    this.codigo = codigo;
    this.campo = campo;
  }
}
function exigir(condicion, campo, codigo = 'CONTRATO_APLICABILIDAD_INVALIDO') {
  if (!condicion) throw new ErrorAplicabilidad(codigo, campo);
}

// Solo datos JSON acotados. Rechaza getters/toJSON/prototipos antes de leerlos.
function copiarJSON(entrada) {
  let nodos = 0, bytes = 0;
  const activos = new Set();
  function copia(v, profundidad) {
    exigir(++nodos <= 6000 && profundidad <= 20, 'limites');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') {
      exigir(Number.isFinite(v) && Math.abs(v) <= 1e12, 'numero');
      return v;
    }
    if (typeof v === 'string') {
      bytes += Buffer.byteLength(v, 'utf8');
      exigir(bytes <= 128 * 1024 && v.length <= 4000, 'texto');
      return v;
    }
    exigir(v && typeof v === 'object' && !activos.has(v), 'json');
    const array = Array.isArray(v);
    exigir(array ? Object.getPrototypeOf(v) === Array.prototype :
      [Object.prototype, null].includes(Object.getPrototypeOf(v)), 'prototipo');
    const descriptores = Object.getOwnPropertyDescriptors(v);
    const keys = Reflect.ownKeys(descriptores).filter(k => !(array && k === 'length'));
    exigir(keys.length <= 500, 'campos');
    const salida = array ? [] : {};
    activos.add(v);
    if (array) exigir(v.length === keys.length && v.length <= 500, 'array');
    for (const k of keys) {
      exigir(typeof k === 'string' && !['__proto__', 'prototype', 'constructor', 'toJSON'].includes(k), 'clave');
      const d = descriptores[k];
      exigir(has(d, 'value') && d.enumerable, 'descriptor');
      if (array) exigir(/^(0|[1-9][0-9]*)$/.test(k) && Number(k) < v.length, 'indice');
      bytes += Buffer.byteLength(k, 'utf8');
      exigir(bytes <= 128 * 1024, 'limites');
      salida[k] = copia(d.value, profundidad + 1);
    }
    activos.delete(v);
    return salida;
  }
  return copia(entrada, 0);
}
function objeto(o, campos, obligatorios = campos) {
  exigir(o && typeof o === 'object' && !Array.isArray(o), 'objeto');
  exigir(Object.keys(o).every(k => campos.includes(k)), 'campo_desconocido');
  exigir(obligatorios.every(k => has(o, k)), 'campo_obligatorio');
}
function texto(v, campo, max = 500) {
  exigir(typeof v === 'string' && v.trim() === v && v.length > 0 &&
    v.length <= max && !/[\u0000-\u001f\u007f]/.test(v), campo);
}
function id(v, campo = 'id') {
  exigir(typeof v === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(v) &&
    !['__proto__', 'prototype', 'constructor', 'toJSON'].includes(v), campo);
}
function mongoId(v) { exigir(typeof v === 'string' && /^[a-f0-9]{24}$/.test(v), 'organizacionId'); }
function version(v) { exigir(Number.isSafeInteger(v) && v >= 1, 'version'); }
function fecha(v) {
  exigir(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) &&
    Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v, 'fecha_utc');
  return Date.parse(v);
}
// Fecha civil, NO instante ni conversión implícita a medianoche UTC.
function fechaCivil(v) {
  exigir(typeof v === 'string' && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(v), 'fecha_civil');
  const [a, m, d] = v.split('-').map(Number);
  const bisiesto = a % 4 === 0 && (a % 100 !== 0 || a % 400 === 0);
  const dias = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  exigir(m >= 1 && m <= 12 && d >= 1 && d <= dias[m - 1], 'fecha_civil');
  return v;
}
function zonaEvaluacion(v) {
  exigir(typeof v === 'string' && v.length <= 100 &&
    /^(UTC|[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+)$/.test(v), 'zona_evaluacion');
  try { new Intl.DateTimeFormat('en', { timeZone: v }).format(0); }
  catch { exigir(false, 'zona_evaluacion'); }
  return v;
}
function validarVigencia(v, contratoVersion) {
  if (v?.estado === 'pendiente') { objeto(v, ['estado']); return; }
  const civil = contratoVersion === 2 && v?.tipo === 'fecha_civil';
  objeto(v, contratoVersion === 2
    ? ['estado', 'tipo', 'desde', 'hasta', ...(civil ? ['calendario', 'jurisdiccion', 'zonaEvaluacion'] : [])]
    : ['estado', 'desde', 'hasta']);
  exigir(v.estado === 'definida', 'vigencia');
  if (contratoVersion === 2) exigir(['instante_utc', 'fecha_civil'].includes(v.tipo), 'tipo_vigencia');
  if (civil) {
    exigir(v.calendario === 'gregoriano', 'calendario');
    exigir(typeof v.jurisdiccion === 'string' && /^[A-Z]{2}(?:-[A-Z0-9]{1,10})?$/.test(v.jurisdiccion), 'jurisdiccion');
    zonaEvaluacion(v.zonaEvaluacion);
  }
  const validar = civil ? fechaCivil : fecha;
  if (v.desde !== null) validar(v.desde);
  if (v.hasta !== null) validar(v.hasta);
  exigir(v.desde === null || v.hasta === null || v.desde < v.hasta, 'periodo_vacio');
}
function lista(v, max, min = 0) { exigir(Array.isArray(v) && v.length >= min && v.length <= max, 'lista'); }
function unicos(v) { exigir(new Set(v).size === v.length, 'duplicados'); }
function valor(v, tipo) {
  if (tipo === 'booleano') exigir(typeof v === 'boolean', 'valor_booleano');
  else if (tipo === 'numero') exigir(typeof v === 'number' && Number.isFinite(v), 'valor_numero');
  else if (tipo === 'texto') texto(v, 'valor_texto', 400);
  else {
    exigir(tipo === 'lista_textos', 'tipo_hecho');
    lista(v, 50);
    v.forEach(x => texto(x, 'valor_lista', 100));
    unicos(v);
  }
}
const TIPOS_OBJETO = ['organizacion', 'operacion', 'servicio', 'producto', 'sistema', 'contrato'];
function procedencia(p) {
  objeto(p, ['tipo', 'referencia']);
  exigir(['declarado', 'documentado', 'revisado'].includes(p.tipo), 'procedencia');
  texto(p.referencia, 'referencia_procedencia', 200);
}
function validarContexto(c) {
  objeto(c, ['id', 'version', 'organizacionId', 'objeto', 'registradoEn', 'hechos']);
  id(c.id); version(c.version); mongoId(c.organizacionId); fecha(c.registradoEn);
  objeto(c.objeto, ['tipo', 'id']);
  exigir(TIPOS_OBJETO.includes(c.objeto.tipo), 'tipo_objeto');
  if (c.objeto.tipo === 'organizacion') exigir(c.objeto.id === c.organizacionId, 'objeto_organizacion');
  else if (typeof c.objeto.id === 'string' && /^[a-f0-9]{24}$/.test(c.objeto.id)) mongoId(c.objeto.id);
  else id(c.objeto.id, 'objeto_id');
  lista(c.hechos, 200);
  unicos(c.hechos.map(h => h && h.clave));
  for (const h of c.hechos) {
    exigir(h && typeof h === 'object', 'hecho');
    if (h.estado === 'conocido') {
      objeto(h, ['clave', 'estado', 'valor', 'procedencia']);
      procedencia(h.procedencia);
    } else if (h.estado === 'desconocido') {
      objeto(h, ['clave', 'estado', 'motivo']);
      exigir(['no_aportado', 'no_sabe', 'por_consultar'].includes(h.motivo), 'motivo_desconocido');
    } else {
      objeto(h, ['clave', 'estado', 'alternativas']);
      exigir(h.estado === 'conflictivo', 'estado_hecho');
      lista(h.alternativas, 5, 2);
      h.alternativas.forEach(a => { objeto(a, ['valor', 'procedencia']); procedencia(a.procedencia); });
      unicos(h.alternativas.map(a => JSON.stringify(a.valor)));
    }
    id(h.clave, 'clave_hecho');
  }
  return c;
}
function validarRegla(r) {
  objeto(r, ['id', 'version', 'estado', 'revision', 'naturaleza', 'origenes', 'tiposObjeto',
    'fuentes', 'vigencia', 'hechos', 'condicion', 'excepciones', 'contratoVersion', 'cobertura'],
  ['id', 'version', 'estado', 'naturaleza', 'origenes', 'tiposObjeto', 'fuentes', 'vigencia', 'hechos', 'condicion', 'excepciones']);
  id(r.id); version(r.version);
  // Las reglas antiguas no se normalizan: su JSON y su huella no cambian.
  exigir(!has(r, 'contratoVersion') || r.contratoVersion === 2, 'contrato_version');
  exigir(r.contratoVersion === 2 ? has(r, 'cobertura') : !has(r, 'cobertura'), 'cobertura_version');
  exigir(['borrador', 'revisada', 'retirada'].includes(r.estado), 'estado_regla');
  exigir(['ley_reglamento', 'estandar', 'guia', 'metodologia', 'contrato'].includes(r.naturaleza), 'naturaleza');
  lista(r.origenes, 4, 1); unicos(r.origenes);
  exigir(r.origenes.every(o => ['legal', 'contractual', 'adopcion_voluntaria', 'recomendacion_riesgo'].includes(o)), 'origenes');
  lista(r.tiposObjeto, 6, 1); unicos(r.tiposObjeto);
  exigir(r.tiposObjeto.every(t => TIPOS_OBJETO.includes(t)), 'tipos_objeto');
  if (has(r, 'revision')) {
    objeto(r.revision, ['revisorRef', 'fecha']);
    texto(r.revision.revisorRef, 'revisorRef', 120); fecha(r.revision.fecha);
  }
  exigir(r.estado !== 'revisada' || has(r, 'revision'), 'revision_ausente');
  lista(r.fuentes, 20, 1); unicos(r.fuentes.map(f => f && f.id));
  for (const f of r.fuentes) {
    objeto(f, ['id', 'version', 'editor', 'titulo', 'url', 'localizador', 'consultadaEn', 'estadoRevision']);
    id(f.id); version(f.version);
    texto(f.editor, 'editor', 200); texto(f.titulo, 'titulo', 300);
    texto(f.localizador, 'localizador', 200); fecha(f.consultadaEn);
    texto(f.url, 'url', 2000);
    let u; try { u = new URL(f.url); } catch { exigir(false, 'url'); }
    exigir(u.protocol === 'https:' && !u.username && !u.password, 'url');
    exigir(['pendiente', 'revisada'].includes(f.estadoRevision), 'revision_fuente');
    exigir(r.estado !== 'revisada' || f.estadoRevision === 'revisada', 'fuente_no_revisada');
  }
  validarVigencia(r.vigencia, r.contratoVersion);
  lista(r.hechos, 100, 1); unicos(r.hechos.map(h => h && h.clave));
  const definiciones = new Map();
  for (const h of r.hechos) {
    objeto(h, ['clave', 'tipo', 'pregunta']);
    id(h.clave, 'clave_hecho');
    exigir(['booleano', 'numero', 'texto', 'lista_textos'].includes(h.tipo), 'tipo_hecho');
    objeto(h.pregunta, ['id', 'texto', 'grupo', 'motivo']);
    id(h.pregunta.id, 'pregunta_id'); texto(h.pregunta.texto, 'pregunta');
    texto(h.pregunta.grupo, 'grupo', 120); texto(h.pregunta.motivo, 'motivo');
    definiciones.set(h.clave, h);
  }
  unicos(r.hechos.map(h => h.pregunta.id));
  let nodos = 0;
  const usados = new Set();
  function expresion(e, profundidad = 0) {
    exigir(++nodos <= 128 && profundidad <= 8, 'limite_expresion');
    exigir(e && typeof e === 'object' && !Array.isArray(e), 'expresion');
    if (['and', 'or'].includes(e.op)) {
      objeto(e, ['op', 'args']); lista(e.args, 20, 2);
      e.args.forEach(x => expresion(x, profundidad + 1)); return;
    }
    if (e.op === 'not') {
      objeto(e, ['op', 'arg']); expresion(e.arg, profundidad + 1); return;
    }
    objeto(e, ['op', 'hecho', 'valor']);
    exigir(['eq', 'gte', 'lte', 'contiene'].includes(e.op), 'operador');
    exigir(definiciones.has(e.hecho), 'hecho_no_definido');
    usados.add(e.hecho);
    const tipo = definiciones.get(e.hecho).tipo;
    if (e.op === 'contiene') {
      exigir(tipo === 'lista_textos', 'operador_tipo');
      texto(e.valor, 'valor_comparacion', 100);
    } else {
      exigir(tipo !== 'lista_textos' && (e.op === 'eq' || tipo === 'numero'), 'operador_tipo');
      valor(e.valor, tipo);
    }
  }
  if (r.contratoVersion === 2) {
    objeto(r.cobertura, ['descripcion', 'condicion', 'periodo'], ['descripcion', 'condicion']);
    texto(r.cobertura.descripcion, 'descripcion_cobertura');
    if (has(r.cobertura, 'periodo')) {
      exigir(r.vigencia.estado === 'definida' && r.vigencia.tipo === 'fecha_civil', 'cobertura_calendario_civil');
      objeto(r.cobertura.periodo, ['desde', 'hasta', 'motivo']);
      const p = r.cobertura.periodo;
      if (p.desde !== null) fechaCivil(p.desde);
      if (p.hasta !== null) fechaCivil(p.hasta);
      exigir(p.desde === null || p.hasta === null || p.desde < p.hasta, 'cobertura_periodo_vacio');
      texto(p.motivo, 'motivo_periodo_cobertura');
    }
    expresion(r.cobertura.condicion);
  }
  expresion(r.condicion);
  lista(r.excepciones, 10); unicos(r.excepciones.map(e => e && e.id));
  for (const e of r.excepciones) {
    objeto(e, ['id', 'motivo', 'condicion']); id(e.id); texto(e.motivo, 'motivo_excepcion');
    expresion(e.condicion);
  }
  exigir(r.hechos.every(h => usados.has(h.clave)), 'hecho_sin_uso');
  return r;
}
function canonico(v) {
  if (Array.isArray(v)) return '[' + v.map(canonico).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort()
    .map(k => JSON.stringify(k) + ':' + canonico(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
function huella(v) { return crypto.createHash('sha256').update(canonico(v), 'utf8').digest('hex'); }

module.exports = {
  ErrorAplicabilidad, exigir, copiarJSON, objeto, mongoId, fecha, valor,
  validarContexto, validarRegla, huella, fechaCivil, zonaEvaluacion, validarVigencia
};
