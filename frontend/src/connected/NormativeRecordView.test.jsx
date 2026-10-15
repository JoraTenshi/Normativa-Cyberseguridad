import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import NormativeRecordView from './NormativeRecordView';
import { civilDate, recordedAt, sourceUrl, reviewMatches, recordDimensions } from './normative-view-model';
import ens from './__fixtures__/ENS_POLITICA_SEGURIDAD.v3.json';
import rgpd from './__fixtures__/RGPD28_FORMALIZACION_CONTENIDO.v3.json';

let root, container;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); delete global.IS_REACT_ACT_ENVIRONMENT; });
async function render(props = {}) { await act(async () => root.render(<div className="desk-v2"><NormativeRecordView ficha={ens.ficha} {...props}/></div>)); }
// Synthetic domain references: never imported into the running application.
const hash = 'a'.repeat(64), org = '1'.repeat(24), decisionId = '2'.repeat(24);
function domain() {
  const ficha = ens.ficha;
  const decisionRecord = { id:decisionId, numero:1, reglaId:ficha.reglaId, versionRegla:ficha.versionRegla, versionContexto:2,
    decision:{ organizacionId:org, regla:{id:ficha.reglaId,version:ficha.versionRegla}, estado:'aplica', temporal:'en_periodo', cobertura:{estado:'dentro_de_cobertura'}, habilitaEvaluacion:true } };
  const requisito = { id:'3'.repeat(24),version:1,sha256:hash,organizacionId:org,decisionId,ficha:{id:ficha.id,version:ficha.version,sha256:hash} };
  const revision = { id:'4'.repeat(24),version:1,tipo:'interna',organizacionId:org,decisionId,
    requisito:{id:requisito.id,version:1,sha256:hash},ficha:requisito.ficha,criterios:[],evidencias:[],conclusion:'favorable',motivo:'Revisión sintética motivada',revisor:{usuarioId:'5'.repeat(24)},periodo:{desde:'2026-10-01',hasta:'2026-10-14'} };
  return { ficha,decisionRecord,requisito,revision,revisionStatus:{satisfaccionActual:'favorable',requiereRevision:false} };
}
test.each([[ens,10],[rgpd,14]])('muestra los criterios reales de la ficha v3 como un único requisito (%#)', async (pack, total) => {
  await render({ficha:pack.ficha}); expect(container.querySelectorAll('.norm-criteria>li')).toHaveLength(total);
  expect(container.textContent).toContain(`${total} criterios dentro de un único requisito contextualizado`);
  expect(container.textContent).not.toMatch(/\d+%/); expect(container.querySelector('form')).toBeNull();
});
test('ENS conserva el fundamento añadido de coordinación, art. 11.3', async () => {
  await render(); expect(container.textContent).toContain('Art. 11.3'); expect(container.textContent).toContain('mecanismos de coordinación');
});
test('muestra consulta de fuentes y revisión editorial reales sin atribuir dictamen profesional', async()=>{
  await render();
  expect(container.textContent).toContain('Consulta de la fuente: '+recordedAt(ens.ficha.fuentes[0].consultadaEn));
  expect(container.textContent).toContain('Análisis asistido por IA con fuentes primarias');
  expect(container.textContent).toContain('Fecha: '+recordedAt(ens.ficha.revisionEditorial.fecha));
  expect(container.textContent).toContain(ens.ficha.revisionEditorial.actor);
  expect(container.textContent).toContain('no equivale a un dictamen jurídico profesional');
  expect(recordedAt(null)).toBe('Fecha no informada');
  expect(recordedAt('incorrecta')).toBe('Fecha no válida');
});
test('cinco dimensiones separadas sin convertir la guardia técnica en permiso ni satisfacción', async () => {
  const d = domain(); await render({decisionRecord:d.decisionRecord});
  expect(container.querySelectorAll('.norm-dimensions>div')).toHaveLength(5);
  expect(container.textContent).toContain('Permiso no consultado'); expect(container.textContent).toContain('Valoración actual no consultada');
  expect(container.textContent).not.toContain('Revisión interna favorable');
});
test('fuera de cobertura no se transforma en no aplica', () => {
  const d = domain(); d.decisionRecord.decision.cobertura.estado='fuera_de_cobertura'; d.decisionRecord.decision.estado='pendiente_de_determinar';
  const states=recordDimensions(d); expect(states[0].value).toBe('Fuera de cobertura'); expect(states[2].value).toBe('Aplicabilidad por determinar');
});
test('la decisión de otra versión no se asocia a la ficha actual', async () => {
  const d=domain(); d.decisionRecord.versionRegla=1; await render(d);
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelector('.norm-dimensions').textContent).not.toContain('Revisión interna favorable');
});
test('la revisión se vincula a organización, decisión y referencias exactas de ficha y requisito', () => {
  const d=domain(); expect(reviewMatches(d.ficha,d.decisionRecord,d.revision,d.requisito)).toBe(true);
  for (const revision of [{...d.revision,organizacionId:'9'.repeat(24)}, {...d.revision,decisionId:'9'.repeat(24)}, {...d.revision,requisito:{...d.revision.requisito,version:2}}, {...d.revision,ficha:{...d.revision.ficha,sha256:'b'.repeat(64)}}]) {
    expect(reviewMatches(d.ficha,d.decisionRecord,revision,d.requisito)).toBe(false);
  }
  expect(reviewMatches(d.ficha,d.decisionRecord,d.revision,null)).toBe(false);
});
test('una conclusión histórica favorable no se convierte en valoración actual sin respuesta de vigencia', () => {
  const d=domain(); d.revisionStatus=null;
  expect(recordDimensions(d)[4].value).toBe('Valoración actual no consultada');
});
test('cambios de contexto o vigencia mantienen la conclusión histórica pero exigen nueva revisión', async () => {
  const d=domain(); d.decisionRecord.revision={requiereNuevaDecision:true}; await render(d);
  expect(container.querySelector('.norm-dimensions').textContent).toContain('Requiere nueva revisión');
  expect(container.textContent).toContain('Conclusión histórica: favorable');
  d.decisionRecord.revision={}; d.revisionStatus.requiereRevision=true;
  expect(recordDimensions(d)[4].value).toBe('Requiere nueva revisión');
});
test('consultar evidencia entrega la versión exacta, sin solicitar última versión ni crear rutas', async () => {
  const d=domain(), open=jest.fn();
  const soporte={tipo:'version_documento',documentoId:'6'.repeat(24),versionDocumentoId:'7'.repeat(24),numero:2,sha256:hash};
  d.revision.evidencias=[{id:'8'.repeat(24),version:1,titulo:'Documento sintético',procedencia:'Fixture de test',localizador:'Página 2',periodo:{desde:'2026-10-01',hasta:'2026-10-14',zonaEvaluacion:'Europe/Madrid'},soporte}];
  await render({...d,onOpenDocumentVersion:open}); await act(async()=>Simulate.click(container.querySelector('button')));
  const {tipo,...ref}=soporte; expect(open).toHaveBeenCalledWith(ref); expect(container.textContent).toContain('versión 2');
});
test('no muestra botón de documento sin un adaptador ni acciones de guardar revisión', async () => {
  await render(); expect(container.querySelector('button')).toBeNull(); expect(container.querySelector('form')).toBeNull();
});
test('fechas civiles no cambian de día por zona horaria y validan calendario', () => {
  expect(civilDate('2024-05-05')).toBe('05/05/2024'); expect(civilDate('2024-02-29')).toBe('29/02/2024');
  expect(civilDate('2026-02-29')).toBe('Fecha no válida'); expect(civilDate('2026-13-02')).toBe('Fecha no válida');
  expect(civilDate(null)).toBe('Fecha no informada'); expect(civilDate('2026-10-14T00:00:00Z')).toBe('Fecha no informada');
});
test('fuentes no ejecutan esquemas arbitrarios ni enlaces con credenciales', () => {
  expect(sourceUrl('javascript:alert(1)')).toBeNull(); expect(sourceUrl('https://user:password@example.com')).toBeNull();
  expect(sourceUrl('https://www.boe.es/buscar/act.php?id=BOE-A-2022-7191')).toContain('https://www.boe.es/');
});
test('permiso denegado y desconocido siguen distintos de evaluabilidad', () => {
  expect(recordDimensions({...domain(),canReview:false})[3].value).toBe('Acción no autorizada');
  expect(recordDimensions(domain())[3].value).toBe('Permiso no consultado');
});
test('un favorable histórico no se presenta como actual si la decisión deja de habilitar el análisis', () => {
  const d=domain(); d.decisionRecord.decision.habilitaEvaluacion=false;
  expect(recordDimensions(d)[4].value).toBe('Requiere nueva revisión');
  expect(recordDimensions(d)[3].value).toBe('Permiso no consultado');
});

