'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluarAplicabilidadContextual: evaluar, compararEntradasAplicabilidad: comparar, MOTOR_VERSION }
  = require('../services/aplicabilidadContextual');
const { ErrorAplicabilidad } = require('../validation/aplicabilidadContextual');
const { entrada, conocido, desconocido, conflicto, definicion, eq, ORG_A, ORG_B, AHORA }
  = require('./fixtures/aplicabilidadContextual');
const error = (fn, codigo) => assert.throws(fn, e =>
  e instanceof ErrorAplicabilidad && (!codigo || e.codigo === codigo));
const probar = (cambio) => { const x = entrada(); cambio(x); return evaluar(x); };
const hoja = (x, clave = 'a') => { x.regla.hechos = [definicion(clave)]; x.regla.condicion = eq(clave); };

test('B1: decisión orientativa con contexto, fuente, versión, hechos y snapshot', () => {
  const x = entrada(), copia = structuredClone(x), r = evaluar(x);
  assert.equal(r.decision.estado, 'aplica');
  assert.equal(r.decision.revisionDecision, 'automatica_orientativa');
  assert.equal(r.decision.habilitaEvaluacion, true);
  assert.equal(r.decision.motorVersion, MOTOR_VERSION);
  assert.equal(r.decision.fuentes[0].localizador, 'Cláusula ficticia A');
  assert.equal(r.decision.hechosUtilizados[0].procedencia.tipo, 'declarado');
  assert.deepEqual(x, copia);
  assert.equal(r.snapshot.fechaEvaluacion, AHORA);
  assert.deepEqual(evaluar({ organizacionId: ORG_A, regla: r.snapshot.regla,
    contexto: r.snapshot.contexto, fechaEvaluacion: r.snapshot.fechaEvaluacion }), r);
});

