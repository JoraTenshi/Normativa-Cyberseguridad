import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';
import ActionList,{actionRows} from './ActionList';
import {SaveForm} from './NormativeControls';
import {hasDrafts} from './draft-state';
import {ApiError} from '../api-client';
const records=[{id:'a',version:2,revision:{registradoEn:'2026-10-15T10:00:00Z'},contenido:{titulo:'Revisar el encargo',estado:'en_curso',responsableMembresiaId:'member-1'}},{id:'b',version:3,revision:{registradoEn:'2026-10-15T10:00:00Z'},contenido:{titulo:'Trabajo archivado',estado:'archivada',responsableMembresiaId:'member-2'}}];
let root,container;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();delete global.IS_REACT_ACT_ENVIRONMENT;});
test('adapter resolves membership names, excludes archive and invents no dates',()=>{
 expect(actionRows(records,[{membresiaId:'member-1',nombre:'Ana',usuarioId:'not-a-membership'}])).toEqual([{id:'a',title:'Revisar el encargo',status:'en_curso',owner:'Ana'}]);
});
test('real action list has no date editing, names from directory and explicit pagination',async()=>{
 const onOpen=jest.fn(),api={get:jest.fn(path=>Promise.resolve(path.includes('responsables')?{responsables:[{membresiaId:'member-1',nombre:'Ana'}]}:{registros:records,paginacion:{hayMas:true,siguienteAntes:'cursor-2'}}))};
 await act(async()=>root.render(<ActionList api={api} base="/organizaciones/a" onOpen={onOpen}/>));
 expect(container.textContent).toContain('Ana');expect(container.textContent).not.toContain('Fecha prevista');expect(container.textContent).toContain('solo a esta página');
 await act(async()=>Simulate.click([...container.querySelectorAll('button')].find(b=>b.textContent==='Revisar el encargo')));expect(onOpen).toHaveBeenCalledWith('a');
 await act(async()=>Simulate.click([...container.querySelectorAll('button')].find(b=>b.textContent==='Archivadas')));expect(container.textContent).toContain('Trabajo archivado');
 await act(async()=>Simulate.click([...container.querySelectorAll('button')].find(b=>b.textContent==='Actuaciones anteriores')));expect(api.get.mock.calls.at(-1)[0]).toContain('antes=cursor-2');
});
test('failed query exposes no fictitious rows or successful empty state',async()=>{
 await act(async()=>root.render(<ActionList api={{get:()=>Promise.reject(new Error('sin conexión'))}} base="/organizaciones/a"/>));
 expect(container.querySelector('table')).toBeNull();expect(container.textContent).not.toContain('No hay actuaciones activas');expect(container.textContent).toContain('sin conexión');
});
test('an untouched form can be left; an edited draft is protected',async()=>{
 const api={write:jest.fn()};await act(async()=>root.render(<SaveForm api={api} path="/test" title="Prueba" onSaved={()=>{}} body={()=>({})}><input aria-label="Nombre"/></SaveForm>));
 expect(hasDrafts()).toBe(false);await act(async()=>Simulate.change(container.querySelector('input'),{target:{value:'Borrador'}}));expect(hasDrafts()).toBe(true);expect(api.write).not.toHaveBeenCalled();
});
test('validation error is not presented as a connection failure',()=>{expect(new ApiError('Dato inválido',400).code).toBe('DATOS_INVALIDOS');expect(new ApiError('Sin conexión').code).toBe('RED_NO_DISPONIBLE');});
