import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import NormativeWorkspace from './NormativeWorkspace';
import {SaveForm} from './NormativeControls';

const id='a'.repeat(24),base='/organizaciones/'+'b'.repeat(24);
const record={id,version:1,versionActual:1,referencia:{id,version:1,sha256:'c'.repeat(64)},revision:{registradoEn:'2026-10-16T10:00:00Z'},permisos:{actualizar:false},contenido:{titulo:'Revisar contrato objetivo',descripcion:'Solo lectura',estado:'en_curso',responsableMembresiaId:'miembro',relaciones:[]}};
function apiFor(detail=()=>Promise.resolve(record)){return {write:jest.fn(),get:jest.fn(path=>path.endsWith('/catalogo')?Promise.resolve({paquetes:[]}):path===base+'/normativa/actuaciones/'+id?detail():Promise.resolve(path.includes('responsables')?{responsables:[]}:{registros:[record],versiones:[],paginacion:{hayMas:false}}))};}
beforeEach(()=>{window.matchMedia=()=>({matches:false});Element.prototype.scrollIntoView=jest.fn();});
test('opens exact ID after fetch, retains list filters on back and never writes',async()=>{
  const api=apiFor();render(<NormativeWorkspace api={api} base={base} initialKind="actuaciones" workOnly/>);
  fireEvent.change(await screen.findByRole('searchbox',{name:'Buscar tarea'}),{target:{value:'objetivo'}});
  fireEvent.click(screen.getByRole('button',{name:record.contenido.titulo}));
  await screen.findByRole('heading',{name:record.contenido.titulo});await waitFor(()=>expect(document.activeElement.getAttribute('data-task-id')).toBe(id));
  expect(api.get).toHaveBeenCalledWith(base+'/normativa/actuaciones/'+id);expect(api.write).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'← Volver a actuaciones'}));expect(await screen.findByRole('searchbox',{name:'Buscar tarea'})).toHaveValue('objetivo');
});
test('initial detail is resolved directly without requiring presence in list',async()=>{
  const api=apiFor();render(<NormativeWorkspace api={api} base={base} initialKind="actuaciones" initialId={id} workOnly/>);await screen.findByRole('heading',{name:record.contenido.titulo});expect(api.get).toHaveBeenCalledWith(base+'/normativa/actuaciones/'+id);expect(api.write).not.toHaveBeenCalled();
});
test.each([403,404])('unavailable target %s never highlights a different task',async status=>{
  const api=apiFor(()=>Promise.reject({status,message:'Destino no accesible'}));const view=render(<NormativeWorkspace api={api} base={base} initialKind="actuaciones" initialId={id} workOnly/>);
  await screen.findByText(/No se ha podido abrir el destino solicitado/);expect(view.container.querySelector('[data-task-arrival="true"]')).toBeNull();expect(screen.queryByText(record.contenido.titulo)).toBeNull();expect(api.write).not.toHaveBeenCalled();
});
test('existing dirty-draft guard prevents task navigation without writes',async()=>{
  const api=apiFor(),confirm=jest.spyOn(window,'confirm').mockReturnValue(false);
  render(<><SaveForm api={api} path="/unused" title="Borrador" body={()=>({})}><input aria-label="Dato pendiente"/></SaveForm><NormativeWorkspace api={api} base={base} initialKind="actuaciones" workOnly/></>);
  fireEvent.change(screen.getByLabelText('Dato pendiente'),{target:{value:'Conservar'}});fireEvent.click(await screen.findByRole('button',{name:record.contenido.titulo}));
  expect(confirm).toHaveBeenCalled();expect(screen.getByLabelText('Dato pendiente')).toHaveValue('Conservar');expect(api.get).not.toHaveBeenCalledWith(base+'/normativa/actuaciones/'+id);expect(api.write).not.toHaveBeenCalled();confirm.mockRestore();
});
