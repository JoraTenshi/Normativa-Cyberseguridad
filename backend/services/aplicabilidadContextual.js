'use strict';

const {
  exigir, copiarJSON, objeto, mongoId, fecha, valor, validarContexto, validarRegla, huella
} = require('../validation/aplicabilidadContextual');
const MOTOR_VERSION = 'aplicabilidad-contextual/1';
const MOTOR_VERSION_2 = 'aplicabilidad-contextual/2';
const { referenciaTemporal, validarReferenciaTemporal, periodo, periodoCobertura } = require('./calendarioAplicabilidad');
const U = 'desconocido', T = 'verdadero', F = 'falso';
const unir = listas => [...new Set(listas.flat())].sort();

function combinar(op, hijos) {
  const valores = hijos.map(h => h.valor);
  const resultado = op === 'and'
    ? valores.includes(F) ? F : valores.includes(U) ? U : T
    : valores.includes(T) ? T : valores.includes(U) ? U : F;
  return { op, valor: resultado,
    necesarios: resultado === U ? unir(hijos.filter(h => h.valor === U).map(h => h.necesarios)) : [],
    hijos };
}
function negar(hijo) {
  return { op: 'not', valor: hijo.valor === U ? U : hijo.valor === T ? F : T,
    necesarios: hijo.necesarios, hijos: [hijo] };
}

