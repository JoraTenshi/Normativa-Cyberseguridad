import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CurrentStatus } from './NormativeControls';
import ReviewEditor from './ReviewEditor';
import ens from './__fixtures__/ENS_POLITICA_SEGURIDAD.v3.json';

let root, container;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); delete global.IS_REACT_ACT_ENVIRONMENT; });
const period = {desde:'2026-10-15',hasta:'2026-10-16',zonaEvaluacion:'Europe/Madrid'};
function status(overrides = {}) {
  return {satisfaccionActual:'fuera_del_periodo_revisado',conclusionHistorica:'favorable',requiereRevision:false,motivos:[],avisosCobertura:['fecha_consulta_fuera_del_periodo_revisado'],seRefiereAVersionActual:3,coberturaPeriodo:{periodo:period,fechaCivilConsulta:'2026-10-16',estado:'despues_del_periodo',cubreFechaConsulta:false},...overrides};
}
async function render(state, content = {}) { await act(async () => root.render(<CurrentStatus dto={{versionActual:3,contenido:content,estadoRevision:state}}/>)); }

test.each([['favorable','Revisión favorable'],['desfavorable','Revisión desfavorable'],['no_determinado','Valoración no determinada']])('outside period preserves %s without asking for daily review',async (conclusionHistorica,label) => {
  const state = status({conclusionHistorica}); const before = JSON.stringify(state);
  await render(state);
  expect(container.textContent).toContain('Fuera del periodo revisado');
  expect(container.textContent).toContain('Conclusión histórica: '+label);
  expect(container.textContent).toContain('15/10/2026 → 16/10/2026 (final excluido)');
  expect(container.textContent).toContain('El cambio de día no exige por sí solo repetir la revisión');
  expect(container.textContent).not.toContain('Requiere nueva revisión');
  expect(container.querySelector('.warning')).toBeNull();
  expect(JSON.stringify(state)).toBe(before);
});

test.each(['evidencia_con_nueva_version','requisito_con_nueva_version','reloj_anterior_revision','periodo_no_habilitado'])('a substantive cause %s retains priority and separate coverage',async motivo => {
  await render(status({satisfaccionActual:'requiere_revision',requiereRevision:true,motivos:[motivo]}));
  expect(container.textContent).toContain('Requiere nueva revisión');
  expect(container.querySelector('[aria-label="Cobertura de la consulta"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="Motivos para revisar"]').textContent).toContain(motivo.replaceAll('_',' '));
  expect(container.querySelector('[aria-label="Motivos para revisar"]').textContent).not.toContain('fecha consulta fuera');
  expect(container.querySelector('[aria-label="Motivos para revisar"]').textContent).toContain('no se debe únicamente a quedar fuera del periodo examinado');
  expect(container.querySelector('.warning')).not.toBeNull();
  expect(container.textContent).toContain('Conclusión histórica: Revisión favorable');
});

test('the server response, not the browser clock, determines coverage at midnight',async () => {
  await render(status({satisfaccionActual:'favorable',avisosCobertura:[],coberturaPeriodo:{periodo:period,fechaCivilConsulta:'2026-10-15',estado:'en_periodo',cubreFechaConsulta:true}}));
  expect(container.textContent).toContain('La consulta está dentro del periodo revisado');
  expect(container.textContent).not.toContain('Fuera del periodo revisado');
  await render(status());
  expect(container.textContent).toContain('Fuera del periodo revisado');
  expect(container.textContent).not.toContain('Requiere nueva revisión');
  expect(container.textContent).toContain('Conclusión histórica: Revisión favorable');
});

test('no review does not fabricate a historical result or period',async () => {
  await render(status({satisfaccionActual:'sin_revisar',conclusionHistorica:null,coberturaPeriodo:null,avisosCobertura:[]}));
  expect(container.textContent).toContain('No consta revisión');
  expect(container.textContent).not.toContain('Periodo examinado:');
  expect(container.textContent).not.toContain('Fuera del periodo revisado');
});

test('a specific review has its own coverage, not a claimed latest requirement version',async () => {
  await render(status(),{revision:{conclusion:'favorable'}});
  expect(container.textContent).toContain('Estado de esta revisión frente a las bases actuales');
  expect(container.textContent).not.toContain('versión actual 3');
});

test('the actual review editor explains examined period before save without setting dates or writing',async () => {
  const id='a'.repeat(24), api={get:jest.fn().mockResolvedValue({registros:[],paginacion:{hayMas:false}}),write:jest.fn()};
  const requirement={id,version:1,versionActual:1,permisos:{revisar:true},evaluabilidad:{habilitaEvaluacion:true,fundamentosActuales:true,seRefiereAVersionActual:1},contenido:{paquete:ens,requisito:{alcance:{id}}}};
  await act(async () => root.render(<ReviewEditor api={api} base={'/organizaciones/'+id} requirement={requirement} onSaved={()=>{}}/>));
  const text=container.textContent;
  expect(text).toContain('¿Qué periodo has examinado?');
  expect(text).toContain('No es una fecha de caducidad ni el plazo para repetir la revisión');
  expect(text).toContain('No puedes valorar hechos futuros');
  expect(text.indexOf('¿Qué periodo has examinado?')).toBeLessThan(text.indexOf('Guardar en el servidor'));
  expect([...container.querySelectorAll('input[type="date"]')].map(i=>i.value)).toEqual(['','']);
  expect(api.write).not.toHaveBeenCalled();
});
