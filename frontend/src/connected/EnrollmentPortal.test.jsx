import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';
import EnrollmentPortal, {EnrollmentAccessLink} from './EnrollmentPortal';
import {EnrollmentDecision, EnrollmentStatus} from './EnrollmentViews';
import {createApi, ApiError} from '../api-client';
import {useAuth} from '../context/AuthContext';
import {requestView} from './enrollment-model';
const mockNavigate=jest.fn();
jest.mock('react-router-dom',()=>({useNavigate:()=>mockNavigate}));
jest.mock('../api-client',()=>({...jest.requireActual('../api-client'),createApi:jest.fn()}));
jest.mock('../context/AuthContext',()=>({useAuth:jest.fn()}));
jest.mock('./draft-state',()=>({markDraft:jest.fn(),confirmLeave:()=>true}));
const id='a'.repeat(24), own='/me/solicitudes-organizacion', platform='/plataforma/solicitudes-organizacion', capPath='/me/altas-capacidades';
const datos={razonSocial:'Empresa QA',pais:'ES',nif:'B00000001',funcionProfesional:'Responsable técnico',justificacion:'Solicito administrar la empresa QA.'};
const request=(changes={})=>({id,version:1,estado:'pendiente_revision',datos:{...datos},creadaEn:'2026-10-14T12:00:00Z',actualizadaEn:'2026-10-14T12:00:00Z',organizacion:null,historial:[],solicitante:{id:'b'.repeat(24),nombre:'Solicitante QA',email:'qa@example.invalid',emailVerificado:true},puedeDecidir:true,...changes});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
let root,container,api,caps,rows,detail,auth,uuid;
beforeEach(()=>{
 global.IS_REACT_ACT_ENVIRONMENT=true;uuid=0;Object.defineProperty(global,'crypto',{configurable:true,value:{randomUUID:()=>`enrollment-key-${++uuid}`}});
 container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);mockNavigate.mockReset();
 auth={user:{id:'c'.repeat(24),nombre:'QA'},phase:'authenticated',generation:1,machine:{lock:jest.fn()}};useAuth.mockImplementation(()=>auth);
 caps={gestionarAltas:true,requiereMfa:false,requiereAutenticacionReciente:false};rows=[request()];detail=request();
 api={get:jest.fn(path=>Promise.resolve(path===capPath?caps:path.endsWith('/'+id)?{solicitud:detail}:{solicitudes:rows,siguiente:null})),write:jest.fn().mockImplementation(()=>Promise.resolve({solicitud:detail}))};createApi.mockReturnValue(api);
});
afterEach(()=>{act(()=>root.unmount());container.remove();jest.restoreAllMocks();delete global.IS_REACT_ACT_ENVIRONMENT;});
const button=text=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent===text);
const click=text=>act(async()=>{const target=button(text);if(!target) throw Error('Missing button '+text);Simulate.click(target);});
const render=(admin=false)=>act(async()=>root.render(<EnrollmentPortal admin={admin}/>));
const change=(element,value)=>act(async()=>Simulate.change(element,{target:{value,checked:value}}));
const open=async(admin=false)=>{await render(admin);await click('Consultar solicitud');};
const prepareDecision=async(decision='aprobar')=>{
 const form=container.querySelector('form[aria-label="Decisión sobre la solicitud"]');
 await change(form.querySelector('select'),decision);
 await change(form.querySelector('textarea'),'Datos y representación revisados para esta solicitud.');
 await change(form.querySelector('input[type=checkbox]'),true);
 return form;
};
const submit=()=>act(async()=>Simulate.submit(container.querySelector('form')));
test('administrator list is never queried while authority is unresolved',async()=>{
 const pending=deferred();api.get.mockReturnValue(pending.promise);await render(true);
 expect(api.get.mock.calls.map(c=>c[0])).toEqual([capPath]);expect(container.querySelector('main').hidden).toBe(true);
 await act(async()=>pending.resolve({...caps,gestionarAltas:false}));
 expect(container.textContent).toContain('No tienes permiso');expect(api.get).toHaveBeenCalledTimes(1);
});
test('MFA instruction does not query administrative rows even if capability is false',async()=>{
 caps={...caps,gestionarAltas:false,requiereMfa:true};await render(true);
 expect(container.textContent).toContain('segundo factor de NormativaCheck');expect(api.get).toHaveBeenCalledTimes(1);
});
test('malformed capabilities fail closed and cannot expose administrative rows',async()=>{
 caps={gestionarAltas:'true'};await render(true);expect(api.get).toHaveBeenCalledTimes(1);expect(container.querySelector('main').hidden).toBe(true);
 expect(container.textContent).toContain('No se ha podido confirmar');
});
test('entry uses capabilities, not company administrator role',async()=>{
 caps.gestionarAltas=false;auth.user.rol='administrador';await act(async()=>root.render(<EnrollmentAccessLink/>));expect(button('Revisar altas')).toBeUndefined();
 caps={...caps,gestionarAltas:true};auth={...auth,generation:2};await act(async()=>root.render(<EnrollmentAccessLink/>));await click('Revisar altas');expect(mockNavigate).toHaveBeenCalledWith('/administracion/altas');
});
test('pending request has no access button, and applicant history suppresses internal notes',async()=>{
 detail.historial=[{version:1,accion:'creada',fecha:'2026-10-14',actorTipo:'solicitante',motivoPublico:'Texto público',notaInterna:'SECRETO INTERNO',datos}];
 await open();expect(container.textContent).toContain('todavía no tienes acceso');expect(container.textContent).not.toContain('SECRETO INTERNO');
 expect(button('Comprobar mi acceso')).toBeUndefined();expect(api.write).not.toHaveBeenCalled();
});
test('approved state only redirects to membership recheck, never grants local access',async()=>{
 detail=request({estado:'aprobada',puedeDecidir:false,organizacion:null});await open();await click('Comprobar mi acceso');
 expect(mockNavigate).toHaveBeenCalledWith('/espacio-de-trabajo');expect(api.write).not.toHaveBeenCalled();
 expect(container.querySelector('form')).toBeNull();
});
test('rejected own request is terminal, correction explicitly opens a versioned editor',async()=>{
 detail=request({estado:'rechazada'});await open();expect(container.querySelector('form')).toBeNull();expect(button('Revisar los datos de mi solicitud')).toBeUndefined();
 detail=request({estado:'aclaracion_requerida',version:2});await click('Actualizar estado');await click('Revisar los datos de mi solicitud');
 const form=container.querySelector('form');expect(form.querySelector('input').value).toBe(datos.razonSocial);expect(api.write).not.toHaveBeenCalled();
 await change(form.querySelector('input[type=checkbox]'),true);await submit();
 expect(api.write.mock.calls[0][0].method).toBe('PUT');expect(JSON.parse(api.write.mock.calls[0][0].body)).toEqual({version:2,datos});
});
test('new applicant request requires explicit confirmation and sends only five allowed fields',async()=>{
 caps.gestionarAltas=false;rows=[];await render();await click('Solicitar espacio de empresa');
 const form=container.querySelector('form'),inputs=form.querySelectorAll('input:not([type=checkbox])');
 await change(inputs[0],datos.razonSocial);await change(inputs[1],datos.nif);await change(inputs[2],datos.funcionProfesional);await change(form.querySelector('textarea'),datos.justificacion);
 await submit();expect(api.write).not.toHaveBeenCalled();await change(form.querySelector('input[type=checkbox]'),true);await submit();
 const job=api.write.mock.calls[0][0];expect(job.method).toBe('POST');expect(job.path).toBe(own);expect(JSON.parse(job.body)).toEqual(datos);expect(job.key).toMatch(/^enrollment-key/);
});
test('decision needs reason and confirmation and sends version, public reason and internal note',async()=>{
 await open(true);expect(container.textContent).toContain(datos.justificacion);await submit();expect(api.write).not.toHaveBeenCalled();
 const form=await prepareDecision();await change(form.querySelectorAll('textarea')[1],'Nota para administración');expect(form.querySelector('input').checked).toBe(false);
 await change(form.querySelector('input'),true);await submit();const job=api.write.mock.calls[0][0];
 expect(job.path).toBe(platform+'/'+id+'/decision');expect(JSON.parse(job.body)).toEqual({version:1,decision:'aprobar',motivoPublico:'Datos y representación revisados para esta solicitud.',notaInterna:'Nota para administración'});
});
test('server denial, self decision or terminal request never gets a decision form',async()=>{
 detail=request({puedeDecidir:false});await open(true);expect(container.querySelector('form').closest('[hidden]')).not.toBeNull();expect(container.querySelector('fieldset').disabled).toBe(true);expect(api.write).not.toHaveBeenCalled();
});
test('email unverified cannot be approved even if stale capability says yes',async()=>{
 detail=request({solicitante:{nombre:'QA',email:'qa@example.invalid',emailVerificado:false}});await open(true);
 expect(container.querySelector('option[value=aprobar]').disabled).toBe(true);
 await prepareDecision();await submit();expect(api.write).not.toHaveBeenCalled();
});
test('clarification state only permits rejection, not another clarification or approval',async()=>{
 detail=request({estado:'aclaracion_requerida'});await open(true);
 expect(container.querySelector('option[value=aprobar]').disabled).toBe(true);expect(container.querySelector('option[value=pedir_aclaracion]').disabled).toBe(true);
 await prepareDecision('rechazar');await submit();expect(JSON.parse(api.write.mock.calls[0][0].body).decision).toBe('rechazar');
});
test('recent-auth requirement permits reading but blocks every decision',async()=>{
 caps.requiereAutenticacionReciente=true;await open(true);expect(container.textContent).toContain(datos.razonSocial);expect(container.querySelector('fieldset').disabled).toBe(true);
 await prepareDecision();await submit();expect(api.write).not.toHaveBeenCalled();await click('Volver a identificarme');expect(auth.machine.lock).toHaveBeenCalledTimes(1);
});
test('double submit while in flight sends one decision',async()=>{
 const pending=deferred();api.write.mockReturnValue(pending.promise);await open(true);await prepareDecision();
 await act(async()=>{Simulate.submit(container.querySelector('form'));Simulate.submit(container.querySelector('form'));});expect(api.write).toHaveBeenCalledTimes(1);
 await act(async()=>pending.resolve({solicitud:request({estado:'aprobada',version:2,puedeDecidir:false})}));
});
test('unknown result locks editing and retries exact immutable request and key',async()=>{
 api.write.mockRejectedValueOnce(new ApiError('Servicio temporal',503,'ALTAS_NO_DISPONIBLES'));await open(true);await prepareDecision();await submit();
 const job=api.write.mock.calls[0][0];expect(container.querySelector('fieldset').disabled).toBe(true);
 expect(container.querySelector('textarea').value).toContain('representación revisados');await click('Reintentar exactamente el mismo envío');expect(api.write.mock.calls[1][0]).toBe(job);
});
test('invalid successful response is still uncertain and preserves the exact retry job',async()=>{
 api.write.mockResolvedValueOnce({solicitud:{estado:'aprobada'}});await open(true);await prepareDecision();await submit();
 const job=api.write.mock.calls[0][0];expect(container.querySelector('fieldset').disabled).toBe(true);
 expect(container.textContent).toContain('estado de alta válido');await click('Reintentar exactamente el mismo envío');
 expect(api.write.mock.calls[1][0]).toBe(job);
});
test('409 preserves reason and requires compare, explicit base acceptance and fresh confirmation',async()=>{
 api.write.mockRejectedValueOnce(new ApiError('Otra versión',409,'VERSION_DESACTUALIZADA'));await open(true);await prepareDecision();await submit();
 expect(container.querySelector('textarea').value).toContain('Datos y representación');expect(container.querySelector('fieldset').disabled).toBe(true);
 detail=request({version:2,datos:{...datos,justificacion:'Nueva justificación de representación'}});await click('Consultar la versión actual');
 expect(container.textContent).toContain(detail.datos.justificacion);expect(api.write).toHaveBeenCalledTimes(1);
 await click('He comparado los datos; preparar otro envío');expect(container.querySelector('input[type=checkbox]').checked).toBe(false);
 await submit();expect(api.write).toHaveBeenCalledTimes(1);await change(container.querySelector('input[type=checkbox]'),true);await submit();
 expect(JSON.parse(api.write.mock.calls[1][0].body).version).toBe(2);expect(api.write.mock.calls[1][0].key).not.toBe(api.write.mock.calls[0][0].key);
});
test('same-account reauthentication preserves draft and never reveals it before authority recheck',async()=>{
 await open(true);await prepareDecision();const textarea=container.querySelector('textarea');
 auth={...auth,phase:'locked',generation:2};await render(true);expect(textarea.closest('[hidden]')).not.toBeNull();
 const pending=deferred(),oldGet=api.get.getMockImplementation();api.get.mockImplementation(p=>p===capPath?pending.promise:oldGet(p));
 auth={...auth,phase:'authenticated',generation:3};await render(true);expect(textarea.closest('[hidden]')).not.toBeNull();
 await act(async()=>pending.resolve(caps));expect(container.querySelector('textarea')).toBe(textarea);expect(textarea.closest('[hidden]')).toBeNull();expect(textarea.value).toContain('representación revisados');
});
test('different account clears former draft and ignores a late response',async()=>{
 await open(true);await prepareDecision();const pending=deferred();api.get.mockReturnValue(pending.promise);
 auth={...auth,user:{id:'d'.repeat(24),nombre:'Otra'},generation:2};await render(true);
 expect(container.querySelector('textarea')).toBeNull();expect(container.textContent).not.toContain('Datos y representación revisados');
 await act(async()=>pending.resolve({...caps,gestionarAltas:false}));expect(container.textContent).toContain('No tienes permiso');expect(api.write).not.toHaveBeenCalled();
});
test('API recent-auth denial preserves draft, rechecks capability and requires a real login',async()=>{
 api.write.mockRejectedValueOnce(new ApiError('Autenticación reciente',403,'REAUTENTICACION_REQUERIDA'));await open(true);await prepareDecision();await submit();
 expect(container.querySelector('textarea').value).toContain('representación revisados');await click('Confirmar mi identidad');expect(auth.machine.lock).toHaveBeenCalledTimes(1);
 caps={...caps,requiereAutenticacionReciente:true};await click('Ya me he identificado; comprobar permisos');expect(container.querySelector('fieldset').disabled).toBe(true);expect(api.write).toHaveBeenCalledTimes(1);
});
test('401 draft survives relogin and has an explicit recovery path instead of a permanently blocked form',async()=>{
 api.write.mockRejectedValueOnce(new ApiError('Sesión caducada',401,'SESION_CADUCADA'));await open(true);await prepareDecision();await submit();
 auth={...auth,phase:'locked',generation:2};await render(true);expect(container.querySelector('textarea').closest('[hidden]')).not.toBeNull();
 auth={...auth,phase:'authenticated',generation:3};await render(true);expect(container.querySelector('textarea').value).toContain('Datos y representación');
 expect(container.querySelector('fieldset').disabled).toBe(true);await click('Ya he recuperado mi sesión; preparar nuevo envío');
 expect(container.querySelector('fieldset').disabled).toBe(false);expect(api.write).toHaveBeenCalledTimes(1);
});
test('unknown status never offers creation or entry even if passed optimistic flags',async()=>{
 await act(async()=>root.render(<EnrollmentStatus state="unknown" canRequest canCheckMemberships/>));expect(container.querySelector('button')).toBeNull();
});
test('version change invalidates consent while retaining decision and reason',async()=>{
 const onDecide=jest.fn();await act(async()=>root.render(<EnrollmentDecision request={requestView(request())} authorityConfirmed canDecide onDecide={onDecide}/>));await prepareDecision();
 await act(async()=>root.render(<EnrollmentDecision request={requestView(request({version:2}))} authorityConfirmed canDecide onDecide={onDecide}/>));
 expect(container.querySelector('input').checked).toBe(false);expect(container.querySelector('textarea').value).toContain('Datos y representación');await submit();expect(onDecide).not.toHaveBeenCalled();
});
