import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import CompanyProfile from './CompanyProfile';
import { hasDrafts } from './draft-state';

const base='/organizaciones/'+'a'.repeat(24);
const known=(clave,valor)=>({clave,estado:'conocido',valor});
const ctx=(version=1,hechos=[known('pais_establecimiento','ES')])=>({contexto:{id:'b'.repeat(24),version,hechos},revision:{registradoEn:'2026-10-13T10:00:00Z',motivo:'Prueba'}});
const proposal=(version=1)=>({versionContrato:1,contextoVersion:version,propuestaHuella:'c'.repeat(64),perfil:{actividades:[],preguntas:[
  {clave:'pais_establecimiento',grupo:'empresa',tipo:'texto',texto:'País',respuesta:known('pais_establecimiento','ES')},
  {clave:'publico_directo',grupo:'empresa',tipo:'booleano',texto:'¿Sector público?',respuesta:null}
]},espacios:[],alcances:[],candidatos:[],contradicciones:[]});
let root,container,api,context,proposed;
// CRA's older JSDOM lacks URLSearchParams.size, present in the supported browser.
const needsSearchSize = !('size' in URLSearchParams.prototype);
beforeAll(()=>{if(needsSearchSize)Object.defineProperty(URLSearchParams.prototype,'size',{configurable:true,get(){return Array.from(this).length;}});});
afterAll(()=>{if(needsSearchSize)delete URLSearchParams.prototype.size;});
beforeEach(()=>{
  global.IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(global,'crypto',{configurable:true,value:{randomUUID:()=> 'profile-test-key'}});
  context=ctx();proposed=proposal();
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
  api={get:jest.fn(path=>Promise.resolve(path===base+'/contexto'?context:path===base+'/contexto/propuestas'?proposed:path.includes('/subespacios')?{subespacios:[],siguiente:null}:{alcances:[],siguienteAntes:null})),write:jest.fn().mockResolvedValue({})};
});
afterEach(()=>{act(()=>root.unmount());container.remove();jest.restoreAllMocks();delete global.IS_REACT_ACT_ENVIRONMENT;});
const render=()=>act(async()=>root.render(<CompanyProfile api={api} base={base}/>));
const button=text=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent===text);
const input=label=>Array.from(container.querySelectorAll('label')).find(l=>l.firstChild?.textContent===label)?.querySelector('input,select');
const change=(el,value)=>act(async()=>Simulate.change(el,{target:{value}}));
const click=el=>act(async()=>Simulate.click(el));
const submit=()=>act(async()=>Simulate.submit(container.querySelector('form')));

