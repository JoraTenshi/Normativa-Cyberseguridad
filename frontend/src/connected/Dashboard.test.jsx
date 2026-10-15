import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { Dashboard, PendingSection } from './Dashboard';
let root, container, api, navigate;
const ops=[{id:'1',nombre:'Mantenimiento del portal',descripcion:'Contrato concreto',versionActual:3,revision:{registradoEn:'2026-10-11T20:00:00Z'},subespacioId:'s1'},
 {id:'2',nombre:'Desarrollo de API',descripcion:'Servicio nuevo',versionActual:1}];
beforeEach(()=>{
 global.IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);navigate=jest.fn();
 api={get:jest.fn(path=>Promise.resolve(path.includes('/operaciones')?{operaciones:ops,paginacion:{hayMas:true}}:path.includes('/documentos')?{documentos:[],siguiente:null}:{subespacios:[{id:'s1',nombre:'SaaS de reservas'}],siguiente:null}))};
});
afterEach(()=>{act(()=>root.unmount());container.remove();delete global.IS_REACT_ACT_ENVIRONMENT;});
async function render(admin=true) { await act(async()=>root.render(<Dashboard api={api} base="/organizaciones/a" admin={admin} onNavigate={navigate}/>)); }
test('cuenta solo registros recibidos y explicita paginación sin porcentaje ficticio',async()=>{
 await render();const values=Array.from(container.querySelectorAll('.desk-metric b')).map(e=>e.textContent);
 expect(values).toEqual(['2+','0','1','—']);expect(container.textContent).toContain('Hasta 20 registros');expect(container.textContent).toContain('Actuaciones registradas');expect(container.textContent).not.toMatch(/\d+%/);
 expect(api.get.mock.calls.map(c=>c[0])).toEqual(['/organizaciones/a/operaciones?limite=20','/organizaciones/a/normativa/actuaciones?limite=20','/organizaciones/a/documentos?estado=activo&limite=20','/organizaciones/a/subespacios?estado=activo&limite=20']);
});
test('errores de carga no se convierten en ceros ni datos simulados',async()=>{
 api.get.mockRejectedValue(new Error('sin conexión'));await render();
 expect(Array.from(container.querySelectorAll('.desk-metric b')).map(e=>e.textContent)).toEqual(['—','—','—','—']);
 expect(container.querySelectorAll('[role="alert"]')).toHaveLength(3);expect(container.textContent).not.toContain('Todavía no hay operaciones');
});
test('búsqueda local y detalle abren el id correcto',async()=>{
 await render();await act(async()=>Simulate.change(container.querySelector('input'),{target:{value:'API'}}));
 expect(container.querySelectorAll('tbody tr')).toHaveLength(1);expect(container.querySelector('.desk-detail h2').textContent).toBe('Desarrollo de API');
 await act(async()=>Simulate.click(container.querySelector('.desk-detail .api-primary')));expect(navigate).toHaveBeenCalledWith('operations','2');
 await act(async()=>Simulate.change(container.querySelector('input'),{target:{value:'ausente'}}));expect(container.textContent).toContain('Sin coincidencias en esta página');
});
test('lector no consulta operaciones ni ofrece acciones administrativas',async()=>{
 await render(false);expect(api.get.mock.calls.some(c=>c[0].includes('operaciones'))).toBe(false);
 expect(container.querySelector('.desk-metric').disabled).toBe(true);expect(container.querySelector('input')).toBeNull();
 expect(container.textContent).not.toContain('Gestionar operaciones');expect(container.textContent).not.toContain('Revisar contexto de empresa');
});
test('actualizar vacía temporalmente las cifras y obtiene datos de nuevo',async()=>{
 await render();let finish;api.get.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 await act(async()=>Simulate.click(container.querySelector('.desk-date-note button')));
 expect(container.querySelector('.desk-metric b').textContent).toBe('—');expect(api.get).toHaveBeenCalledTimes(8);
 await act(async()=>finish({subespacios:[]}));
});
test('las secciones pendientes no importan tareas ni conclusiones de ejemplo',async()=>{
 await act(async()=>root.render(<PendingSection section="tasks" admin={false} onNavigate={navigate}/>));
 expect(container.textContent).toContain('requisitos aplicables y revisados');expect(container.textContent).toContain('Integración pendiente');
 await act(async()=>Simulate.click(container.querySelector('button')));expect(navigate).toHaveBeenCalledWith('documents');
 await act(async()=>root.render(<PendingSection section="regulations" admin onNavigate={navigate}/>));
 expect(container.textContent).toContain('La ausencia de referencias no significa');expect(api.get).not.toHaveBeenCalled();
});