test('B1: salida y snapshots no comparten objetos mutables con la entrada', () => {
  const x = entrada(), r = evaluar(x);
  x.contexto.hechos[0].valor = false;
  x.regla.fuentes[0].titulo = 'Alterado después';
  assert.equal(r.snapshot.contexto.hechos[0].valor, true);
  assert.equal(r.decision.fuentes[0].titulo, 'Contrato ficticio, no normativo');
});
test('B1: igualdad semántica de propiedades JSON produce huella idéntica', () => {
  const x = entrada(), a = evaluar(x);
  x.regla = Object.fromEntries(Object.entries(x.regla).reverse());
  assert.equal(evaluar(x).decision.regla.huellaSha256, a.decision.regla.huellaSha256);
});
test('B1: omisión, no sé y por consultar no se convierten en no aplica', () => {
  for (const hechos of [[], [desconocido('a')], [{ clave: 'a', estado: 'desconocido', motivo: 'por_consultar' }]]) {
    const r = probar(x => { hoja(x); x.contexto.hechos = hechos; });
    assert.equal(r.decision.estado, 'pendiente_de_determinar');
    assert.equal(r.decision.preguntasPendientes[0].clave, 'a');
    assert.equal(r.decision.habilitaEvaluacion, false);
  }
});
test('B1: falso explícito sí puede excluir, sin convertirlo en incumplimiento', () => {
  const r = probar(x => { hoja(x); x.contexto.hechos = [conocido('a', false)]; });
  assert.equal(r.decision.estado, 'no_aplica');
  assert.equal(r.decision.cumplimiento, undefined);
  assert.deepEqual(r.decision.preguntasPendientes, []);
});
const estados = [
  { valor: 'verdadero', hecho: k => conocido(k, true) },
  { valor: 'falso', hecho: k => conocido(k, false) },
  { valor: 'desconocido', hecho: desconocido }
];
for (const op of ['and', 'or']) for (const a of estados) for (const b of estados) {
  test('B1: ' + op + '(' + a.valor + ',' + b.valor + ')', () => {
    const r = probar(x => {
      x.regla.condicion.op = op;
      x.contexto.hechos = [a.hecho('a'), b.hecho('b')];
    }).decision;
    const esperada = op === 'and'
      ? [a.valor, b.valor].includes('falso') ? 'falso' : [a.valor, b.valor].includes('desconocido') ? 'desconocido' : 'verdadero'
      : [a.valor, b.valor].includes('verdadero') ? 'verdadero' : [a.valor, b.valor].includes('desconocido') ? 'desconocido' : 'falso';
    assert.equal(r.traza.valor, esperada);
    if (esperada !== 'desconocido') assert.deepEqual(r.preguntasPendientes, []);
  });
}
for (const a of estados) test('B1: NOT ' + a.valor, () => {
  const r = probar(x => {
    hoja(x); x.regla.condicion = { op: 'not', arg: eq('a') };
    x.contexto.hechos = [a.hecho('a')];
  }).decision;
  assert.equal(r.traza.valor, a.valor === 'desconocido' ? 'desconocido' : a.valor === 'verdadero' ? 'falso' : 'verdadero');
});
test('B1: OR resuelto no pregunta el dato desconocido; mantiene incidencia visible', () => {
  const r = probar(x => { x.regla.condicion.op = 'or'; x.contexto.hechos = [conocido('a', true), desconocido('b')]; }).decision;
  assert.equal(r.estado, 'aplica');
  assert.deepEqual(r.preguntasPendientes, []);
  assert.equal(r.incidencias[0].clave, 'b');
});
test('B1: contradicción bloqueante no se resuelve eligiendo una versión del hecho', () => {
  const r = probar(x => { hoja(x); x.contexto.hechos = [conflicto('a')]; }).decision;
  assert.equal(r.estado, 'pendiente_de_determinar');
  assert.equal(r.preguntasPendientes[0].motivoPendiente, 'hechos_contradictorios');
  assert.equal(r.hechosUtilizados[0].alternativas.length, 2);
});
test('B1: contradicción no decisiva sigue visible aunque OR esté resuelto', () => {
  const r = probar(x => { x.regla.condicion.op = 'or'; x.contexto.hechos = [conocido('a', true), conflicto('b')]; }).decision;
  assert.equal(r.estado, 'aplica');
  assert.equal(r.incidencias[0].motivo, 'hechos_contradictorios');
  assert.deepEqual(r.preguntasPendientes, []);
});
test('B1: preguntas relevantes sin duplicados, con motivo/grupo y falso AND decisivo', () => {
  const x = entrada();
  x.regla.hechos.push(definicion('c'));
  x.regla.condicion = { op: 'or', args: [
    { op: 'and', args: [eq('a'), eq('b')] },
    { op: 'and', args: [eq('c'), eq('c')] }
  ] };
  x.contexto.hechos = [conocido('a', false), desconocido('b'), desconocido('c')];
  const r = evaluar(x).decision;
  assert.deepEqual(r.preguntasPendientes.map(p => p.clave), ['c']);
  assert.ok(r.preguntasPendientes[0].motivo && r.preguntasPendientes[0].grupo);
});
test('B1: excepción verdadera excluye; desconocida pide aclaración; falsa no excluye', () => {
  for (const [h, estado] of [[conocido('b', true), 'no_aplica'], [desconocido('b'), 'pendiente_de_determinar'],
    [conocido('b', false), 'aplica']]) {
    const r = probar(x => {
      x.regla.condicion = eq('a');
      x.regla.excepciones = [{ id: 'EXCEPCION_A', motivo: 'Supuesto sintético exceptuado', condicion: eq('b') }];
      x.contexto.hechos = [conocido('a', true), h];
    }).decision;
    assert.equal(r.estado, estado);
    assert.equal(r.excepciones[0].id, 'EXCEPCION_A');
  }
});
test('B1: excepción falsa no obliga a aclarar condición ya falsa', () => {
  const r = probar(x => {
    x.regla.condicion = eq('a');
    x.regla.excepciones = [{ id: 'EX_A', motivo: 'Excepción sintética', condicion: eq('b') }];
    x.contexto.hechos = [conocido('a', false), desconocido('b')];
  }).decision;
  assert.equal(r.estado, 'no_aplica');
  assert.deepEqual(r.preguntasPendientes, []);
});
test('B1: operadores de número y lista, sin coerción ni etiquetas jurídicas', () => {
  const r = probar(x => {
    x.regla.hechos = [definicion('empleados', 'numero'), definicion('actividades', 'lista_textos')];
    x.regla.condicion = { op: 'and', args: [
      { op: 'gte', hecho: 'empleados', valor: 2 },
      { op: 'lte', hecho: 'empleados', valor: 20 },
      { op: 'contiene', hecho: 'actividades', valor: 'software' }
    ] };
    x.contexto.hechos = [conocido('empleados', 3), conocido('actividades', ['cyber', 'software'])];
  }).decision;
  assert.equal(r.estado, 'aplica');
});
test('B1: misma condición sobre dos operaciones no hereda sus hechos', () => {
  const x = entrada(); const a = evaluar(x);
  x.contexto = { ...x.contexto, id: 'CTX_B', objeto: { tipo: 'operacion', id: 'operacion_B' }, hechos: [] };
  const b = evaluar(x);
  assert.equal(a.decision.estado, 'aplica');
  assert.equal(b.decision.estado, 'pendiente_de_determinar');
});
test('B1: una empresa funciona sin subespacios', () => {
  const r = probar(x => { x.contexto.objeto = { tipo: 'organizacion', id: ORG_A }; });
  assert.equal(r.decision.estado, 'aplica');
  assert.equal(r.decision.objeto.tipo, 'organizacion');
});
test('B1: borrador y retirada no abren cuestionario ni habilitan evaluación', () => {
  for (const estado of ['borrador', 'retirada']) {
    const r = probar(x => { x.regla.estado = estado; }).decision;
    assert.equal(r.estado, 'candidato');
    assert.equal(r.habilitaEvaluacion, false);
    assert.deepEqual(r.preguntasPendientes, []);
  }
});
test('B1: naturaleza y orígenes no se confunden con la aplicabilidad', () => {
  const r = probar(x => { x.regla.naturaleza = 'estandar'; x.regla.origenes = ['contractual', 'adopcion_voluntaria']; }).decision;
  assert.equal(r.estado, 'aplica');
  assert.deepEqual(r.origenes, ['contractual', 'adopcion_voluntaria']);
  assert.equal(r.naturaleza, 'estandar');
});
for (const [momento, temporal, habilita] of [
  ['2026-10-09T07:59:59.999Z', 'futura', false],
  [AHORA, 'en_periodo', true],
  ['2026-10-09T08:59:59.999Z', 'en_periodo', true],
  ['2026-10-09T09:00:00.000Z', 'finalizada', false]
]) test('B1: límites temporales desde inclusivo/hasta exclusivo: ' + momento, () => {
  const r = probar(x => {
    x.fechaEvaluacion = momento;
    x.regla.vigencia = { estado: 'definida', desde: AHORA, hasta: '2026-10-09T09:00:00.000Z' };
  }).decision;
  assert.equal(r.estado, 'aplica'); // Elegibilidad material separada del calendario.
  assert.equal(r.temporal, temporal); assert.equal(r.habilitaEvaluacion, habilita);
});
test('B1: calendario desconocido queda pendiente, nunca activa evaluación', () => {
  const r = probar(x => { x.regla.vigencia = { estado: 'pendiente' }; }).decision;
  assert.equal(r.estado, 'pendiente_de_determinar');
  assert.equal(r.motivoCodigo, 'CALENDARIO_PENDIENTE');
  assert.equal(r.habilitaEvaluacion, false);
});
test('B1: contrato en negociación no activa el supuesto de contrato aceptado', () => {
  for (const [estado, aplicabilidad] of [['negociacion', 'no_aplica'], ['aceptado', 'aplica']]) {
    const r = probar(x => {
      x.regla.hechos = [definicion('estado_contrato', 'texto')];
      x.regla.condicion = eq('estado_contrato', 'aceptado');
      x.contexto.objeto = { tipo: 'servicio', id: 'SaaS_A' };
      x.contexto.hechos = [conocido('estado_contrato', estado)];
    }).decision;
    assert.equal(r.estado, aplicabilidad);
    assert.equal(r.objeto.id, 'SaaS_A');
  }
});
const invalidos = [
  ['empresa cruzada', x => { x.organizacionId = ORG_B; }],
  ['objeto fuera del contrato', x => { x.contexto.objeto.tipo = 'sistema'; }],
  ['empresa-objeto ajena', x => { x.contexto.objeto = { tipo: 'organizacion', id: ORG_B }; }],
  ['booleano texto', x => { x.contexto.hechos[0].valor = 'false'; }],
  ['booleano numérico', x => { x.contexto.hechos[0].valor = 0; }],
  ['valor nulo no es desconocido', x => { x.contexto.hechos[0].valor = null; }],
  ['hechos duplicados', x => { x.contexto.hechos.push(x.contexto.hechos[0]); }],
  ['valor en desconocido', x => { x.contexto.hechos[0] = { ...desconocido('a'), valor: false }; }],
  ['contradicción con una sola alternativa', x => { x.contexto.hechos[0] = conflicto('a'); x.contexto.hechos[0].alternativas.pop(); }],
  ['alternativas iguales', x => { x.contexto.hechos[0] = conflicto('a'); x.contexto.hechos[0].alternativas[1].valor = true; }],
  ['tipo alternativo inválido', x => { x.contexto.hechos[0] = conflicto('a'); x.contexto.hechos[0].alternativas[0].valor = 'true'; }],
  ['campo inesperado', x => { x.permisos = 'admin'; }],
  ['versión cero', x => { x.regla.version = 0; }],
  ['versión contexto omitida', x => { delete x.contexto.version; }],
  ['fuente sin revisar en regla revisada', x => { x.regla.fuentes[0].estadoRevision = 'pendiente'; }],
  ['regla revisada sin revisor', x => { delete x.regla.revision; }],
  ['fuentes vacías', x => { x.regla.fuentes = []; }],
  ['URL con credenciales', x => { x.regla.fuentes[0].url = 'https://user:pass@example.invalid/'; }],
  ['URL no HTTPS', x => { x.regla.fuentes[0].url = 'file:///etc/passwd'; }],
  ['fecha inválida normalizable', x => { x.contexto.registradoEn = '2026-02-30T00:00:00.000Z'; }],
  ['fecha sin zona', x => { x.fechaEvaluacion = '2026-10-09T08:00:00'; }],
  ['contexto futuro', x => { x.contexto.registradoEn = '2027-01-01T00:00:00.000Z'; }],
  ['revisión futura', x => { x.regla.revision.fecha = '2027-01-01T00:00:00.000Z'; }],
  ['consulta fuente futura', x => { x.regla.fuentes[0].consultadaEn = '2027-01-01T00:00:00.000Z'; }],
  ['intervalo vacío', x => { x.regla.vigencia = { estado: 'definida', desde: AHORA, hasta: AHORA }; }],
  ['operador ejecutable no admitido', x => { x.regla.condicion = { op: '$where', hecho: 'a', valor: true }; }],
  ['hecho sin definición', x => { x.regla.condicion.args[0].hecho = 'tercero'; }],
  ['tipo inadecuado para operador', x => { x.regla.condicion.args[0].op = 'gte'; }],
  ['hecho definido sin uso', x => { x.regla.hechos.push(definicion('sobrante')); }],
  ['AND vacío', x => { x.regla.condicion.args = []; }],
  ['origen voluntario como aplicabilidad', x => { x.regla.estado = 'voluntaria'; }],
  ['profundidad excesiva', x => { for (let i = 0; i < 10; i++) x.regla.condicion = { op: 'not', arg: x.regla.condicion }; }],
  ['demasiados hechos', x => { x.contexto.hechos = Array.from({ length: 201 }, (_, i) => conocido('hecho_' + i, true)); }],
  ['NaN', x => { x.contexto.hechos[0].valor = NaN; }],
  ['prototipo personalizado', x => { Object.setPrototypeOf(x.contexto, { ajeno: true }); }],
  ['prototype pollution', x => { x.regla.condicion = JSON.parse('{"__proto__":{"admin":true}}'); }],
  ['ciclo', x => { x.contexto.hechos[0].valor = x.contexto; }],
  ['Date no es un string ISO validado', x => { x.fechaEvaluacion = new Date(AHORA); }]
];
for (const [nombre, cambio] of invalidos) test('B1: rechaza ' + nombre, () => error(() => probar(cambio)));
test('B1: getters y funciones de catálogo no se ejecutan', () => {
  let llamadas = 0;
  const x = entrada();
  Object.defineProperty(x.contexto, 'secreto', { enumerable: true, get() { llamadas++; return 'nunca'; } });
  error(() => evaluar(x));
  assert.equal(llamadas, 0);
  const y = entrada();
  y.regla.condicion = () => { llamadas++; return true; };
  error(() => evaluar(y));
  assert.equal(llamadas, 0);
});
test('B1: cambio versionado marca revisión y no altera snapshot anterior', () => {
  const x = entrada(), anterior = evaluar(x), copia = structuredClone(anterior);
  x.contexto.version++; x.contexto.hechos[0].valor = false;
  const c = comparar(anterior.snapshot, x);
  assert.equal(c.requiereRevision, true); assert.equal(c.contextoCambiado, true);
  assert.deepEqual(anterior, copia);
  assert.equal(evaluar(x).decision.estado, 'no_aplica');
  assert.equal(anterior.decision.estado, 'aplica');
});
test('B1: no admite cambiar contenido con la misma versión de contexto/regla', () => {
  for (const cambio of [x => { x.contexto.hechos[0].valor = false; }, x => { x.regla.fuentes[0].titulo = 'Otra fuente'; }]) {
    const x = entrada(), anterior = evaluar(x);
    cambio(x);
    error(() => comparar(anterior.snapshot, x), 'VERSION_NO_INCREMENTADA');
  }
});
test('B1: cambio de fuente versionado obliga a revisar, sin reescribir decisiones', () => {
  const x = entrada(), anterior = evaluar(x);
  x.regla.version++; x.regla.fuentes[0].version++; x.regla.fuentes[0].localizador = 'Cláusula ficticia B';
  assert.equal(comparar(anterior.snapshot, x).reglaCambiada, true);
});
test('B1: el paso de fecha de aplicación también dispara revisión', () => {
  const x = entrada();
  x.regla.vigencia.desde = '2026-10-10T00:00:00.000Z';
  const anterior = evaluar(x);
  x.fechaEvaluacion = '2026-10-10T00:00:00.000Z';
  const c = comparar(anterior.snapshot, x);
  assert.equal(c.periodoCambiado, true); assert.equal(c.requiereRevision, true);
  assert.equal(c.contextoCambiado, false); assert.equal(c.reglaCambiada, false);
});
test('B1: sin cambios no inventa mejora ni nueva revisión', () => {
  const x = entrada(), anterior = evaluar(x);
  assert.deepEqual(comparar(anterior.snapshot, x), {
    requiereRevision: false, contextoCambiado: false, reglaCambiada: false, periodoCambiado: false
  });
});
test('B1: no compara empresas, objetos, contextos o metodologías distintos', () => {
  for (const cambio of [
    s => { s.contexto.organizacionId = ORG_B; },
    s => { s.contexto.objeto.id = 'operacion_B'; },
    s => { s.contexto.id = 'CTX_B'; },
    s => { s.regla.id = 'OTRA'; },
    s => { s.motorVersion = 'desconocida/99'; }
  ]) {
    const x = entrada(), s = evaluar(x).snapshot;
    cambio(s);
    error(() => comparar(s, x));
  }
});

