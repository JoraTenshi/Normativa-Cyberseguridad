'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { obtenerBorradorRGPD28, inspeccionarBorradorRGPD28 } = require('../catalogo/propuestas/rgpd28EncargoDirecto');
const { catalogo, crearCatalogo } = require('../services/catalogoAplicabilidad');
const { evaluarAplicabilidadContextual } = require('../services/aplicabilidadContextual');
const { validarRegla, huella } = require('../validation/aplicabilidadContextual');
const ORG = '100000000000000000000001';
const valores = {
  operacion_vinculada_establecimiento_es: true, actividad_comercial_ordinaria: true,
  cliente_actua_como_responsable: true, rol_determinado_por_ley: false,
  trata_datos_personales: true, tratamiento_automatizado_o_fichero: true,
  entidades_distintas: true, cliente_decide_fines_medios_esenciales: true,
  tratamiento_por_cuenta_cliente: true, fines_propios_misma_operacion: false
};
const conocido = (clave, valor) => ({ clave, estado: 'conocido', valor,
  procedencia: { tipo: 'declarado', referencia: 'CASO-FICTICIO-SIN-DATOS-PERSONALES' } });
function entrada() {
  return { organizacionId: ORG, fechaEvaluacion: '2026-10-10T10:00:00.000Z',
    contexto: { id: 'CTX_OPERACION_A', version: 1, organizacionId: ORG,
      objeto: { tipo: 'operacion', id: 'operacion_Asistentes' },
      registradoEn: '2026-10-09T10:00:00.000Z',
      hechos: Object.entries(valores).map(([k, v]) => conocido(k, v)) } };
}
function cambiar(e, clave, nuevo) {
  e.contexto.hechos = e.contexto.hechos.map(h => h.clave === clave ? nuevo : h);
  return e;
}
const inspeccionar = inspeccionarBorradorRGPD28;
const borrador = obtenerBorradorRGPD28;

