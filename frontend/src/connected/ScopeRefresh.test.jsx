import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';
import ScopeRefresh, {scopeRefreshPlan,scopeRefreshBody} from './ScopeRefresh';

const org='a'.repeat(24), id='b'.repeat(24), op='c'.repeat(24), base='/organizaciones/'+org, path=base+'/alcances/'+id;
const definition={nombre:'Portal',actividadIds:['act1'],subespacios:[{id:'d'.repeat(24),version:0}],sistemas:['Portal'],informacion:['Solicitudes'],limites:'Solo portal municipal',exclusiones:[{elemento:'ERP',motivo:'Otro servicio'}],dependencias:['Proveedor de alojamiento'],estado:'preliminar',esCertificacion:false};
const scope=()=>({id,organizacionId:org,versionActual:1,revision:{numero:1,sha256:'e'.repeat(64)},contenido:{alcance:definition,origen:{contextoVersion:4,operaciones:[{id:op,version:2,sha256:'2'.repeat(64)}]}},vigencia:{necesitaRevision:true,motivos:['operacion_modificada:'+op]}});
const proposal=()=>({versionContrato:1,contextoVersion:4,propuestaHuella:'f'.repeat(64),espacios:[{actividadId:'act1',operaciones:[op]}],operaciones:[{id:op,version:3,sha256:'3'.repeat(64)}]});
test('refresh preserves every definition field, subspace v0 and identity while sending no calculated state',()=>{
 const s=scope(),plan=scopeRefreshPlan(s,scope(),proposal(),base),body=scopeRefreshBody(plan,'Revisadas las referencias',true);
 expect(body).toEqual({version:1,contextoVersion:4,propuestaHuella:'f'.repeat(64),motivo:'Revisadas las referencias',datos:{nombre:'Portal',actividadIds:['act1'],subespacios:[{id:'d'.repeat(24),version:0}],sistemas:['Portal'],informacion:['Solicitudes'],limites:'Solo portal municipal',exclusiones:[{elemento:'ERP',motivo:'Otro servicio'}],dependencias:['Proveedor de alojamiento']}});
 plan.datos.exclusiones[0].motivo='Otra';expect(s.contenido.alcance.exclusiones[0].motivo).toBe('Otro servicio');expect(plan.previous[0].version).toBe(2);expect(plan.next[0].version).toBe(3);
});
test('historical, concurrent and foreign scopes cannot be refreshed',()=>{
 const newer=scope();newer.versionActual=2;expect(()=>scopeRefreshPlan(scope(),newer,proposal(),base)).toThrow('otra revisión');
 const old=scope();old.versionActual=2;expect(()=>scopeRefreshPlan(old,scope(),proposal(),base)).toThrow('otra revisión');
 const foreign=scope();foreign.organizacionId='9'.repeat(24);expect(()=>scopeRefreshPlan(scope(),foreign,proposal(),base)).toThrow('identidad');
});
test('removed activities, changed operation membership and stale subspaces need a definition review',()=>{
 const p=proposal();p.espacios=[];expect(()=>scopeRefreshPlan(scope(),scope(),p,base)).toThrow('actividad');
 const p2=proposal();p2.espacios[0].operaciones=[];expect(()=>scopeRefreshPlan(scope(),scope(),p2,base)).toThrow('operaciones incluidas');
 const s=scope();s.vigencia.motivos=['subespacio_modificado:x'];expect(()=>scopeRefreshPlan(scope(),s,proposal(),base)).toThrow('servicio o producto');
});
test('incomplete source is not replaced with defaults and confirmation is mandatory',()=>{
 const s=scope();s.contenido.alcance={...definition,exclusiones:undefined};expect(()=>scopeRefreshPlan(s,s,proposal(),base)).toThrow('incompleta');
 const plan=scopeRefreshPlan(scope(),scope(),proposal(),base);expect(()=>scopeRefreshBody(plan,'Motivo',false)).toThrow('Revisa');expect(()=>scopeRefreshBody(plan,'',true)).toThrow('Revisa');
});

let container,root,api,saved;
beforeEach(()=>{
 global.IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(global,'crypto',{configurable:true,value:{randomUUID:()=> 'scope-refresh-key'}});
 container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);saved=jest.fn();
 api={get:jest.fn(p=>Promise.resolve(p===path?scope():p.endsWith('/contexto/propuestas')?proposal():{operacion:{nombre:p.endsWith('/2')?'Nombre anterior':'Nombre actual'}})),write:jest.fn().mockResolvedValue({versionActual:2})};
});
afterEach(()=>{act(()=>root.unmount());container.remove();jest.restoreAllMocks();delete global.IS_REACT_ACT_ENVIRONMENT;});
const render=()=>act(async()=>root.render(<ScopeRefresh api={api} base={base} path={path} scope={scope()} onSaved={saved}/>));
const button=t=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent===t);
const ready=async()=>{await act(async()=>Simulate.change(container.querySelector('input:not([type=checkbox])'),{target:{value:'Referencias comprobadas'}}));await act(async()=>Simulate.change(container.querySelector('input[type=checkbox]'),{target:{checked:true}}));};
const submit=()=>act(async()=>Simulate.submit(container.querySelector('form')));
test('comparison is read-only until reason and explicit confirmation, then PATCH same scope',async()=>{
 await render();expect(api.write).not.toHaveBeenCalled();expect(container.textContent).toContain('Nombre anterior');expect(container.textContent).toContain('Nombre actual');expect(button('Guardar nueva revisión del alcance').disabled).toBe(true);
 await ready();await submit();expect(api.write).toHaveBeenCalledTimes(1);const job=api.write.mock.calls[0][0];expect(job.method).toBe('PATCH');expect(job.path).toBe(path);expect(JSON.parse(job.body).datos.limites).toBe('Solo portal municipal');expect(saved).toHaveBeenCalled();
});
test('409 retains reason and confirmation, refresh requires a new explicit confirmation',async()=>{
 api.write.mockRejectedValueOnce(Object.assign(new Error('Cambio simultáneo'),{status:409}));await render();await ready();await submit();
 expect(container.querySelector('input:not([type=checkbox])').value).toBe('Referencias comprobadas');expect(saved).not.toHaveBeenCalled();expect(button('Guardar nueva revisión del alcance').closest('fieldset').disabled).toBe(true);
 await act(async()=>Simulate.click(button('Volver a consultar las referencias')));expect(container.querySelector('input[type=checkbox]').checked).toBe(false);expect(api.write).toHaveBeenCalledTimes(1);
});
test('unknown network result retries exactly the same request instead of inventing a new write',async()=>{
 api.write.mockRejectedValueOnce(new Error('Sin red'));await render();await ready();await submit();const first=api.write.mock.calls[0][0];
 await act(async()=>Simulate.click(button('Reintentar exactamente el mismo envío')));expect(api.write.mock.calls[1][0]).toBe(first);
});
test('denied current scope never allows a write or substitutes a local record',async()=>{
 const get=api.get.getMockImplementation();api.get.mockImplementation(p=>p===path?Promise.reject(Object.assign(new Error('Sin permiso'),{status:403})):get(p));await render();expect(container.textContent).toContain('Acceso no autorizado');expect(container.querySelector('fieldset').disabled).toBe(true);expect(api.write).not.toHaveBeenCalled();
});