test('B1: prueba del servicio A no resuelve la operación B ni las facturas propias', () => {
  const x = entrada();
  x.regla.hechos = [definicion('instrucciones_cliente'), definicion('cliente_decide_fines')];
  x.regla.condicion = { op: 'and', args: [eq('instrucciones_cliente'), eq('cliente_decide_fines')] };
  x.contexto.hechos = [conocido('instrucciones_cliente', true), desconocido('cliente_decide_fines')];
  const r = evaluar(x);
  assert.equal(r.decision.estado, 'pendiente_de_determinar');
  assert.deepEqual(r.decision.preguntasPendientes.map(p => p.clave), ['cliente_decide_fines']);
  x.contexto.objeto.id = 'facturas_propias';
  x.contexto.hechos = [];
  assert.equal(evaluar(x).decision.preguntasPendientes.length, 2);
  // Estas condiciones son didácticas: NO una regla jurídica completa del artículo 28.
});
test('B1: una tarea terminada/PDF aportado no rellena hechos de aplicabilidad', () => {
  const r = probar(x => {
    x.contexto.hechos = [conocido('tarea_terminada', true), conocido('pdf_aportado', true)];
  }).decision;
  assert.equal(r.estado, 'pendiente_de_determinar');
  assert.equal(r.habilitaEvaluacion, false);
  assert.deepEqual(r.hechosUtilizados.map(h => h.clave), ['a', 'b']);
});
test('B1: comparación rechaza snapshot con hechos todavía futuros a su propia fecha', () => {
  const x = entrada(), s = evaluar(x).snapshot;
  s.fechaEvaluacion = '2026-10-07T00:00:00.000Z';
  error(() => comparar(s, x));
});

test('B1: acepta ID Mongo existente de servicio sin exigir un alias ficticio', () => {
  const r = probar(x => {
    x.contexto.objeto = { tipo: 'servicio', id: '300000000000000000000003' };
  });
  assert.equal(r.decision.objeto.id, '300000000000000000000003');
  // Solo valida formato/coherencia; el futuro servicio comprobará existencia y permisos.
});