test('propuesta válida y versionada, con fuentes pendientes: no finge revisión', () => {
  const r = borrador();
  assert.equal(validarRegla(r), r);
  assert.equal(r.estado, 'borrador');
  assert.equal(r.revision, undefined);
  assert.deepEqual(r.tiposObjeto, ['operacion']);
  assert.equal(r.vigencia.estado, 'pendiente');
  assert(r.fuentes.every(f => f.estadoRevision === 'pendiente'));
  assert(r.fuentes.some(f => f.id === 'RGPD_CORRECCION_2021'));
});
test('catálogo de producción sigue sin esta regla', () => {
  assert.equal(catalogo.actual('RGPD_ART28_ENCARGO_DIRECTO'), null);
  assert.deepEqual(catalogo.listar(), []);
  assert.deepEqual(crearCatalogo([borrador()]).listar(), []);
});
test('ni siquiera la condición verdadera permite activar el borrador', () => {
  const e = entrada();
  const calculo = evaluarAplicabilidadContextual({ ...e, regla: borrador() });
  assert.equal(calculo.decision.estado, 'candidato');
  assert.equal(calculo.decision.habilitaEvaluacion, false);
  const r = inspeccionar(e);
  assert.equal(r.cobertura, 'dentro_del_caso_inicial');
  assert.equal(r.contraste.valor, 'verdadero');
  assert.equal(r.estado, 'borrador_no_operativo');
  assert.equal(r.habilitaEvaluacion, false);
  assert.equal(r.requiereRevisionJuridica, true);
  assert.equal(r.decision, undefined);
});
test('empresa sin subespacio y operación de servicio usan el mismo contrato interno', () => {
  const a = entrada(), b = entrada();
  b.contexto.id = 'CTX_SAAS'; b.contexto.objeto.id = 'operacion_SaaS';
  assert.deepEqual(inspeccionar(a), inspeccionar(b));
  assert.equal('subespacioId' in a.contexto, false);
});
for (const clave of Object.keys(valores).slice(0, 4)) {
  test('límite de cobertura ' + clave + ' nunca genera no_aplica', () => {
    const r = inspeccionar(cambiar(entrada(), clave, conocido(clave, !valores[clave])));
    assert.equal(r.cobertura, 'fuera_de_cobertura');
    assert.deepEqual(r.fuera, [clave]);
    assert.equal(r.estado, 'borrador_no_operativo');
    assert.equal(r.habilitaEvaluacion, false);
    assert.equal(r.preguntas.length, 0);
    assert.match(r.mensaje, /no significa/);
  });
  test('cobertura desconocida ' + clave + ' pide aclararla antes de las preguntas de fondo', () => {
    const e = cambiar(entrada(), clave, { clave, estado: 'desconocido', motivo: 'no_sabe' });
    e.contexto.hechos = e.contexto.hechos.filter(h => h.clave !== 'trata_datos_personales');
    const r = inspeccionar(e);
    assert.equal(r.cobertura, 'pendiente_de_delimitar');
    assert.deepEqual(r.preguntas.map(p => p.clave), [clave]);
  });
}
for (const clave of Object.keys(valores).slice(4)) {
  test('dato de fondo desconocido ' + clave + ' permanece pendiente', () => {
    const e = cambiar(entrada(), clave, { clave, estado: 'desconocido', motivo: 'por_consultar' });
    const r = inspeccionar(e);
    assert.equal(r.contraste.valor, 'desconocido');
    assert.equal(r.estado, 'borrador_no_operativo');
    assert.deepEqual(r.preguntas.map(p => p.clave), [clave]);
  });
  test('condición no satisfecha ' + clave + ' no publica una exclusión legal', () => {
    const r = inspeccionar(cambiar(entrada(), clave, conocido(clave, !valores[clave])));
    assert.equal(r.contraste.valor, 'falso');
    assert.equal(r.estado, 'borrador_no_operativo');
    assert.equal(r.habilitaEvaluacion, false);
    assert.equal(r.requiereRevisionJuridica, true);
  });
}
test('sin hechos no presupone España, relación de encargo ni ámbito ordinario', () => {
  const e = entrada(); e.contexto.hechos = [];
  const r = inspeccionar(e);
  assert.equal(r.cobertura, 'pendiente_de_delimitar');
  assert.equal(r.preguntas.length, 4);
});
test('conflicto decisivo no se transforma en un sí o un no', () => {
  const clave = 'cliente_decide_fines_medios_esenciales';
  const e = cambiar(entrada(), clave, { clave, estado: 'conflictivo', alternativas: [
    { valor: true, procedencia: conocido(clave, true).procedencia },
    { valor: false, procedencia: conocido(clave, false).procedencia }
  ] });
  const r = inspeccionar(e);
  assert.equal(r.contraste.valor, 'desconocido');
  assert.deepEqual(r.preguntas.map(p => p.clave), [clave]);
  assert.equal(r.contraste.incidencias[0].motivo, 'hechos_contradictorios');
});
test('no exige contrato firmado para reconocer la candidatura', () => {
  const e = entrada();
  e.contexto.hechos.push(conocido('contrato_firmado', false));
  assert.equal(inspeccionar(e).contraste.valor, 'verdadero');
  cambiar(e, 'contrato_firmado', conocido('contrato_firmado', true));
  assert.equal(inspeccionar(e).contraste.valor, 'verdadero');
});
test('PDF, tareas o elección técnica no acreditan el rol ni cumplimiento', () => {
  const e = entrada();
  e.contexto.hechos.push(conocido('pdf_subido', true), conocido('tarea_terminada', true),
    conocido('proveedor_elige_servidor', true));
  assert.deepEqual(inspeccionar(e), inspeccionar(entrada()));
  e.contexto.hechos = e.contexto.hechos.filter(h => h.clave !== 'cliente_decide_fines_medios_esenciales');
  assert.equal(inspeccionar(e).contraste.valor, 'desconocido');
});
test('no publica ni muta la propuesta a través de referencias compartidas', () => {
  const a = borrador(), h = huella(a);
  a.estado = 'revisada'; a.fuentes[0].estadoRevision = 'revisada';
  assert.equal(huella(borrador()), h);
  const e = entrada(), copia = structuredClone(e);
  const r = inspeccionar(e); r.fuentes[0].estadoRevision = 'revisada';
  assert.deepEqual(e, copia);
  assert.equal(inspeccionar(e).fuentes[0].estadoRevision, 'pendiente');
});
for (const tipo of ['organizacion', 'servicio', 'producto', 'contrato', 'sistema']) {
  test('rechaza heredar el papel a todo el objeto ' + tipo, () => {
    const e = entrada(); e.contexto.objeto = { tipo, id: tipo === 'organizacion' ? ORG : 'OBJ_A' };
    assert.throws(() => inspeccionar(e), err => err.codigo === 'AMBITO_NO_ADMITIDO');
  });
}
test('empresa diferente o fuente futura se rechazan en la comprobación interna', () => {
  const e = entrada(); e.organizacionId = '200000000000000000000002';
  assert.throws(() => inspeccionar(e), err => err.codigo === 'ORGANIZACION_NO_COINCIDE');
  const f = entrada(); f.contexto.registradoEn = '2026-10-08T10:00:00.000Z';
  f.fechaEvaluacion = '2026-10-09T09:34:59.000Z';
  assert.throws(() => inspeccionar(f), err => err.campo === 'consulta_fuente_futura');
});
test('no acepta estado, regla o revisión proporcionados al inspector', () => {
  for (const extra of [{ regla: borrador() }, { estado: 'aplica' }, { revision: 'aprobada' }]) {
    assert.throws(() => inspeccionar({ ...entrada(), ...extra }));
  }
});
test('tipos inválidos también se rechazan en ramas fuera de cobertura', () => {
  const e = cambiar(entrada(), 'operacion_vinculada_establecimiento_es',
    conocido('operacion_vinculada_establecimiento_es', false));
  cambiar(e, 'trata_datos_personales', conocido('trata_datos_personales', 'true'));
  assert.throws(() => inspeccionar(e), err => err.campo === 'valor_booleano');
});
test('getters no se ejecutan al inspeccionar una entrada', () => {
  let lecturas = 0;
  const e = entrada();
  Object.defineProperty(e, 'extra', { enumerable: true, get() { lecturas++; return true; } });
  assert.throws(() => inspeccionar(e));
  assert.equal(lecturas, 0);
});
