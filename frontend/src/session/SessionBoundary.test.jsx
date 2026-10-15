import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { sessionTransport } from './transport';
import SessionBoundary from './SessionBoundary';
jest.mock('./transport',()=>({sessionTransport:jest.fn()}));
jest.mock('../pages/Auth',()=>function Auth(){return <span>Identificación</span>;});
let root,container,machine;
const response=id=>({usuario:{id,email:id+'@example.invalid'},restanteMs:1800000,expiraEn:'2026-10-12T00:00:00Z'});
function Probe(){machine=useAuth().machine;return null;}
function Draft(){const [value,setValue]=useState('');return <input aria-label="Borrador" value={value} onChange={e=>setValue(e.target.value)}/>;}
beforeEach(()=>{
 global.IS_REACT_ACT_ENVIRONMENT=true;
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 HTMLDialogElement.prototype.close=function(){this.open=false;};
 sessionTransport.mockReset().mockResolvedValue(response('a'));
 container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
});
afterEach(()=>{act(()=>root.unmount());container.remove();delete global.IS_REACT_ACT_ENVIRONMENT;});
async function prepare(){
 await act(async()=>root.render(<AuthProvider><Probe/><SessionBoundary><Draft/></SessionBoundary></AuthProvider>));
 act(()=>Simulate.change(container.querySelector('input'),{target:{value:'Texto pendiente'}}));
}
test('bloqueo oculta el formulario sin desmontarlo; misma cuenta recupera el borrador',async()=>{
 await prepare();const input=container.querySelector('input');
 act(()=>machine.lock());expect(input.closest('[hidden]')).not.toBeNull();expect(container.querySelector('dialog').open).toBe(true);
 await act(async()=>machine.signedIn());expect(container.querySelector('input')).toBe(input);
 expect(input.value).toBe('Texto pendiente');expect(input.closest('[hidden]')).toBeNull();expect(container.querySelector('dialog')).toBeNull();
});
test('otra cuenta descarta el formulario anterior en lugar de entregarle su borrador',async()=>{
 await prepare();const input=container.querySelector('input');act(()=>machine.lock());sessionTransport.mockResolvedValue(response('b'));
 await act(async()=>machine.signedIn());expect(container.querySelector('input')).not.toBe(input);expect(container.querySelector('input').value).toBe('');
});
test('fallo de logout deja el borrador oculto y permite recuperar con la misma cuenta',async()=>{
 await prepare();sessionTransport.mockRejectedValueOnce({status:503});await act(async()=>machine.logout());
 expect(container.querySelector('input').value).toBe('Texto pendiente');expect(container.textContent).toContain('no ha confirmado el cierre');
 await act(async()=>machine.sync());expect(container.querySelector('input').value).toBe('Texto pendiente');
});
test('no restituye una identidad almacenada localmente mientras comprueba sesión',async()=>{
 localStorage.setItem('cyberaudit_user','{"id":"inventada"}');sessionTransport.mockRejectedValue({status:401});
 await act(async()=>root.render(<AuthProvider><Probe/></AuthProvider>));
 expect(machine.getSnapshot().user).toBeNull();expect(localStorage.getItem('cyberaudit_user')).toBeNull();
});
