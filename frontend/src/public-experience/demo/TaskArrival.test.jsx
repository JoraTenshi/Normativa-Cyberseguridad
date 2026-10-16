import React from 'react';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import Workspace from './Workspace';
import Demo from '../Demo';
import {createWorkspace,rowsFor} from './workspace-model';

const originalClone=global.structuredClone;
beforeAll(()=>{if(!global.structuredClone)global.structuredClone=value=>require('v8').deserialize(require('v8').serialize(value));});
afterAll(()=>{if(originalClone)global.structuredClone=originalClone;else delete global.structuredClone;});
beforeEach(()=>{localStorage.clear();window.matchMedia=()=>({matches:false});Element.prototype.scrollIntoView=jest.fn();window.scrollTo=jest.fn();});
test('linked hidden task opens without clearing search and Back restores previous selection',async()=>{
  const rows=rowsFor(createWorkspace(),'saas'),target=rows.find(row=>row.id==='encargo'),origin=rows.find(row=>row.id==='proveedor');
  const view=render(<Workspace initialSection="tasks" initialTask="proveedor"/>);
  fireEvent.change(screen.getByRole('searchbox',{name:'Buscar tareas'}),{target:{value:origin.title}});
  const writes=jest.spyOn(Storage.prototype,'setItem');writes.mockClear();
  view.rerender(<Workspace initialSection="tasks" initialTask="proveedor" taskJump={{id:'encargo',scope:'saas',nonce:1}}/>);
  await waitFor(()=>expect(document.activeElement.getAttribute('data-task-id')).toBe('encargo'));
  expect(screen.getByRole('heading',{name:target.title})).toBeInTheDocument();expect(screen.getByRole('searchbox',{name:'Buscar tareas'})).toHaveValue(origin.title);
  expect(screen.getByText('Detalle abierto desde un enlace. Los filtros de la lista se mantienen.')).toBeInTheDocument();expect(writes).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'← Volver a la vista anterior'}));expect(screen.getByRole('heading',{name:origin.title})).toBeInTheDocument();expect(screen.getByRole('searchbox',{name:'Buscar tareas'})).toHaveValue(origin.title);writes.mockRestore();
});
test('unknown target is explained without replacing current task',async()=>{
  const view=render(<Workspace initialSection="tasks" initialTask="proveedor"/>);const previous=screen.getByRole('complementary',{name:'Detalle de la tarea seleccionada'}).textContent;
  view.rerender(<Workspace initialSection="tasks" initialTask="proveedor" taskJump={{id:'missing-task',scope:'saas',nonce:1}}/>);
  expect(await screen.findByText(/No se ha encontrado la tarea solicitada/)).toBeInTheDocument();expect(screen.getByRole('complementary',{name:'Detalle de la tarea seleccionada'}).textContent).toBe(previous);
});
test('demo jump does not replace hash route with anchor and highlights exact entry',async()=>{
  window.history.replaceState(null,'','#/demo/tarea');render(<Demo/>);
  fireEvent.click(screen.getByRole('link',{name:'Ir al detalle de la tarea ↓'}));
  await waitFor(()=>expect(document.activeElement.getAttribute('data-task-id')).toBe('encargo'));expect(window.location.hash).toBe('#/demo/tarea');
});
test('changing demo example clears the previous task destination',async()=>{
  window.history.replaceState(null,'','#/demo/tarea');render(<Demo/>);
  fireEvent.click(screen.getByRole('link',{name:'Ir al detalle de la tarea ↓'}));
  await waitFor(()=>expect(document.activeElement.getAttribute('data-task-id')).toBe('encargo'));
  act(()=>{window.history.replaceState(null,'','#/demo/medidas');window.dispatchEvent(new Event('hashchange'));});
  expect(screen.getByRole('complementary',{name:'Detalle de la tarea seleccionada'}).querySelector('[data-task-id]')).toHaveAttribute('data-task-id','permisos');
});
