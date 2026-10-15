import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { RecordPicker, SaveForm } from './NormativeControls';
import { ActionEditor } from './NormativeEditors';

const a='a'.repeat(24), b='b'.repeat(24), c='c'.repeat(24), org='d'.repeat(24);
const base='/organizaciones/'+org, path=base+'/normativa/requisitos';
const record=(id,name)=>({id,version:1,versionActual:1,contenido:{titulo:name},referencia:{id,version:1,sha256:'e'.repeat(64)}});
const records=[record(a,'Requisito A'),record(b,'Requisito B'),record(c,'Requisito C')];
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
let root,container;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(global,'crypto',{configurable:true,value:{randomUUID:()=>a}});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();delete global.IS_REACT_ACT_ENVIRONMENT;});
const button=text=>[...container.querySelectorAll('button')].find(node=>node.textContent===text);
const save=()=>button('Guardar en el servidor');
const sent=api=>JSON.parse(api.write.mock.calls[0][0].body);
const select=()=>container.querySelector('.norm-picker select');
const change=async id=>{expect([...select().options].some(option=>option.value===id&&!option.disabled)).toBe(true);await act(async()=>Simulate.change(select(),{target:{value:id}}));};
const submit=async()=>act(async()=>Simulate.submit(container.querySelector('form')));
const isList=url=>url.includes('?')||url.endsWith('/requisitos');
function mockApi(requests={}) {return {get:jest.fn(url=>isList(url)?Promise.resolve({registros:records}):requests[url.split('/').pop()]?.promise || Promise.resolve(records.find(row=>url.endsWith('/'+row.id)))),write:jest.fn().mockResolvedValue({id:'saved'})};}
function Harness({api,multiple=true,resourcePath=path,initial=[],show=true}) {
  const [selected,setSelected]=useState(initial);
  return <SaveForm api={api} path={base+'/normativa/actuaciones'} title="Prueba" body={()=>({selected:selected.map(row=>row.id)})} onSaved={()=>{}}>
    <input aria-label="Texto del borrador" defaultValue="Conservar este borrador"/>
    {show&&<RecordPicker api={api} path={resourcePath} kind="requisitos" label="Requisitos" multiple={multiple} selected={selected} onChange={setSelected}/>}
    <output>{selected.map(row=>row.id).join(',')}</output>
  </SaveForm>;
}
test('two fast selections block button and submit until both resolve, including reverse order',async()=>{
  const first=deferred(),second=deferred(),api=mockApi({[a]:first,[b]:second});
  await act(async()=>root.render(<Harness api={api}/>));
  await change(a); await change(b);
  expect(save().disabled).toBe(true); await submit(); expect(api.write).not.toHaveBeenCalled();
  await act(async()=>second.resolve(records[1])); expect(save().disabled).toBe(true);
  await act(async()=>first.resolve(records[0])); expect(save().disabled).toBe(false);
  await submit();expect(new Set(sent(api).selected)).toEqual(new Set([a,b]));
});
test('real action editor never sends just its prior requirement while another is pending',async()=>{
  const pending=deferred(),api=mockApi({[b]:pending});
  await act(async()=>root.render(<ActionEditor api={api} base={base} initialRequirements={[records[0]]} responsibles={[{id:c,nombre:'Persona'}]} onSaved={()=>{}}/>));
  const responsible=[...container.querySelectorAll('label')].find(node=>node.firstChild.textContent==='Responsable').querySelector('select');
  await act(async()=>Simulate.change(responsible,{target:{value:c}}));
  await change(b);await submit();expect(api.write).not.toHaveBeenCalled();
  await act(async()=>pending.resolve(records[1]));await submit();
  expect(sent(api).requisitos).toEqual(records.slice(0,2).map(row=>row.referencia));
});
test('resolution error keeps intent and draft blocked; explicit retry resolves it',async()=>{
  const pending=deferred(),api=mockApi({[b]:pending});
  await act(async()=>root.render(<Harness api={api} initial={[records[0]]}/>));
  expect(select().textContent).toContain('Requisito B');
  await change(b);
  await act(async()=>pending.reject({status:503,message:'Fallo de consulta'}));
  expect(container.textContent).toContain('Fallo de consulta');expect(save().disabled).toBe(true);await submit();expect(api.write).not.toHaveBeenCalled();
  expect(container.querySelector('input').value).toBe('Conservar este borrador');
  api.get.mockImplementation(url=>Promise.resolve(isList(url)?{registros:records}:records[1]));
  expect([...container.querySelectorAll('button')].map(node=>node.textContent)).toContain('Reintentar selección de Requisito B');
  await act(async()=>Simulate.click(button('Reintentar selección de Requisito B')));await submit();
  expect(sent(api).selected).toEqual([a,b]);
});
test('explicit cancellation removes failed intent, not the existing selection',async()=>{
  const pending=deferred(),api=mockApi({[b]:pending});
  await act(async()=>root.render(<Harness api={api} initial={[records[0]]}/>));await change(b);
  await act(async()=>pending.reject({status:403,message:'No autorizado'}));
  await act(async()=>Simulate.click(button('Cancelar selección de Requisito B')));await submit();
  expect(sent(api).selected).toEqual([a]);
});
test('changing single selection discards older response even if it arrives last',async()=>{
  const first=deferred(),second=deferred(),api=mockApi({[a]:first,[b]:second});
  await act(async()=>root.render(<Harness api={api} multiple={false}/>));await change(a);await change(b);
  await act(async()=>second.resolve(records[1]));await act(async()=>first.resolve(records[0]));await submit();
  expect(sent(api).selected).toEqual([b]);
});
test('removing an existing choice during loading cannot resurrect it from a stale closure',async()=>{
  const pending=deferred(),api=mockApi({[b]:pending});
  await act(async()=>root.render(<Harness api={api} initial={[records[0]]}/>));await change(b);
  await act(async()=>Simulate.click(button('Quitar selección')));await act(async()=>pending.resolve(records[1]));await submit();
  expect(sent(api).selected).toEqual([b]);
});
test('cancel pending request ignores late success and late failure',async()=>{
  const first=deferred(),second=deferred(),api=mockApi({[a]:first,[b]:second});
  await act(async()=>root.render(<Harness api={api}/>));await change(a);await change(b);
  await act(async()=>{Simulate.click(button('Cancelar selección de Requisito A'));Simulate.click(button('Cancelar selección de Requisito B'));});
  await act(async()=>{first.resolve(records[0]);second.reject({status:500,message:'Late failure'});});
  expect(save().disabled).toBe(false);expect(container.textContent).not.toContain('Late failure');await submit();expect(sent(api).selected).toEqual([]);
});
test('organization path change invalidates pending response',async()=>{
  const pending=deferred(),api=mockApi({[a]:pending});
  await act(async()=>root.render(<Harness api={api}/>));await change(a);
  await act(async()=>root.render(<Harness api={api} resourcePath={'/organizaciones/'+c+'/normativa/requisitos'}/>));
  await act(async()=>pending.resolve(records[0]));await submit();expect(sent(api).selected).toEqual([]);
});
test('unmounted picker unregisters guard and ignores late callback',async()=>{
  const pending=deferred(),api=mockApi({[a]:pending});await act(async()=>root.render(<Harness api={api}/>));await change(a);
  await act(async()=>root.render(<Harness api={api} show={false}/>));await act(async()=>pending.resolve(records[0]));
  expect(save().disabled).toBe(false);await submit();expect(sent(api).selected).toEqual([]);
});
test('wrong response identity fails closed until cancellation',async()=>{
  const pending=deferred(),api=mockApi({[a]:pending});await act(async()=>root.render(<Harness api={api}/>));await change(a);
  await act(async()=>pending.resolve(records[1]));expect(save().disabled).toBe(true);await submit();expect(api.write).not.toHaveBeenCalled();expect(container.textContent).toContain('no corresponde');
});
test('409 keeps complete selections and draft; direct submission cannot bypass conflict',async()=>{
  const api=mockApi();api.write.mockRejectedValue({status:409,message:'Versión obsoleta'});
  await act(async()=>root.render(<Harness api={api}/>));await change(a);await change(b);await submit();
  expect(sent(api).selected).toEqual([a,b]);expect(container.querySelector('input').value).toBe('Conservar este borrador');expect(container.querySelector('output').textContent).toBe(a+','+b);expect(save().disabled).toBe(true);
  await submit();expect(api.write).toHaveBeenCalledTimes(1);
});
test('same event batch cannot submit before pending state renders',async()=>{
  const pending=deferred(),api=mockApi({[b]:pending});
  await act(async()=>root.render(<Harness api={api} initial={[records[0]]}/>));
  await act(async()=>{Simulate.change(select(),{target:{value:b}});Simulate.submit(container.querySelector('form'));});
  expect(api.write).not.toHaveBeenCalled();expect(save().disabled).toBe(true);
  await act(async()=>pending.resolve(records[1]));await submit();expect(sent(api).selected).toEqual([a,b]);
});
test('external selection reset invalidates outstanding request',async()=>{
  const pending=deferred(),api=mockApi({[b]:pending});
  function ResetHarness(){const [selected,setSelected]=useState([records[0]]);return <SaveForm api={api} path={path} title="Reset" body={()=>({selected:selected.map(row=>row.id)})} onSaved={()=>{}}><RecordPicker api={api} path={path} kind="requisitos" label="Requisitos" multiple selected={selected} onChange={setSelected}/><button type="button" onClick={()=>setSelected([])}>Cambiar contexto</button></SaveForm>;}
  await act(async()=>root.render(<ResetHarness/>));await change(b);
  await act(async()=>Simulate.click(button('Cambiar contexto')));await act(async()=>pending.resolve(records[1]));await submit();expect(sent(api).selected).toEqual([]);
});
