'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { validarFicha, validarPaquete } = require('../validation/paqueteNormativo');
const { contextualizarRequisito, validarEvidencia, vincularActuacion, crearRevisionRequisito: revisar,
  vigenciaRevision } = require('../services/revisionRequisito');
const { paquete, revision, oid, huella } = require('./fixtures/revisionRequisito');
const { evaluarAplicabilidadContextual } = require('../services/aplicabilidadContextual');

test('C2 dominio: ficha coherente conserva origen/editorial y no publica', () => {
  const p = paquete(), r = validarPaquete({ ficha: p.ficha, regla: p.regla });
  assert.deepEqual(r.ficha, p.ficha); assert.match(r.aviso, /no publica/);
  assert.equal(r.ficha.revisionEditorial.dictamenJuridicoProfesional, false);
});
for (const [nombre, cambiar] of [
  ['fuente ajena', f => { f.criterios[0].fuenteIds = ['AJENA']; }],
  ['precepto ajeno', f => { f.criterios[0].preceptos[0].fuenteId = 'AJENA'; }],
  ['criterio repetido', f => { f.criterios.push(f.criterios[0]); }],
  ['cierre automático', f => { f.condicionesRevision.aprobacionAutomatica = true; }],
  ['caducidad arbitraria', f => { f.condicionesRevision.caducidadUniversal = 30; }],
  ['dictamen profesional inventado', f => { f.revisionEditorial.dictamenJuridicoProfesional = true; }],
  ['contenido protegido', f => { f.usoContenido.incluyeISOoCCNProtegido = true; }],
  ['fuentes desincronizadas', f => { f.fuentes[0].localizador = 'Otra'; }],
  ['dependencia inexistente', f => { f.actuacionesSugeridas[0].dependeDe = ['AJENA']; }],
  ['dependencia cíclica', f => { f.actuacionesSugeridas.push({ ...f.actuacionesSugeridas[0], id: 'A2', dependeDe: ['A1'] }); f.actuacionesSugeridas[0].dependeDe = ['A2']; }],
  ['guardia no integrada', f => { f.coberturaTemporalDelPaquete = { desde: '2020-01-01', hasta: null,
    tipo: 'limite_de_cobertura_historica_no_fecha_legal', motivo: 'Pendiente', accionFuera: 'requiere_analisis_fuera_de_cobertura', obligatoriaAntesDeEvaluar: true }; }]
]) test('C2 dominio: ficha rechaza ' + nombre, () => {
  const p = paquete(); cambiar(p.ficha); assert.throws(() => validarFicha(p.ficha, p.regla));
});
test('C2 dominio: requisito fija versión exacta de alcance, regla, fuentes y contexto', () => {
  const e = revision(), r = e.requisito;
  assert.equal(r.alcance.version, 1); assert.equal(r.ficha.sha256, huella(e.ficha));
  assert.equal(r.resultado.decision.cobertura.estado, 'dentro_de_cobertura');
  assert.equal(r.resultado.decision.revisionDecision, 'automatica_orientativa');
  assert.equal(r.conclusion, undefined); assert.equal(r.satisfaccion, undefined);
});
test('C2 dominio: relación actuación-requisito muchos a muchos no genera valoración', () => {
  const e = revision(), a = { id: oid(100), version: 1, organizacionId: e.requisito.organizacionId };
  const r1 = vincularActuacion({ requisito: e.requisito, actuacion: a });
  const { sha256, ...base } = e.requisito; base.id = oid(11);
  const otro = { ...base, sha256: huella(base) };
  const r2 = vincularActuacion({ requisito: otro, actuacion: a });
  assert.equal(r1.actuacionId, r2.actuacionId); assert.notEqual(r1.requisitoId, r2.requisitoId);
  assert.equal(r1.conclusion, undefined);
  assert.throws(() => vincularActuacion({ requisito: otro, actuacion: { ...a, organizacionId: oid(99) } }));
});
test('C2 dominio: subir PDF o cerrar tareas no crea una conclusión de requisito', () => {
  const e = revision(); assert.equal(validarEvidencia(e.evidencias[0]).conclusion, undefined);
  e.evidencias = []; e.datos.criterios.forEach(c => { c.evidenciaIds = []; });
  assert.throws(() => revisar(e));
  e.datos.tareasCerradas = true; assert.throws(() => revisar(e));
});
test('C2 dominio: favorable solo por revisión explícita de TODOS los criterios', () => {
  const e = revision(), copia = structuredClone(e), r = revisar(e);
  assert.equal(r.conclusion, 'favorable'); assert.equal(r.esCertificacion, false);
  assert.equal(r.dictamenJuridicoProfesional, false); assert.equal(r.revisor.usuarioId, e.permiso.usuarioId);
  assert.deepEqual(r.evidencias[0].soporte, e.evidencias[0].soporte); assert.deepEqual(e, copia);
});
test('C2 dominio: admite revisión desfavorable o no determinada sin compensar criterios', () => {
  for (const resultado of ['desfavorable', 'no_determinado']) {
    const e = revision(); e.datos.criterios[0].resultado = resultado; e.datos.criterios[0].evidenciaIds = [];
    e.datos.conclusion = resultado; assert.equal(revisar(e).conclusion, resultado);
  }
});
test('C2 dominio: constatación tipada no PDF, con método, autoría declarada y límites', () => {
  const e = revision(); e.evidencias[0].tipo = 'constatacion_revision';
  e.evidencias[0].soporte = { tipo: 'comprobacion', metodo: 'Entrevista de prueba', realizadaEn: e.fechaRevision,
    responsableRef: 'Persona ficticia', resultado: 'Observación motivada', limitaciones: 'Solo caso sintético' };
  assert.equal(revisar(e).evidencias[0].soporte.tipo, 'comprobacion');
});
for (const [nombre, cambiar] of [
  ['criterios omitidos', e => { e.datos.criterios.pop(); }],
  ['criterios duplicados', e => { e.datos.criterios[1] = e.datos.criterios[0]; }],
  ['criterio no procede libre', e => { e.datos.criterios[0].resultado = 'no_procede'; }],
  ['resultado incoherente', e => { e.datos.criterios[0].resultado = 'desfavorable'; }],
  ['motivo ausente', e => { e.datos.criterios[0].motivo = ''; }],
  ['revisor inyectado', e => { e.datos.revisor = oid(9); }],
  ['rol técnico sin permiso', e => { e.permiso.rol = 'colaborador'; }],
  ['permiso de otra empresa', e => { e.permiso.organizacionId = oid(9); }],
  ['documento de otra empresa', e => { e.evidencias[0].organizacionId = oid(9); }],
  ['documento de otro alcance', e => { e.evidencias[0].alcanceIds = [oid(9)]; }],
  ['versión de documento sin resolver', e => { delete e.evidencias[0].soporte.versionDocumentoId; }],
  ['versión de requisito obsoleta', e => { e.datos.requisito.version = 2; }],
  ['evidencia no referenciada', e => { e.datos.criterios.forEach(c => { c.resultado = 'no_determinado'; c.evidenciaIds = []; }); e.datos.conclusion = 'no_determinado'; }],
  ['periodo sin cubrir', e => { e.evidencias[0].periodo = { ...e.evidencias[0].periodo, desde: '2026-10-15', hasta: '2026-10-16' }; }],
  ['periodo fuera de vigencia', e => { e.datos.periodo = { ...e.datos.periodo, desde: '2026-10-13' }; }],
  ['ficha alterada', e => { e.ficha.criterios[0].descripcion = 'Cambio sin versión'; }],
  ['no autoriza revisión externa', e => { e.datos.tipo = 'externa'; }],
  ['no autoriza aprobación IA', e => { e.datos.tipo = 'automatizada'; }],
  ['admin no prueba aprobación ENS', e => { e.datos.criterios[0].evidenciaIds = []; }]
]) test('C2 dominio: revisión rechaza ' + nombre, () => {
  const e = revision(); cambiar(e); assert.throws(() => revisar(e));
});
test('C2 dominio: fuera de cobertura no admite revisión favorable aunque tenga documentos', () => {
  const e = revision(), p = paquete(); p.entrada.contexto.hechos.find(h => h.clave === 'cubierto').valor = false;
  e.requisito = contextualizarRequisito({ id: e.requisito.id, version: 2, organizacionId: e.requisito.organizacionId,
    alcance: e.requisito.alcance, decisionId: oid(32), resultado: evaluarAplicabilidadContextual(p.entrada), ficha: e.ficha });
  e.datos.requisito = { id: e.requisito.id, version: 2, sha256: e.requisito.sha256 };
  assert.throws(() => revisar(e));
});
test('C2 dominio: nueva evidencia exige revisión sin modificar favorable histórico', () => {
  const e = revision(), rv = revisar(e), original = structuredClone(rv);
  const v = () => vigenciaRevision({ revision: rv, requisitoActual: e.requisito, evidenciasActuales: e.evidencias, fechaConsulta: e.fechaRevision });
  assert.equal(v().requiereRevision, false);
  e.evidencias[0].version++; e.evidencias[0].soporte.numero++; e.evidencias[0].soporte.versionDocumentoId = oid(52);
  assert.equal(v().requiereRevision, true); assert.equal(v().satisfaccionActual, 'requiere_revision');
  assert.equal(v().conclusionHistorica, 'favorable'); assert.deepEqual(rv, original);
  e.evidencias = []; assert.match(v().motivos[0], /no_disponible/);
});
test('C2 dominio: nueva versión de alcance/contexto/fuente conserva conclusión anterior', () => {
  const e = revision(), rv = revisar(e), { sha256, ...base } = e.requisito;
  base.version++; base.alcance.version++;
  const actual = { ...base, sha256: huella(base) };
  const r = vigenciaRevision({ revision: rv, requisitoActual: actual, evidenciasActuales: e.evidencias, fechaConsulta: e.fechaRevision });
  assert.equal(r.requiereRevision, true); assert.equal(rv.conclusion, 'favorable');
});
test('C2 dominio: requisito alterado/organización ajena no se contextualiza', () => {
  const e = revision(); e.requisito.resultado.decision.estado = 'no_aplica'; assert.throws(() => revisar(e));
  const p = paquete(); assert.throws(() => contextualizarRequisito({ id: oid(1), version: 1, organizacionId: oid(9),
    alcance: { id: oid(2), version: 1, sha256: 'a'.repeat(64) }, decisionId: oid(3),
    resultado: evaluarAplicabilidadContextual(p.entrada), ficha: p.ficha }));
});
test('C2 dominio: paso del calendario pide revisión, sin borrar conclusión histórica', () => {
  const e = revision(), rv = revisar(e);
  const r = vigenciaRevision({ revision: rv, requisitoActual: e.requisito, evidenciasActuales: e.evidencias,
    fechaConsulta: '2026-10-15T12:00:00.000Z' });
  assert.equal(r.requiereRevision, true); assert.equal(r.conclusionHistorica, 'favorable');
  assert.ok(r.motivos.includes('periodo_no_habilitado'));
  e.fechaRevision = '2026-10-15T12:00:00.000Z'; assert.throws(() => revisar(e));
});
