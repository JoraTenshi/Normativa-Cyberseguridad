'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { evaluarAplicabilidadContextual: evaluar, reproducirSnapshot, compararEntradasAplicabilidad: comparar,
  MOTOR_VERSION, MOTOR_VERSION_2 } = require('../services/aplicabilidadContextual');
const { referenciaTemporal, periodo } = require('../services/calendarioAplicabilidad');
const { validarRegla, copiarJSON, huella, fechaCivil } = require('../validation/aplicabilidadContextual');
const { crearCatalogo, catalogo } = require('../services/catalogoAplicabilidad');
const { entrada, conocido, desconocido, conflicto, definicion, eq } = require('./fixtures/aplicabilidadContextual');
const { entradaCivil } = require('./fixtures/aplicabilidadC2');

test('C2: resultados v1 mantienen exactamente las huellas del motor anterior', () => {
  const x = entrada();
  for (const [cambio, hash] of [
    [() => {}, '4cbf5b4141741722263d1bbc4c516b69f5da255633513f59224281fdf5a1f220'],
    [() => { x.contexto.hechos[0].valor = false; }, '6961f41134e90637fa9a2a8eff847acfb16ad784795e273ebfb7dfdecf2e7efb'],
    [() => { x.regla.vigencia = { estado: 'pendiente' }; }, 'b6201e9f5d5e205dfff5f8b699b34515ea921319dc0ba02b8b79e4bc1d5dc551']
  ]) {
    cambio(); const r = evaluar(x);
    assert.equal(r.decision.motorVersion, MOTOR_VERSION); assert.equal(huella(r), hash);
    assert.deepEqual(reproducirSnapshot(r.snapshot), r);
  }
});
for (const [instante, esperado] of [
  ['2026-10-13T21:59:59.999Z', 'futura'], ['2026-10-13T22:00:00.000Z', 'en_periodo'],
  ['2026-10-14T21:59:59.999Z', 'en_periodo'], ['2026-10-14T22:00:00.000Z', 'finalizada']
]) test('C2: día civil Madrid desde incluido/hasta excluido ' + instante, () => {
  const x = entradaCivil(); x.fechaEvaluacion = instante; const r = evaluar(x);
  assert.equal(r.decision.temporal, esperado); assert.equal(r.decision.estado, 'aplica');
  assert.equal(r.decision.habilitaEvaluacion, esperado === 'en_periodo');
  assert.equal(r.decision.motorVersion, MOTOR_VERSION_2);
  assert.deepEqual(reproducirSnapshot(r.snapshot), r);
  assert.equal(x.regla.vigencia.desde, '2026-10-14');
});
for (const [dia, inicio, fin, horas] of [
  ['2026-03-29', '2026-03-28T23:00:00.000Z', '2026-03-29T22:00:00.000Z', 23],
  ['2026-10-25', '2026-10-24T22:00:00.000Z', '2026-10-25T23:00:00.000Z', 25]
]) test('C2: cambio horario no presupone días de 24 horas: ' + dia, () => {
  const x = entradaCivil();
  x.regla.vigencia.desde = dia; x.regla.vigencia.hasta = dia.slice(0, 8) + (Number(dia.slice(8)) + 1);
  assert.equal((Date.parse(fin) - Date.parse(inicio)) / 3600000, horas);
  for (const [f, p] of [[new Date(Date.parse(inicio) - 1).toISOString(), 'futura'],
    [inicio, 'en_periodo'], [new Date(Date.parse(fin) - 1).toISOString(), 'en_periodo'], [fin, 'finalizada']])
    assert.equal(periodo(x.regla, f), p);
});
test('C2: misma jurisdicción no impone una única zona Madrid/Canarias', () => {
  const x = entradaCivil(); x.fechaEvaluacion = '2026-10-13T22:30:00.000Z';
  assert.equal(evaluar(x).decision.temporal, 'en_periodo');
  x.regla.vigencia.zonaEvaluacion = 'Atlantic/Canary';
  assert.equal(evaluar(x).decision.temporal, 'futura');
});
test('C2: TZ del proceso no modifica el calendario explícito', () => {
  const antes = process.env.TZ;
  try {
    const x = entradaCivil(), r = evaluar(x);
    process.env.TZ = 'Pacific/Honolulu'; assert.deepEqual(evaluar(x), r);
    process.env.TZ = 'Asia/Tokyo'; assert.deepEqual(evaluar(x), r);
  } finally { if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes; }
});
test('C2: calendario gregoriano, bisiestos y rango civil estricto', () => {
  for (const d of ['2000-02-29', '2024-02-29', '0001-01-01', '9999-12-31']) assert.equal(fechaCivil(d), d);
  for (const d of ['1900-02-29', '2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00',
    '0000-01-01', '2026-1-01', '2026-01-01Z', '2026-01-01T00:00:00.000Z', null, new Date()])
    assert.throws(() => fechaCivil(d));
});
for (const [nombre, cambiar] of [
  ['zona ausente', x => { delete x.regla.vigencia.zonaEvaluacion; }],
  ['zona inventada', x => { x.regla.vigencia.zonaEvaluacion = 'Europe/Inventada'; }],
  ['offset no IANA', x => { x.regla.vigencia.zonaEvaluacion = '+02:00'; }],
  ['calendario ausente', x => { delete x.regla.vigencia.calendario; }],
  ['otro calendario', x => { x.regla.vigencia.calendario = 'islamico'; }],
  ['jurisdicción ausente', x => { delete x.regla.vigencia.jurisdiccion; }],
  ['periodo vacío', x => { x.regla.vigencia.hasta = x.regla.vigencia.desde; }],
  ['instante donde hay fecha', x => { x.regla.vigencia.desde += 'T00:00:00.000Z'; }],
  ['civil en v1', x => { delete x.regla.contratoVersion; delete x.regla.cobertura; }],
  ['contrato desconocido', x => { x.regla.contratoVersion = 3; }],
  ['contrato 1 explícito no inventado', x => { x.regla.contratoVersion = 1; }],
  ['cobertura omitida', x => { delete x.regla.cobertura; }],
  ['cobertura con sí implícito', x => { x.regla.cobertura.condicion = true; }],
  ['hecho cobertura sin definición', x => { x.regla.cobertura.condicion = eq('ajeno'); }],
  ['estado de cobertura enviado', x => { x.regla.cobertura.estado = 'dentro_de_cobertura'; }]
]) test('C2: rechaza ' + nombre, () => { const x = entradaCivil(); cambiar(x); assert.throws(() => evaluar(x)); });
test('C2: instante UTC explícito y calendario pendiente en v2', () => {
  const x = entradaCivil(); x.regla.vigencia = { estado: 'definida', tipo: 'instante_utc', desde: null, hasta: null };
  assert.equal(evaluar(x).decision.temporal, 'en_periodo'); assert.equal(evaluar(x).snapshot.referenciaTemporal, null);
  x.regla.vigencia = { estado: 'pendiente' }; const r = evaluar(x);
  assert.equal(r.decision.estado, 'pendiente_de_determinar'); assert.equal(r.decision.habilitaEvaluacion, false);
  assert.deepEqual(reproducirSnapshot(r.snapshot), r);
});
test('C2: fuera de cobertura no evalúa condición/excepciones y nunca afirma no_aplica', () => {
  for (const valor of [true, false]) {
    const x = entradaCivil(); x.contexto.hechos = [conocido('cubierto', false), conocido('a', valor)];
    const d = evaluar(x).decision;
    assert.equal(d.cobertura.estado, 'fuera_de_cobertura'); assert.equal(d.estado, 'pendiente_de_determinar');
    assert.equal(d.habilitaEvaluacion, false); assert.equal(d.traza, null); assert.deepEqual(d.excepciones, []);
    assert.deepEqual(d.hechosUtilizados.map(h => h.clave), ['cubierto']); assert.deepEqual(d.preguntasPendientes, []);
  }
});
for (const h of [null, desconocido('cubierto'), conflicto('cubierto')])
  test('C2: falta/conflicto de cobertura pregunta solo cobertura: ' + h?.estado, () => {
    const x = entradaCivil(); x.contexto.hechos = h ? [h] : [];
    const d = evaluar(x).decision;
    assert.equal(d.cobertura.estado, 'pendiente_de_delimitar'); assert.equal(d.estado, 'pendiente_de_determinar');
    assert.equal(d.traza, null); assert.deepEqual(d.preguntasPendientes.map(p => p.clave), ['cubierto']);
  });
