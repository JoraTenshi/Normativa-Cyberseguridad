import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {Simulate} from 'react-dom/test-utils';
import Auth from '../pages/Auth';
import {ProductHeader} from './ProductFrame';
import {useAuth} from '../context/AuthContext';
import {register} from '../services/api';
jest.mock('../context/AuthContext',()=>({useAuth:jest.fn()}));
jest.mock('../services/api',()=>({register:jest.fn(),loginApi:jest.fn(),verify2fa:jest.fn(),resendVerification:jest.fn()}));
let root,container;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);useAuth.mockReturnValue({user:null,phase:'anonymous',login:jest.fn()});});
afterEach(()=>{act(()=>root.unmount());container.remove();delete global.IS_REACT_ACT_ENVIRONMENT;});
test('registration CTA opens the real registration form; a failed save never enters the demo',async()=>{
 await act(async()=>root.render(<MemoryRouter initialEntries={['/auth?modo=registro']}><Auth/></MemoryRouter>));
 expect(container.querySelector('[name="nombre"]')).not.toBeNull();
 register.mockRejectedValue(new Error('No se ha guardado'));
 for(const [name,value] of [['nombre','Prueba'],['email','test@example.invalid'],['password','TestPass123!']]) await act(async()=>Simulate.change(container.querySelector(`[name="${name}"]`),{target:{name,value}}));
 await act(async()=>Simulate.submit(container.querySelector('form')));
 expect(register).toHaveBeenCalledWith('Prueba','test@example.invalid','TestPass123!');expect(container.textContent).toContain('No se ha guardado');expect(container.querySelector('[name="nombre"]').value).toBe('Prueba');expect(container.textContent).not.toContain('Linde');
});
test('account navigation retains historical evaluations and links to the real workspace',async()=>{
 useAuth.mockReturnValue({user:{nombre:'Ana'},logout:jest.fn()});await act(async()=>root.render(<MemoryRouter><ProductHeader/></MemoryRouter>));
 expect(container.querySelector('a[href="/espacio-de-trabajo"]')).not.toBeNull();expect(container.querySelector('a[href="/historial"]')).not.toBeNull();expect(container.textContent).toContain('NormativaCheck');expect(container.textContent).not.toContain('Cyber');
});