test('abrir perfil solo lee, no crea contextos, espacios ni decisiones',async()=>{
 await render();expect(api.write).not.toHaveBeenCalled();
 expect(api.get.mock.calls.map(c=>c[0])).toEqual([base+'/contexto',base+'/contexto/propuestas']);
 expect(container.textContent).toContain('No confundimos');
 expect(container.querySelector('[aria-label="Estado: ¿Sector público?"]').value).toBe('desconocido');
});
test('ausencia de contexto exige motivo y un alta explícita sin hechos asumidos',async()=>{
 api.get.mockRejectedValue(Object.assign(new Error('Sin contexto'),{code:'CONTEXTO_NO_INICIADO'}));await render();expect(api.write).not.toHaveBeenCalled();
 await change(input('Motivo de apertura'),'Alta revisada');await submit();
 const job=api.write.mock.calls[0][0];expect(job.method).toBe('POST');expect(JSON.parse(job.body)).toEqual({hechos:[],motivo:'Alta revisada'});
});
test('guardar una respuesta manda PATCH versionado solo con ese dato',async()=>{
 await render();await change(container.querySelector('[aria-label="País"]'),'PT');await change(input('Motivo de esta revisión'),'Actualización');await submit();
 const job=api.write.mock.calls[0][0];expect(job.path).toBe(base+'/contexto');expect(job.method).toBe('PATCH');expect(job.key).toBeTruthy();
 expect(JSON.parse(job.body)).toEqual({version:1,cambios:[known('pais_establecimiento','PT')],motivo:'Actualización'});
});
test('red incierta bloquea edición y reintenta exactamente objeto, cuerpo y clave',async()=>{
 api.write.mockRejectedValueOnce(new Error('Sin red'));await render();await change(container.querySelector('[aria-label="País"]'),'PT');await change(input('Motivo de esta revisión'),'Actualización');await submit();
 expect(container.querySelector('fieldset').disabled).toBe(true);expect(hasDrafts()).toBe(true);
 await click(button('Reintentar exactamente el mismo envío'));expect(api.write.mock.calls[1][0]).toBe(api.write.mock.calls[0][0]);
});
test('409 conserva borrador; el rebase exige resolver concurrencia y no guarda solo',async()=>{
 api.write.mockRejectedValueOnce(Object.assign(new Error('Desactualizado'),{status:409}));await render();await change(container.querySelector('[aria-label="País"]'),'PT');await change(input('Motivo de esta revisión'),'Actualización');await submit();
 expect(container.querySelector('[aria-label="País"]').value).toBe('PT');
 context=ctx(2,[known('pais_establecimiento','FR'),known('dato_ajeno','preservar')]);
 await click(button('Comparar con la revisión actual'));await click(button('Preparar cambios sobre esta revisión'));
 expect(container.textContent).toContain('Elige qué conservar');expect(api.write).toHaveBeenCalledTimes(1);
 await change(container.querySelector('[aria-label="Resolver pais_establecimiento"]'),'mine');await click(button('Preparar cambios sobre esta revisión'));expect(api.write).toHaveBeenCalledTimes(1);
 await submit();expect(JSON.parse(api.write.mock.calls[1][0].body)).toEqual({version:2,cambios:[known('pais_establecimiento','PT')],motivo:'Actualización'});
});
test('si la propuesta no corresponde a la revisión, no se monta el formulario',async()=>{
 proposed.contextoVersion=2;await render();expect(container.querySelector('form')).toBeNull();expect(container.textContent).toContain('desactualizada');
});
test('403 no muestra datos simulados ni controles de escritura',async()=>{
 api.get.mockRejectedValue(Object.assign(new Error('Sin acceso'),{status:403}));await render();expect(container.textContent).toContain('Acceso no autorizado');expect(container.querySelector('form')).toBeNull();expect(api.write).not.toHaveBeenCalled();
});
test('no pierde una actividad cuyo nombre todavía no se añadió al borrador',async()=>{
 await render();await change(input('Nombre de la nueva actividad'),'Mi SaaS');await change(input('Motivo de esta revisión'),'Nuevo servicio');await submit();
 expect(container.textContent).toContain('Añade la actividad al borrador');expect(api.write).not.toHaveBeenCalled();
});
test('añadir actividad se guarda en contexto, no crea directamente un espacio',async()=>{
 await render();await change(input('Nombre de la nueva actividad'),'Mi SaaS');await change(input('Tipo de nueva actividad'),'servicio');await click(button('Añadir actividad al borrador'));
 expect(api.write).not.toHaveBeenCalled();await change(input('Motivo de esta revisión'),'Nuevo servicio');await submit();
 expect(JSON.parse(api.write.mock.calls[0][0].body).cambios).toEqual([known('perfil_actividades',['act1']),known('actividad_act1_nombre','Mi SaaS'),known('actividad_act1_tipo','servicio')]);
});
test('cambiar de pestaña con borrador pide confirmación y puede cancelarse',async()=>{
 await render();await change(container.querySelector('[aria-label="País"]'),'PT');jest.spyOn(window,'confirm').mockReturnValue(false);
 await click(button('2 · Revisar propuestas'));expect(window.confirm).toHaveBeenCalled();expect(container.querySelector('[aria-label="País"]').value).toBe('PT');
});
test('propuestas se leen sin materializar; confirmación guarda y bloquea duplicado',async()=>{
 proposed.espacios=[{actividadId:'web',nombre:'Web',tipo:'servicio',descripcion:'Web servicio'}];
 proposed.alcances=[{clave:'web',nombre:'Web',actividadIds:['web'],sistemas:[],informacion:[],limites:'',exclusiones:[],dependencias:[],estado:'preliminar'}];
 api.write.mockResolvedValue({espacios:[{id:'d'.repeat(24)}],alcances:[{id:'e'.repeat(24)}],repetida:false});
 await render();await click(button('2 · Revisar propuestas'));expect(api.write).not.toHaveBeenCalled();expect(button('Confirmar organización del trabajo').disabled).toBe(true);
 await change(input('Motivo de la confirmación'),'Revisado');await act(async()=>Simulate.change(container.querySelector('input[type="checkbox"]'),{target:{checked:true}}));await submit();
 const job=api.write.mock.calls[0][0];expect(job.path).toBe(base+'/contexto/materializaciones');expect(JSON.parse(job.body).confirmar).toBe(true);expect(JSON.parse(job.body).alcances[0].estado).toBeUndefined();expect(button('Confirmar organización del trabajo').disabled).toBe(true);
});
test('historial usa la revisión solicitada y señala desactualización sin escribir',async()=>{
 const id='d'.repeat(24),detail={contenido:{alcance:{nombre:'Web'},origen:{contextoVersion:1},candidatos:[],contradicciones:[]},revision:{numero:1,registradoEn:'2026-10-13T10:00:00Z',motivo:'Prueba'},versionActual:2,vigencia:{necesitaRevision:true,motivos:['contexto_modificado']}};
 const original=api.get.getMockImplementation();api.get.mockImplementation(path=>path===base+'/alcances/'+id||path===base+'/alcances/'+id+'/versiones/1'?Promise.resolve(detail):path.includes('/versiones?')||path.endsWith('/versiones')?Promise.resolve({versiones:[{numero:1,motivo:'Prueba'}],siguienteAntes:null}):path.includes('/alcances?')||path===base+'/alcances'?Promise.resolve({alcances:[{id,nombre:'Web',versionActual:2}],siguienteAntes:null}):original(path));
 await render();await click(button('3 · Alcances guardados'));await click(button('Consultar alcance'));expect(container.textContent).toContain('no se ha recalculado ni sobrescrito');await click(button('Consultar revisión 1'));
 expect(api.get).toHaveBeenCalledWith(base+'/alcances/'+id+'/versiones/1');expect(api.write).not.toHaveBeenCalled();
});