// Solo servicio interno. organizacionId es una comprobación de coherencia,
// NO prueba identidad ni reemplaza la autorización de un futuro controlador.
function evaluarAplicabilidadContextual(entrada) {
  return ejecutar(entrada);
}
function ejecutar(entrada, referenciaGuardada) {
  const datos = copiarJSON(entrada);
  objeto(datos, ['organizacionId', 'regla', 'contexto', 'fechaEvaluacion']);
  mongoId(datos.organizacionId); const ahora = fecha(datos.fechaEvaluacion);
  const contexto = validarContexto(datos.contexto), regla = validarRegla(datos.regla);
  const v2 = regla.contratoVersion === 2;
  const motorVersion = v2 ? MOTOR_VERSION_2 : MOTOR_VERSION;
  const referencia = v2 ? referenciaGuardada === undefined
    ? referenciaTemporal(regla, datos.fechaEvaluacion)
    : validarReferenciaTemporal(regla, datos.fechaEvaluacion, referenciaGuardada) : undefined;
  exigir(contexto.organizacionId === datos.organizacionId, 'organizacion',
    'ORGANIZACION_NO_COINCIDE');
  exigir(regla.tiposObjeto.includes(contexto.objeto.tipo), 'objeto', 'AMBITO_NO_ADMITIDO');
  exigir(fecha(contexto.registradoEn) <= ahora, 'contexto_futuro');
  if (regla.revision) exigir(fecha(regla.revision.fecha) <= ahora, 'revision_futura');
  exigir(regla.fuentes.every(f => fecha(f.consultadaEn) <= ahora), 'consulta_fuente_futura');
  const definiciones = new Map(regla.hechos.map(h => [h.clave, h]));
  const hechos = new Map(contexto.hechos.map(h => [h.clave, h]));
  const incidencias = new Map(), utilizados = new Set();

  // Validar también ramas no decisivas, sin convertir un tipo inválido en desconocido.
  for (const d of regla.hechos) {
    const h = hechos.get(d.clave);
    if (h?.estado === 'conocido') valor(h.valor, d.tipo);
    if (h?.estado === 'conflictivo') h.alternativas.forEach(a => valor(a.valor, d.tipo));
  }
  function evaluar(e) {
    if (['and', 'or'].includes(e.op)) return combinar(e.op, e.args.map(evaluar));
    if (e.op === 'not') return negar(evaluar(e.arg));
    const h = hechos.get(e.hecho);
    utilizados.add(e.hecho);
    if (!h || h.estado !== 'conocido') {
      incidencias.set(e.hecho, { clave: e.hecho,
        motivo: !h ? 'no_aportado' : h.estado === 'conflictivo' ? 'hechos_contradictorios' : h.motivo });
      return { op: e.op, hecho: e.hecho, esperado: e.valor, valor: U, necesarios: [e.hecho] };
    }
    let cumple;
    if (e.op === 'eq') cumple = h.valor === e.valor;
    else if (e.op === 'gte') cumple = h.valor >= e.valor;
    else if (e.op === 'lte') cumple = h.valor <= e.valor;
    else cumple = h.valor.includes(e.valor);
    return { op: e.op, hecho: e.hecho, esperado: e.valor, valor: cumple ? T : F, necesarios: [] };
  }
  const trazaCobertura = v2 ? evaluar(regla.cobertura.condicion) : null;
  const limiteCobertura = v2 ? regla.cobertura.periodo : null;
  const dentroPeriodo = periodoCobertura(regla, datos.fechaEvaluacion, referencia) === 'en_periodo';
  const dentro = !v2 || (dentroPeriodo && trazaCobertura.valor === T);
  // Una limitación del producto NO es una excepción jurídica. No se evalúan
  // condición/excepciones hasta haber delimitado positivamente el caso cubierto.
  const condicion = dentro ? evaluar(regla.condicion) : null;
  const excepciones = dentro ? regla.excepciones.map(e => ({ id: e.id, motivo: e.motivo, traza: evaluar(e.condicion) })) : [];
  const traza = excepciones.length
    ? combinar('and', [condicion, negar(combinar('or', excepciones.map(e => e.traza)))])
    : condicion;
  const temporal = periodo(regla, datos.fechaEvaluacion, referencia);
  // Una regla no revisada/retirada nunca habilita evaluación aunque la expresión dé true.
  const publicada = regla.estado === 'revisada';
  const estado = !publicada ? 'candidato' :
    !dentro || traza.valor === U || temporal === 'por_determinar' ? 'pendiente_de_determinar' :
      traza.valor === T ? 'aplica' : 'no_aplica';
  const motivoCodigo = !publicada ? regla.estado === 'retirada' ? 'REGLA_RETIRADA' : 'REGLA_NO_REVISADA' :
    !dentroPeriodo ? 'FUERA_DE_COBERTURA_TEMPORAL' :
    !dentro ? trazaCobertura.valor === F ? 'FUERA_DE_COBERTURA' : 'COBERTURA_PENDIENTE' :
    traza.valor === U ? 'HECHOS_PENDIENTES' :
      temporal === 'por_determinar' ? 'CALENDARIO_PENDIENTE' :
        traza.valor === T ? 'CONDICION_SATISFECHA_POR_HECHOS' : 'CONDICION_NO_SATISFECHA_O_EXCEPCION';
  const motivos = {
    FUERA_DE_COBERTURA_TEMPORAL: 'Este periodo queda fuera de la cobertura histórica del paquete, no fuera de la vigencia de la norma. Requiere otro análisis.',
    FUERA_DE_COBERTURA: 'Este caso queda fuera de la cobertura declarada del paquete. Requiere otro análisis; no significa que la norma no sea aplicable.',
    COBERTURA_PENDIENTE: 'Falta delimitar si este paquete cubre el caso. No se ha evaluado la condición jurídica.',
    REGLA_RETIRADA: 'La regla está retirada; este cálculo no activa trabajo ni sustituye decisiones anteriores.',
    REGLA_NO_REVISADA: 'La regla aún no está revisada; solo se conserva como candidatura informativa.',
    HECHOS_PENDIENTES: 'Faltan hechos o hay contradicciones relevantes para resolver esta decisión.',
    CALENDARIO_PENDIENTE: 'El calendario de este apartado está pendiente; no se habilita su evaluación.',
    CONDICION_SATISFECHA_POR_HECHOS: 'Los hechos aportados satisfacen la condición declarativa y sus excepciones. No acredita cumplimiento ni verifica esos hechos.',
    CONDICION_NO_SATISFECHA_O_EXCEPCION: 'Los hechos aportados no satisfacen la condición o activan una excepción. La traza conserva el motivo concreto.'
  };
  const necesarios = publicada && temporal !== 'finalizada' && dentroPeriodo
    ? dentro ? traza.necesarios : trazaCobertura.necesarios : [];
  const decision = {
    motorVersion, organizacionId: contexto.organizacionId, objeto: contexto.objeto,
    fechaEvaluacion: datos.fechaEvaluacion,
    contexto: { id: contexto.id, version: contexto.version, huellaSha256: huella(contexto) },
    regla: { id: regla.id, version: regla.version, huellaSha256: huella(regla) },
    naturaleza: regla.naturaleza, origenes: regla.origenes, fuentes: regla.fuentes,
    estado, temporal, revisionDecision: 'automatica_orientativa',
    habilitaEvaluacion: publicada && estado === 'aplica' && temporal === 'en_periodo',
    motivoCodigo, motivo: motivos[motivoCodigo],
    hechosUtilizados: [...utilizados].sort().map(clave =>
      hechos.get(clave) || { clave, estado: 'desconocido', motivo: 'no_aportado' }),
    incidencias: [...incidencias.values()].sort((a, b) => a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0),
    preguntasPendientes: necesarios.map(clave => ({
      clave, ...definiciones.get(clave).pregunta,
      estadoDato: hechos.get(clave)?.estado || 'desconocido',
      motivoPendiente: incidencias.get(clave).motivo
    })),
    traza, excepciones,
    ...(v2 ? { cobertura: {
      estado: dentro ? 'dentro_de_cobertura' : !dentroPeriodo || trazaCobertura.valor === F ? 'fuera_de_cobertura' : 'pendiente_de_delimitar',
      descripcion: regla.cobertura.descripcion, traza: trazaCobertura,
      temporal: dentroPeriodo ? 'en_periodo' : 'fuera_de_periodo',
      periodo: limiteCobertura || null
    }, referenciaTemporal: referencia } : {})
  };
  // Copias autocontenidas para reproducir el cálculo sin consultar un catálogo cambiante.
  // No son persistencia, firma, autorización ni revisión humana.
  return { decision, snapshot: { contexto, regla, fechaEvaluacion: datos.fechaEvaluacion, motorVersion,
    ...(v2 ? { referenciaTemporal: referencia } : {}) } };
}
function reproducirSnapshot(entrada) {
  const s = copiarJSON(entrada);
  exigir([MOTOR_VERSION, MOTOR_VERSION_2].includes(s.motorVersion), 'motor', 'METODOLOGIA_NO_COMPARABLE');
  const v2 = s.motorVersion === MOTOR_VERSION_2;
  objeto(s, ['contexto', 'regla', 'fechaEvaluacion', 'motorVersion', ...(v2 ? ['referenciaTemporal'] : [])]);
  validarRegla(s.regla);
  exigir(v2 === (s.regla.contratoVersion === 2), 'motor_contrato_incoherente');
  return ejecutar({ organizacionId: s.contexto.organizacionId, contexto: s.contexto,
    regla: s.regla, fechaEvaluacion: s.fechaEvaluacion }, v2 ? s.referenciaTemporal : undefined);
}
function compararEntradasAplicabilidad(snapshotAnterior, entradaActual) {
  // Cada snapshot se reproduce con su contrato; una regla nueva exige nueva versión.
  const actual = evaluarAplicabilidadContextual(entradaActual);
  const anterior = copiarJSON(snapshotAnterior);
  const reproducida = reproducirSnapshot(anterior);
  fecha(anterior.fechaEvaluacion);
  exigir(anterior.fechaEvaluacion <= actual.decision.fechaEvaluacion, 'comparacion_temporal');
  validarContexto(anterior.contexto); validarRegla(anterior.regla);
  exigir(fecha(anterior.contexto.registradoEn) <= fecha(anterior.fechaEvaluacion), 'contexto_anterior_futuro');
  if (anterior.regla.revision) exigir(fecha(anterior.regla.revision.fecha) <= fecha(anterior.fechaEvaluacion), 'revision_anterior_futura');
  exigir(anterior.regla.fuentes.every(f => fecha(f.consultadaEn) <= fecha(anterior.fechaEvaluacion)), 'fuente_anterior_futura');
  exigir(anterior.contexto.organizacionId === actual.decision.organizacionId &&
    anterior.contexto.objeto.tipo === actual.decision.objeto.tipo &&
    anterior.contexto.objeto.id === actual.decision.objeto.id, 'comparacion', 'AMBITO_NO_COINCIDE');
  exigir(anterior.contexto.id === actual.decision.contexto.id, 'contexto', 'CONTEXTO_NO_COINCIDE');
  exigir(anterior.regla.id === actual.decision.regla.id, 'regla', 'REGLA_NO_COINCIDE');
  const contextoCambiado = huella(anterior.contexto) !== actual.decision.contexto.huellaSha256;
  const reglaCambiada = huella(anterior.regla) !== actual.decision.regla.huellaSha256;
  exigir(!contextoCambiado || actual.snapshot.contexto.version > anterior.contexto.version,
    'version_contexto', 'VERSION_NO_INCREMENTADA');
  exigir(!reglaCambiada || actual.snapshot.regla.version > anterior.regla.version,
    'version_regla', 'VERSION_NO_INCREMENTADA');
  const periodoCambiado = reproducida.decision.temporal !== actual.decision.temporal;
  const coberturaPeriodoCambiado = (reproducida.decision.cobertura?.temporal || 'en_periodo') !==
    (actual.decision.cobertura?.temporal || 'en_periodo');
  return { requiereRevision: contextoCambiado || reglaCambiada || periodoCambiado || coberturaPeriodoCambiado,
    contextoCambiado, reglaCambiada, periodoCambiado,
    ...(actual.decision.cobertura || reproducida.decision.cobertura ? { coberturaPeriodoCambiado } : {}) };
}
module.exports = { evaluarAplicabilidadContextual, compararEntradasAplicabilidad, reproducirSnapshot, MOTOR_VERSION, MOTOR_VERSION_2 };