test('C2: ya dentro del caso sí distingue exclusión legal, dato pendiente y aplicación', () => {
  const x = entradaCivil();
  assert.equal(evaluar(x).decision.estado, 'aplica');
  x.contexto.hechos[0] = desconocido('a'); assert.equal(evaluar(x).decision.estado, 'pendiente_de_determinar');
  x.contexto.hechos[0] = conocido('a', false); assert.equal(evaluar(x).decision.estado, 'no_aplica');
});
test('C2: tipos inválidos en rama de fondo no se esconden tras fuera de cobertura', () => {
  const x = entradaCivil(); x.contexto.hechos = [conocido('cubierto', false), conocido('a', 'true')];
  assert.throws(() => evaluar(x));
});
test('C2: borradores/retiradas conservan candidatura y no abren evaluación', () => {
  for (const estado of ['borrador', 'retirada']) {
    const x = entradaCivil(); x.regla.estado = estado;
    const d = evaluar(x).decision; assert.equal(d.estado, 'candidato'); assert.equal(d.habilitaEvaluacion, false);
  }
});
test('C2: referencia temporal congelada se reproduce sin volver a consultar ICU', () => {
  const r = evaluar(entradaCivil()), antes = Intl.DateTimeFormat;
  // La validación de nombre continúa, pero no se vuelve a proyectar el instante.
  Intl.DateTimeFormat = function(...args) {
    assert.equal(args[1].calendar, undefined);
    return new antes(...args);
  };
  try { assert.deepEqual(reproducirSnapshot(r.snapshot), r); } finally { Intl.DateTimeFormat = antes; }
});
for (const [nombre, modificar] of [
  ['motor v1 con regla v2', s => { s.motorVersion = MOTOR_VERSION; }],
  ['testigo ausente', s => { delete s.referenciaTemporal; }],
  ['zona diferente', s => { s.referenciaTemporal.zonaEvaluacion = 'UTC'; }],
  ['fecha incompatible', s => { s.referenciaTemporal.fechaCivil = '2026-10-15'; }],
  ['offset inválido', s => { s.referenciaTemporal.desplazamientoSegundos = 100000; }],
  ['campo inventado', s => { s.referenciaTemporal.aprobada = true; }]
]) test('C2: reproducción rechaza ' + nombre, () => {
  const s = evaluar(entradaCivil()).snapshot; modificar(s); assert.throws(() => reproducirSnapshot(s));
});
test('C2: HTTP interno de cálculo no permite aportar testigo temporal', () => {
  const x = entradaCivil(); x.referenciaTemporal = referenciaTemporal(x.regla, x.fechaEvaluacion);
  assert.throws(() => evaluar(x));
});
test('C2: evolución v1 a v2 exige nueva versión, conserva el cálculo anterior', () => {
  const x = entrada(), antiguo = evaluar(x), guardado = structuredClone(antiguo);
  const nuevo = entradaCivil(); nuevo.regla.version = 2;
  nuevo.contexto.id = x.contexto.id; nuevo.contexto.version = 2;
  const c = comparar(antiguo.snapshot, nuevo);
  assert.equal(c.reglaCambiada, true); assert.equal(c.contextoCambiado, true); assert.equal(c.requiereRevision, true);
  assert.deepEqual(reproducirSnapshot(antiguo.snapshot), guardado);
  nuevo.regla.version = 1; assert.throws(() => comparar(antiguo.snapshot, nuevo));
});
test('C2: cambio de día civil solicita nueva decisión sin reescribir resultado anterior', () => {
  const x = entradaCivil(); x.fechaEvaluacion = '2026-10-13T21:59:59.999Z'; const r = evaluar(x);
  x.fechaEvaluacion = '2026-10-13T22:00:00.000Z';
  assert.deepEqual(comparar(r.snapshot, x), { requiereRevision: true, contextoCambiado: false,
    reglaCambiada: false, periodoCambiado: true, coberturaPeriodoCambiado: false });
  assert.equal(reproducirSnapshot(r.snapshot).decision.temporal, 'futura');
});
test('C2: catálogo anuncia cobertura v2, mantiene producción vacía y copias independientes', () => {
  const x = entradaCivil(), c = crearCatalogo([x.regla]);
  assert.equal(c.listar()[0].contratoVersion, 2);
  c.listar()[0].cobertura.descripcion = 'Mutado';
  assert.equal(c.actual(x.regla.id).cobertura.descripcion, x.regla.cobertura.descripcion);
  assert.deepEqual(catalogo.listar(), []); assert.deepEqual(validarRegla(copiarJSON(x.regla)), x.regla);
});
test('C2: vigencia legal y cobertura histórica son periodos independientes', () => {
  const x = entradaCivil();
  x.regla.vigencia.desde = '2022-05-05'; x.regla.vigencia.hasta = null;
  x.regla.cobertura.periodo = { desde: '2024-05-05', hasta: '2027-01-01', motivo: 'Límite histórico sintético del paquete, no vigencia legal' };
  for (const [fecha, cubierta] of [['2024-05-04T21:59:59.999Z', false], ['2024-05-04T22:00:00.000Z', true],
    ['2026-12-31T22:59:59.999Z', true], ['2026-12-31T23:00:00.000Z', false]]) {
    x.fechaEvaluacion = fecha; const r = evaluar(x);
    assert.equal(r.decision.temporal, 'en_periodo');
    assert.equal(r.decision.cobertura.temporal, cubierta ? 'en_periodo' : 'fuera_de_periodo');
    assert.equal(r.decision.habilitaEvaluacion, cubierta);
    assert.equal(r.decision.estado, cubierta ? 'aplica' : 'pendiente_de_determinar');
    if (!cubierta) { assert.equal(r.decision.traza, null); assert.deepEqual(r.decision.preguntasPendientes, []); }
    assert.deepEqual(reproducirSnapshot(r.snapshot), r);
  }
});
test('C2: cobertura histórica rechaza campos faltantes/fechas/semántica sin zona civil', () => {
  for (const cambio of [
    x => { x.regla.cobertura.periodo.hasta = '2024-01-01'; },
    x => { delete x.regla.cobertura.periodo.motivo; },
    x => { x.regla.cobertura.periodo.desde = '2024-02-30'; },
    x => { x.regla.vigencia = { estado: 'pendiente' }; },
    x => { x.regla.vigencia = { estado: 'definida', tipo: 'instante_utc', desde: null, hasta: null }; }
  ]) {
    const x = entradaCivil(); x.regla.cobertura.periodo = { desde: '2024-05-05', hasta: null, motivo: 'Fixture' };
    cambio(x); assert.throws(() => evaluar(x));
  }
});
test('C2: ni una guardia histórica permite usar fuentes consultadas después del cálculo', () => {
  const x = entradaCivil(); x.fechaEvaluacion = '2024-05-05T12:00:00.000Z';
  x.regla.fuentes[0].consultadaEn = '2026-10-14T12:00:00.000Z';
  assert.throws(() => evaluar(x));
});
test('C2: abandonar cobertura temporal solicita revisión aunque la norma siga en vigor', () => {
  const x = entradaCivil(); x.regla.vigencia.hasta = null;
  x.regla.cobertura.periodo = { desde: null, hasta: '2026-10-15', motivo: 'Fixture de cobertura finita' };
  const r = evaluar(x); x.fechaEvaluacion = '2026-10-14T22:00:00.000Z';
  assert.deepEqual(comparar(r.snapshot, x), { requiereRevision: true, contextoCambiado: false,
    reglaCambiada: false, periodoCambiado: false, coberturaPeriodoCambiado: true });
});
