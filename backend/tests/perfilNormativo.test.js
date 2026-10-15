'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { empresa, confirmacion, conocido, desconocido } = require('./fixtures/nexoSoftware');
const { combinar } = require('../validation/contextoEmpresa');
const { proponer, proyectar, analizar } = require('../services/perfilNormativo');
const { preparar } = require('../validation/alcanceEvaluacion');
const { obtenerCatalogo, permiteUso } = require('../catalogo/orientacionC1');
const { catalogo } = require('../services/catalogoAplicabilidad');
const { huella } = require('../validation/aplicabilidadContextual');
const { evaluarAplicabilidadContextual } = require('../services/aplicabilidadContextual');
const fixtureMotor = require('./fixtures/aplicabilidadContextual');
const miembro = '100000000000000000000001';
function contexto(hechos = empresa().hechos) { return { id: 'ctx_empresa', version: 1,
  organizacionId: miembro, objeto: { tipo: 'organizacion', id: miembro }, registradoEn: '2026-10-12T10:00:00.000Z',
  hechos: combinar([], hechos, miembro) }; }
const propuesta = hs => proponer(contexto(hs));
const reemplazar = (clave, hecho) => empresa().hechos.filter(h => h.clave !== clave).concat(hecho);
test('Nexo produce tres propuestas reproducibles y preliminares, no certificaciones', () => {
  const p = propuesta(); assert.equal(p.espacios.length, 3); assert.equal(p.alcances.length, 3);
  assert.equal(p.esCertificacion, false); assert.deepEqual(propuesta(), p);
  assert.ok(p.alcances.every(a => a.estado === 'preliminar' && !a.sistemas.length));
});
test('ENS conserva la duda de cadena pública aunque no haya contrato público directo', () => {
  const c = propuesta().candidatos.find(c => c.familia === 'ENS');
  assert.equal(c.aplicabilidad, 'pendiente_de_determinar');
  assert.ok(c.desconocidos.some(h => h.clave === 'cadena_publica'));
  assert.ok(c.localizadores[0].localizadores.includes('artículo 2.3'));
});
for (const [campo, fundamento] of [['publico_directo', 'legal'], ['exigencia_ens', 'contractual'], ['voluntario_ens', 'adopcion_voluntaria']]) {
  test('variante independiente ' + fundamento + ' no cambia los demás fundamentos', () => {
    const hs = reemplazar(campo, conocido(campo, true));
    const c = propuesta(hs).candidatos.find(c => c.familia === 'ENS');
    assert.deepEqual(c.fundamentos.map(f => f.tipo), [fundamento]);
    assert.equal(c.estado, 'candidato'); assert.equal(c.satisfaccion, 'no_evaluada');
  });
}
test('los fundamentos pueden concurrir y el contrato conserva su referencia propia', () => {
  let hs = empresa().hechos.filter(h => !['publico_directo','exigencia_ens','voluntario_ens'].includes(h.clave));
  hs.push(...['publico_directo','exigencia_ens','voluntario_ens'].map(k => conocido(k,true)), conocido('referencia_contrato_ens','CT-2026-01'));
  const c = propuesta(hs).candidatos.find(c => c.familia === 'ENS');
  assert.equal(c.fundamentos.length,3); assert.equal(c.fundamentos.find(f => f.tipo === 'contractual').referenciaContrato[0].valor,'CT-2026-01');
});
test('preguntas condicionales: IA solo para actividad que la usa, sin convertir omisiones en false', () => {
  const p = propuesta();
  assert.ok(p.perfil.preguntas.some(x => x.clave === 'actividad_saas_papel_ia'));
  assert.ok(!p.perfil.preguntas.some(x => x.clave === 'actividad_web_papel_ia'));
  assert.equal(p.perfil.actividades[0].hechos.find(h => h.campo === 'datos_terceros').estado, 'desconocido');
});
test('contradicción empresa-operación conserva ambos hechos con versiones y procedencias', () => {
  const ctx = contexto(), perfil = proyectar(ctx);
  const op = { id: '200000000000000000000002', version: 2, autorId: miembro, membresiaAutorId: miembro,
    contexto: { ...contexto([conocido('publico_directo',true)]), id: 'ctx_operacion', version: 2 } };
  const salida = analizar(perfil, [op]);
  assert.equal(salida.contradicciones.length,1);
  assert.equal(salida.contradicciones[0].especifico.valor,true);
  assert.equal(ctx.hechos.find(h => h.clave === 'publico_directo').valor,false);
});
test('desconocido y conflicto explícitos no se transforman en hecho conocido', () => {
  for (const h of [desconocido('publico_directo'), { clave: 'publico_directo', estado: 'conflictivo', alternativas: [{valor:true},{valor:false}] }]) {
    const c = propuesta(reemplazar('publico_directo',h)).candidatos.find(c => c.familia==='ENS');
    assert.ok(c.desconocidos.some(x => x.clave===h.clave && x.estado===h.estado));
  }
});
test('requisitos transversales y relación varias actividades-alcance se conservan', () => {
  const p=propuesta(), d=confirmacion(p);
  d.alcances[0].actividadIds.push('producto');
  const r=preparar(d,'confirmacion_123456789'); assert.equal(r.alcances[0].actividadIds.length,2);
  assert.ok(p.candidatos.every(c=>c.alcanceTransversal));
});
test('cada candidato enlaza hechos, selector versionado, definición y referencia localizada', () => {
  const p=propuesta();
  for(const c of p.candidatos) {
    assert.ok(c.hechos.length); assert.equal(c.regla.version,1);
    assert.ok(p.catalogo.definiciones.some(d=>d.id===c.definicionId && d.version===c.definicionVersion));
    for(const f of c.localizadores) assert.ok(p.catalogo.fuentes.some(s=>s.id===f.fuenteId && s.version===f.version));
  }
});
test('catálogo de orientación no publica reglas y devuelve copias defensivas', () => {
  assert.deepEqual(catalogo.listar(),[]);
  const c=obtenerCatalogo(); c.publicado=true; c.fuentes.length=0;
  assert.equal(obtenerCatalogo().publicado,false); assert.ok(obtenerCatalogo().fuentes.length);
  assert.ok(obtenerCatalogo().definiciones.every(d=>d.revisionJuridica.estado==='pendiente'));
});
test('ISO/CCN sin licencia no permiten reproducción/exportación/IA ni fuerzan no aplica', () => {
  for(const f of obtenerCatalogo().fuentes.filter(f=>f.id.startsWith('ISO')||f.id.startsWith('CCN'))) {
    for(const uso of ['almacenamiento','reproduccion_literal','extractos','distribucion','exportacion','ia']) assert.equal(permiteUso(f,uso),false);
    assert.ok(!Object.hasOwn(f,'textoCompleto'));
  }
  assert.equal(propuesta().candidatos.find(c=>c.familia==='ISO27001').aplicabilidad,'pendiente_de_determinar');
});
test('fechas jurídicas civiles no se convierten en UTC y no implican evaluación temporal', () => {
  const f=obtenerCatalogo().fuentes.find(f=>f.id==='ENS');
  assert.equal(f.fechas.entradaEnVigor,'2022-05-05'); assert.equal(f.fechas.jurisdiccion,'ES');
  assert.equal(propuesta().candidatos.find(c=>c.familia==='ENS').temporalidad.estado,'por_determinar');
});
test('cambios de contexto y versiones de operación cambian la huella, no por hora de consulta', () => {
  const ctx=contexto(), a=proponer(ctx), b=proponer({...ctx,version:2}); assert.notEqual(a.propuestaHuella,b.propuestaHuella);
  assert.equal(a.propuestaHuella,proponer(ctx).propuestaHuella);
});
test('datos de documentos o tareas no producen estados favorables ni porcentajes', () => {
  const p=propuesta([...empresa().hechos,conocido('pdf_subido',true),conocido('tareas_terminadas',100)]);
  assert.ok(p.candidatos.every(c=>c.satisfaccion==='no_evaluada'));
  assert.deepEqual(p.decisionesJuridicas,[]); assert.ok(!Object.hasOwn(p,'porcentaje'));
});
for (const campo of ['actor','organizacionId','estado','reglaPublicada','permisos','porcentaje']) {
  test('materialización rechaza campo falsificado '+campo,()=>assert.throws(()=>preparar({...confirmacion(propuesta()),[campo]:true},'confirmacion_123456789'),e=>e.codigo==='DATOS_INVALIDOS'));
}
for (const [nombre,cambiar] of [
  ['sin confirmación',d=>delete d.confirmar], ['versión texto',d=>d.contextoVersion='1'],
  ['huella vacía',d=>d.propuestaHuella=''], ['espacios duplicados',d=>d.espacios.push(d.espacios[0])],
  ['exclusión injustificada',d=>d.alcances[0].exclusiones=[{elemento:'sistema',motivo:''}]],
  ['estado favorable',d=>d.alcances[0].estado='cumple'], ['dos modos de espacio',d=>d.espacios[0].existente={id:miembro,version:0}]
]) test('rechaza '+nombre,()=>{const d=confirmacion(propuesta());cambiar(d);assert.throws(()=>preparar(d,'confirmacion_123456789'));});
test('tipos de perfil incorrectos no se interpretan con coerción',()=>{
  assert.throws(()=>propuesta(reemplazar('publico_directo',conocido('publico_directo','false'))));
  assert.throws(()=>propuesta(reemplazar('perfil_actividades',conocido('perfil_actividades',['a','a']))));
});
test('segunda etapa precisa sigue siendo el motor existente, solo con fixture sintética',()=>{
  const e=fixtureMotor.entrada();
  e.contexto.hechos=[fixtureMotor.conocido('a',false),fixtureMotor.conocido('b',false)];
  const r=evaluarAplicabilidadContextual(e);
  assert.equal(r.decision.estado,'no_aplica');
  assert.deepEqual(catalogo.listar(),[]);
});
