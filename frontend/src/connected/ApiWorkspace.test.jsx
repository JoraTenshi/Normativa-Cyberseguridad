import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import ApiWorkspace from './ApiWorkspace';
import { createApi } from '../api-client';
import { useAuth } from '../context/AuthContext';
const mockNavigate = jest.fn();
jest.mock('react-router-dom',()=>({ useNavigate:()=>mockNavigate, Link:({children,to,...props})=><a href={to} {...props}>{children}</a> }));
jest.mock('../api-client',()=>({ createApi:jest.fn(), orgPath:id=>'/organizaciones/'+id, queryString:()=>'' }));
jest.mock('../context/AuthContext',()=>({useAuth:jest.fn()}));
jest.mock('./ContextOperations',()=>({ContextPage:()=>null,OperationsPage:({initialOperationId})=><input aria-label="Borrador de operación" defaultValue={initialOperationId || ''}/>}));
jest.mock('./Resources',()=>({SpacesPage:()=>null,DocumentsPage:()=>null,ActivityPage:()=>null}));
jest.mock('./CompanyProfile',()=>()=> <p>Perfil conectado</p>);
jest.mock('./NormativeWorkspace',()=>({__esModule:true,default:({base})=><p>Normativa conectada {base}</p>}));
jest.mock('./EnrollmentPortal',()=>({EnrollmentAccessLink:()=>null}));
let root,container,api;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
 mockNavigate.mockReset();
 api={get:jest.fn().mockResolvedValue({organizaciones:[],siguiente:null})};createApi.mockReturnValue(api);
 useAuth.mockReturnValue({user:{id:'a',nombre:'Ana'},phase:'authenticated',generation:1});
});
function fixture(path) {
 if(path.startsWith('/me/organizaciones')) return {organizaciones:[{id:'b',nombre:'Empresa autorizada',rol:'administrador'}]};
 if(path.includes('/operaciones')) return {operaciones:[{id:'op1',nombre:'Operación real',descripcion:'Descripción recibida',versionActual:2}],paginacion:{hayMas:false}};
 if(path.includes('/documentos')) return {documentos:[]};
 return {subespacios:[]};
}
async function enter() {
 api.get.mockImplementation(path=>Promise.resolve(fixture(path)));
 await act(async()=>root.render(<ApiWorkspace/>));
 await act(async()=>Simulate.change(container.querySelector('select'),{target:{value:'b'}}));
}
function button(text) { return Array.from(container.querySelectorAll('button')).find(b=>b.textContent===text); }
test('el detalle del dashboard abre la operación correcta, sin recrearla',async()=>{
 await enter();await act(async()=>Simulate.click(button('Abrir esta operación ')));
 expect(container.querySelector('[aria-label="Borrador de operación"]').value).toBe('op1');
});
test('bloqueo y reautenticación de la misma membresía conservan el editor',async()=>{
 await enter();await act(async()=>Simulate.click(button('Gestionar operaciones')));
 const editor=container.querySelector('input');editor.value='Borrador sin enviar';
 useAuth.mockReturnValue({user:{id:'a',nombre:'Ana'},phase:'locked',generation:2});
 await act(async()=>root.render(<ApiWorkspace/>));
 expect(container.querySelector('input')).toBe(editor);expect(editor.closest('[hidden]')).not.toBeNull();
 useAuth.mockReturnValue({user:{id:'a',nombre:'Ana'},phase:'authenticated',generation:3});
 await act(async()=>root.render(<ApiWorkspace/>));
 expect(container.querySelector('input')).toBe(editor);expect(editor.value).toBe('Borrador sin enviar');expect(editor.closest('[hidden]')).toBeNull();
});
test('membresía revocada no vuelve a mostrar el editor tras reautenticarse',async()=>{
 await enter();await act(async()=>Simulate.click(button('Gestionar operaciones')));
 api.get.mockResolvedValue({organizaciones:[],siguiente:null});
 useAuth.mockReturnValue({user:{id:'a',nombre:'Ana'},phase:'authenticated',generation:2});
 await act(async()=>root.render(<ApiWorkspace/>));
 expect(container.querySelector('[aria-label="Borrador de operación"]')).toBeNull();
 expect(container.textContent).toContain('No tienes organizaciones activas');
});
test('fallo al cerrar sesión no redirige ni desmonta el trabajo',async()=>{
 const logout=jest.fn().mockResolvedValue(false);
 useAuth.mockReturnValue({user:{id:'a',nombre:'Ana'},phase:'authenticated',generation:1,logout});
 await enter();await act(async()=>Simulate.click(button('Gestionar operaciones')));
 const editor=container.querySelector('input');editor.value='Conservar';
 await act(async()=>Simulate.click(button('Cerrar sesión')));
 expect(logout).toHaveBeenCalledTimes(1);expect(mockNavigate).not.toHaveBeenCalled();expect(container.querySelector('input')).toBe(editor);
 expect(container.textContent).toContain('No se ha confirmado el cierre');
});
test('cierre confirmado vuelve al acceso y cuenta navega a ajustes',async()=>{
 const logout=jest.fn().mockResolvedValue(true);
 useAuth.mockReturnValue({user:{id:'a',nombre:'Ana'},phase:'authenticated',generation:1,logout});
 await act(async()=>root.render(<ApiWorkspace/>));
 await act(async()=>Simulate.click(button('Mi cuenta')));expect(mockNavigate).toHaveBeenCalledWith('/settings');
 await act(async()=>Simulate.click(button('Cerrar sesión')));expect(mockNavigate).toHaveBeenCalledWith('/auth',{replace:true});
});
afterEach(()=>{act(()=>root.unmount());container.remove();delete global.IS_REACT_ACT_ENVIRONMENT;});
test('sin membresías no crea empresa ni inicia sesión demo',async()=>{
 await act(async()=>root.render(<ApiWorkspace/>));expect(container.textContent).toContain('No tienes organizaciones activas');
 expect(api.get.mock.calls.map(c=>c[0])).toEqual(['/me/organizaciones']);
 expect(container.querySelector('input')).toBeNull();
 await act(async()=>Simulate.click(button('Solicitar espacio o consultar mi alta')));
 expect(mockNavigate).toHaveBeenCalledWith('/solicitudes-de-alta');
});
test('lista exclusivamente empresas que devuelve el servidor',async()=>{
 api.get.mockResolvedValue({organizaciones:[{id:'b',nombre:'Empresa autorizada',rol:'consulta'}],siguiente:null});
 await act(async()=>root.render(<ApiWorkspace/>));expect(container.querySelectorAll('option')).toHaveLength(2);
 expect(container.textContent).toContain('Empresa autorizada');expect(container.textContent).not.toContain('Cuenta ficticia');
});
test('fallo de red no produce datos de ejemplo',async()=>{
 api.get.mockRejectedValue(new Error('sin red'));await act(async()=>root.render(<ApiWorkspace/>));
 expect(container.querySelector('[role="alert"]')).not.toBeNull();expect(container.querySelectorAll('option')).toHaveLength(1);
});
test('colaborador no ve controles administrativos habilitados',async()=>{
 api.get.mockImplementation(path=>Promise.resolve(path==='/me/organizaciones'?{organizaciones:[{id:'b',nombre:'Empresa autorizada',rol:'consulta'}]}:{documentos:[]}));
 await act(async()=>root.render(<ApiWorkspace/>));await act(async()=>Simulate.change(container.querySelector('select'),{target:{value:'b'}}));
 const buttons=Array.from(container.querySelectorAll('button'));
 expect(buttons.find(b=>b.textContent==='Contexto de empresa').disabled).toBe(true);
 expect(buttons.find(b=>b.textContent==='Perfil y alcance').disabled).toBe(true);
 expect(buttons.find(b=>b.textContent==='Operaciones y cuestiones').disabled).toBe(true);
 expect(buttons.find(b=>b.textContent==='Normativa del alcance').disabled).toBe(true);
});
test('administrador accede a normativa y actuaciones con la base de su organización',async()=>{
 await enter();await act(async()=>Simulate.click(button('Normativa del alcance')));
 expect(container.textContent).toContain('Normativa conectada /organizaciones/b');
 expect(button('Normativa del alcance').disabled).toBe(false);
 expect(container.textContent).toContain('Tareas y responsables');
 expect(container.querySelector('[aria-label="Integración pendiente"]')).toBeNull();
 await act(async()=>Simulate.click(button('Tareas y responsables')));
 expect(container.textContent).toContain('Normativa conectada /organizaciones/b');
});
test('administrador accede al perfil guiado sin sustituir el contexto avanzado',async()=>{
 await enter();await act(async()=>Simulate.click(button('Perfil y alcance')));
 expect(container.textContent).toContain('Perfil conectado');
 expect(button('Contexto de empresa')).toBeDefined();
});


