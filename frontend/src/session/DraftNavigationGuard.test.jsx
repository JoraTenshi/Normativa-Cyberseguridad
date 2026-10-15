import 'whatwg-fetch';
import React, { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { createMemoryRouter, RouterProvider, Link, Outlet } from 'react-router-dom';
import DraftNavigationGuard from './DraftNavigationGuard';
import { markDraft } from '../connected/draft-state';
let root,container,router;
function Editor(){const [value,setValue]=useState('');useEffect(()=>{markDraft('nav-test',!!value);return()=>markDraft('nav-test',false);},[value]);return <><input aria-label="Borrador" value={value} onChange={e=>setValue(e.target.value)}/><Link to="/inicio">Salir</Link></>;}
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;HTMLDialogElement.prototype.showModal=function(){this.open=true;};container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
 router=createMemoryRouter([{element:<><DraftNavigationGuard/><Outlet/></>,children:[{path:'/inicio',element:<p>Inicio</p>},{path:'/editor',element:<Editor/>}]}],{initialEntries:['/inicio','/editor'],initialIndex:1,future:{v7_relativeSplatPath:true}});
});
afterEach(()=>{act(()=>root.unmount());router.dispose();container.remove();markDraft('nav-test',false);delete global.IS_REACT_ACT_ENVIRONMENT;});
async function prepare(dirty=true){await act(async()=>root.render(<RouterProvider router={router} future={{v7_startTransition:true}}/>));if(dirty)act(()=>Simulate.change(container.querySelector('input'),{target:{value:'Trabajo pendiente'}}));}
test('Atrás dentro de la app queda bloqueado y cancelar conserva el formulario',async()=>{
 await prepare();await act(async()=>router.navigate(-1));expect(router.state.location.pathname).toBe('/editor');expect(container.querySelector('dialog').open).toBe(true);
 act(()=>Simulate.click(Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='Seguir editando')));
 expect(container.querySelector('input').value).toBe('Trabajo pendiente');expect(container.querySelector('dialog')).toBeNull();
});
test('un enlace solo descarta tras confirmación explícita',async()=>{
 await prepare();await act(async()=>Simulate.click(container.querySelector('a'),{button:0}));
 expect(router.state.location.pathname).toBe('/editor');
 await act(async()=>Simulate.click(Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='Descartar y salir')));
 expect(router.state.location.pathname).toBe('/inicio');expect(container.querySelector('input')).toBeNull();
});
test('sin borrador no bloquea la navegación',async()=>{
 await prepare(false);await act(async()=>router.navigate(-1));expect(router.state.location.pathname).toBe('/inicio');expect(container.querySelector('dialog')).toBeNull();
});