const operationId='1'.repeat(24),otherOperationId='2'.repeat(24);
function operationFixture() {
  const operation={id:operationId,nombre:'Soporte de clientes',descripcion:'Gestionar incidencias',versionActual:1,revision:{numero:1,sha256:'f'.repeat(64)}};
  const data={operacion:{...operation,organizacionId:'a'.repeat(24)},contexto:{version:1,hechos:[]},versionActual:1,revision:operation.revision};
  context=ctx(1,[known('perfil_actividades',['act1']),known('actividad_act1_nombre','Mi SaaS')]);
  proposed.perfil.actividades=[{id:'act1',hechos:[{campo:'nombre',estado:'conocido',valor:'Mi SaaS'}]}];
  proposed.perfil.preguntas.push({clave:'actividad_act1_operaciones',grupo:'act1',tipo:'ids',texto:'Operaciones de esta actividad',respuesta:null});
  proposed.operaciones=[];
  const original=api.get.getMockImplementation();
  api.get.mockImplementation(path=>path.includes('/operaciones?')?Promise.resolve({operaciones:[operation],paginacion:{hayMas:false}}):path===base+'/operaciones/'+operationId?Promise.resolve(data):original(path));
  return {operation,data};
}
const declareOperations=async()=>{await render();await click(button('Mi SaaS'));await change(container.querySelector('[aria-label="Estado: Operaciones de esta actividad"]'),'conocido');};
const checkOperation=async(checked=true)=>act(async()=>Simulate.change(container.querySelector('.profile-operation-option input'),{target:{checked}}));
test('operation selector shows names and versions, never asks for a manually typed ID',async()=>{
 operationFixture();await declareOperations();expect(container.textContent).toContain('Soporte de clientes');expect(container.textContent).toContain('Revisión 1');
 expect(container.querySelector('input[aria-label="Operaciones de esta actividad"]')).toBeNull();expect(api.write).not.toHaveBeenCalled();
 await checkOperation();await change(input('Motivo de esta revisión'),'Vincular soporte');await submit();
 expect(JSON.parse(api.write.mock.calls[0][0].body)).toEqual({version:1,cambios:[known('actividad_act1_operaciones',[operationId])],motivo:'Vincular soporte'});
});
test('empty operation list explains creation without creating an operation or a link',async()=>{
 operationFixture();const original=api.get.getMockImplementation();api.get.mockImplementation(p=>p.includes('/operaciones?')?Promise.resolve({operaciones:[],paginacion:{hayMas:false}}):original(p));
 await declareOperations();expect(container.textContent).toContain('No hay operaciones creadas');expect(container.textContent).toContain('Describir una operación');expect(api.write).not.toHaveBeenCalled();
});
test('stale selection preserves draft and requires an explicit reload before saving',async()=>{
 const {data,operation}=operationFixture();await declareOperations();await checkOperation();await change(input('Motivo de esta revisión'),'Vínculo revisado');
 data.contexto.version=2;data.versionActual=2;data.revision={numero:2,sha256:'e'.repeat(64)};await submit();
 expect(api.write).not.toHaveBeenCalled();expect(container.textContent).toContain('Una operación seleccionada ha cambiado');expect(container.querySelector('.profile-operation-option input').checked).toBe(true);expect(hasDrafts()).toBe(true);
 operation.versionActual=2;operation.revision=data.revision;await click(button('Actualizar operaciones'));
 expect(container.textContent).toContain('Revisión 2');await submit();expect(api.write).toHaveBeenCalledTimes(1);
});
test('foreign operation detail cannot be saved even if a corrupted list offered it',async()=>{
 const {data}=operationFixture();data.operacion.organizacionId='e'.repeat(24);await declareOperations();await checkOperation();await change(input('Motivo de esta revisión'),'Vincular');await submit();
 expect(api.write).not.toHaveBeenCalled();expect(container.textContent).toContain('no corresponde a esta organización');
});
test('list permission error does not create fallback options',async()=>{
 operationFixture();const original=api.get.getMockImplementation();api.get.mockImplementation(p=>p.includes('/operaciones?')?Promise.reject(Object.assign(new Error('Sin permiso'),{status:403})):original(p));
 await declareOperations();expect(container.textContent).toContain('Acceso no autorizado');expect(container.querySelector('.profile-operation-option')).toBeNull();expect(api.write).not.toHaveBeenCalled();
});
test('selected operation outside the first page is read by name and is not cleared; pagination preserves selection',async()=>{
 const {operation}=operationFixture();context.contexto.hechos.push(known('actividad_act1_operaciones',[otherOperationId]));proposed.operaciones=[{id:otherOperationId,version:1,sha256:'d'.repeat(64)}];
 const second={...operation,id:otherOperationId,nombre:'Entrega de software',revision:{numero:1,sha256:'d'.repeat(64)}};
 const original=api.get.getMockImplementation();api.get.mockImplementation(p=>p===base+'/operaciones/'+otherOperationId?Promise.resolve({operacion:{...second,organizacionId:'a'.repeat(24)},contexto:{version:1},versionActual:1,revision:second.revision}):p.includes('antes=')?Promise.resolve({operaciones:[second],paginacion:{hayMas:false}}):p.includes('/operaciones?')?Promise.resolve({operaciones:[operation],paginacion:{hayMas:true,siguienteAntes:'cursor'}}):original(p));
 await render();await click(button('Mi SaaS'));expect(container.textContent).toContain('Entrega de software');expect(hasDrafts()).toBe(false);
 await click(button('Cargar más operaciones'));const checks=[...container.querySelectorAll('.profile-operation-option input')];expect(checks.length).toBe(2);expect(checks[1].checked).toBe(true);expect(api.write).not.toHaveBeenCalled();
});
test('proposal and scope history use exact operation version names, not the current name',async()=>{
 operationFixture();proposed.espacios=[{actividadId:'act1',nombre:'Mi SaaS',tipo:'servicio',operaciones:[operationId]}];proposed.operaciones=[{id:operationId,version:1,sha256:'f'.repeat(64)}];
 const original=api.get.getMockImplementation();api.get.mockImplementation(p=>p===base+'/operaciones/'+operationId+'/versiones/1'?Promise.resolve({operacion:{nombre:'Nombre histórico del soporte'}}):original(p));
 await render();await click(button('2 · Revisar propuestas'));expect(container.textContent).toContain('Nombre histórico del soporte');expect(api.get).toHaveBeenCalledWith(base+'/operaciones/'+operationId+'/versiones/1');expect(api.write).not.toHaveBeenCalled();
});
test('saved links reload as selected names without becoming a new draft',async()=>{
 operationFixture();api.write.mockImplementation(job=>{
   const body=JSON.parse(job.body);context=ctx(2,[...context.contexto.hechos,...body.cambios]);proposed.contextoVersion=2;proposed.operaciones=[{id:operationId,version:1,sha256:'f'.repeat(64)}];return Promise.resolve(context);
 });
 await declareOperations();await checkOperation();await change(input('Motivo de esta revisión'),'Vincular');await submit();
 await click(button('Mi SaaS'));expect(container.querySelector('.profile-operation-option input').checked).toBe(true);expect(container.textContent).toContain('Soporte de clientes');expect(hasDrafts()).toBe(false);
 await click(button('Consultar perfil actual'));await click(button('Mi SaaS'));
 expect(container.querySelector('.profile-operation-option input').checked).toBe(true);expect(api.write).toHaveBeenCalledTimes(1);
});
