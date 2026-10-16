import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';
import {ApiError} from '../api-client';
import EnsCategorization, {CategoryProposal, CategoryRead} from './EnsCategorization';
import EnsCategoryEditor from './EnsCategoryEditor';
import EnsExactEvidence from './EnsExactEvidence';
import {SaveForm} from './NormativeControls';
import {CategoryReviewEditor, DeterminationEditor, InstantField, reviewBody} from './EnsCategoryDecisions';
import {blankHistory, categoryBody, categoryPath, designationFits, DIMENSIONS, LEVELS, newElement, REVIEW_CRITERIA, utcValue, utcInput, versionElements} from './ens-category-model';

const id='a'.repeat(24),scope='b'.repeat(24),catId='c'.repeat(24),hash='d'.repeat(64),base='/organizaciones/'+scope;
const ref=(resource=id,version=1)=>({id:resource,version,sha256:hash});
const system={id,version:1,versionActual:1,referencia:ref(),contenido:{nombre:'Sistema de soporte',alcance:ref(scope)}};
function element(){const e=newElement(()=> '11111111-1111-1111-1111-111111111111');return {...e,nombre:'Tickets',descripcion:'Contenido de consultas',limitaciones:'No se ha terminado el examen',dimensiones:Object.fromEntries(Object.keys(DIMENSIONS).map(k=>[k,{nivel:'DESCONOCIDO',motivo:'Pendiente de contrastar el impacto',criteriosImpacto:'Criterios todavía por examinar'}]))};}
const draft=()=>({baseAplicabilidad:{tipo:'por_aclarar',motivo:'Contrato pendiente de contrastar',evidencias:[]},historialTemporal:{...blankHistory(),motivo:'No conocemos la fecha ni los antecedentes'},inventario:{completo:false,delimitacion:'Sistema de atención',exclusiones:'Sin exclusiones identificadas todavía',dependencias:'Dependencia de proveedor externo',elementos:[element()]},motivo:'Primera preparación'});
const proposal=(level='BAJO')=>({estado:'PROPUESTA_CALCULADA',categoriaPropuesta:level==='ALTO'?'ALTA':level==='MEDIO'?'MEDIA':'BASICA',categoriaMinimaConocida:null,dimensiones:Object.fromEntries(Object.keys(DIMENSIONS).map(k=>[k,{estado:'VALORADA',nivelCalculado:k==='C'?level:'BAJO',minimoConocido:null}])),carencias:[],esDeterminacionFormal:false});
const dto=()=>({id:catId,version:1,versionActual:1,referencia:ref(catId),revision:{registradoEn:'2026-10-15T10:00:00.000Z',motivo:'Preparación'},permisos:{actualizar:true,determinar:true,revisar:true},contenido:{categorizacion:{...categoryBody(draft(),null,system),propuesta:proposal()}},vigencia:{requiereRevision:false,motivos:[]}});

test.each(Object.keys(LEVELS))('element preserves %s as a distinct state',nivel=>{const d=draft();d.inventario.elementos[0].dimensiones.C.nivel=nivel;expect(categoryBody(d,null,system).inventario.elementos[0].dimensiones.C.nivel).toBe(nivel);});
test('initial unknowns stay unknown and dates are not seeded from creation time',()=>{const body=categoryBody(draft(),null,system);expect(body.historialTemporal).toMatchObject({estado:'desconocido',fechaInicio:null,ultimaReevaluacionEn:null});expect(body.inventario.elementos[0]).toMatchObject({responsable:null,valoradoEn:null,evidencias:[]});expect(body).not.toHaveProperty('propuesta');expect(body).not.toHaveProperty('identidadesElementos');});
test('empty incomplete inventory is a valid preparation, not default BASIC',()=>{const d=draft();d.inventario.elementos=[];expect(categoryBody(d,null,system).inventario.elementos).toEqual([]);expect(categoryBody(d,null,system)).not.toHaveProperty('categoria');});
test('stable element identity; unchanged version remains; any material edit increments once',()=>{const e=element();expect(versionElements([e],[e])[0]).toEqual(e);expect(versionElements([{...e,limitaciones:'Nueva limitación'}],[e])[0]).toMatchObject({id:e.id,version:2});expect(versionElements([{...e,version:77,nombre:'Nuevo nombre'}],[e])[0].version).toBe(2);});
test('retiring element does not mutate the prior snapshot',()=>{const prior=[element()];expect(versionElements([],prior)).toEqual([]);expect(prior).toHaveLength(1);});
test('missing motivations and duplicate element ids block submit',()=>{const d=draft();d.inventario.elementos.push(element());expect(()=>categoryBody(d,null,system)).toThrow('repetidos');d.inventario.elementos=[element()];d.inventario.elementos[0].dimensiones.A.motivo='';expect(()=>categoryBody(d,null,system)).toThrow('Autenticidad');});
test('system bases never advance without explicit replacement',()=>{const old=categoryBody(draft(),null,system);const updated={...system,version:2,referencia:ref(id,2),contenido:{...system.contenido,alcance:ref(scope,2)}};expect(categoryBody(draft(),old,updated).sistema.version).toBe(1);expect(categoryBody(draft(),old,updated,true).sistema.version).toBe(2);expect(categoryBody(draft(),old,updated,true).alcance.version).toBe(2);});
test('exact references reject missing hash; temporal controls roundtrip known precision',()=>{expect(()=>categoryBody(draft(),null,{...system,referencia:{id,version:1}})).toThrow('exacta');const t='2026-10-15T10:22:33.456Z';expect(utcValue(utcInput(t))).toBe(t);expect(utcValue('')).toBeNull();});
test.each(['wrong','categorizacion_ens','../sistemas'])('unknown route %s rejected',route=>expect(()=>categoryPath(base,route)).toThrow());
test('designation must match role, state and exact system and scope',()=>{const d={version:1,versionActual:1,contenido:{designacion:{funcionId:'RESPONSABLE_SEGURIDAD',estado:'identificada',objeto:{tipo:'sistema',id,version:1},alcance:ref(scope)}}};expect(designationFits(d,system,'RESPONSABLE_SEGURIDAD')).toBe(true);expect(designationFits(d,system,'RESPONSABLE_INFORMACION')).toBe(false);d.contenido.designacion.alcance={...ref(scope),version:2};expect(designationFits(d,system,'RESPONSABLE_SEGURIDAD')).toBe(false);});
function reviewDraft(){return {determination:[],evidence:[],previous:[],desdeEn:'2026-10-15T10:00:00.000Z',hastaEn:'2026-10-15T10:00:00.000Z',examinadaEn:'2026-10-15T11:00:00.000Z',tipoRevision:'inicial',modalidadTemporal:'no_determinada',finalidadRevision:'historica',motivo:'Historial no conocido',criteria:Object.keys(REVIEW_CRITERIA).map(id=>({id,resultado:'no_determinado',motivo:'Pendiente de prueba',evidenciaIds:[]}))};}
test('point-in-time review retains unknown conclusions and separate timestamps',()=>{const body=reviewBody(dto(),reviewDraft());expect(body.conclusion).toBe('no_determinado');expect(body.periodoExaminado.desdeEn).toBe(body.periodoExaminado.hastaEn);expect(body.modalidadTemporal).toBe('no_determinada');expect(body).not.toHaveProperty('registradoEn');expect(body).not.toHaveProperty('periodo');});
test('examining an interval ending after examination time is blocked',()=>{expect(()=>reviewBody(dto(),{...reviewDraft(),hastaEn:'2026-10-16T00:00:00.000Z'})).toThrow('intervalo');});
test('no assumed favourable; evidence per criterion required',()=>{const d=reviewDraft();d.criteria=d.criteria.map(c=>({...c,resultado:'favorable'}));expect(()=>reviewBody(dto(),d)).toThrow('evidencias');d.criteria[0].resultado='';expect(()=>reviewBody(dto(),d)).toThrow('cinco');});

let root,container;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(global,'crypto',{configurable:true,value:{randomUUID:()=> '22222222-2222-2222-2222-222222222222'}});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();delete global.IS_REACT_ACT_ENVIRONMENT;jest.restoreAllMocks();});
const render=async component=>act(async()=>root.render(component));
const button=name=>[...container.querySelectorAll('button')].find(el=>el.textContent===name);
const field=name=>[...container.querySelectorAll('label')].find(el=>el.textContent.startsWith(name))?.querySelector('input,select,textarea');
const click=async name=>act(async()=>Simulate.click(button(name)));
const change=async(name,value)=>act(async()=>{const el=field(name);el.value=value;Simulate.change(el);});
const empty={registros:[],paginacion:{hayMas:false}};
const api=()=>({get:jest.fn().mockResolvedValue(empty),write:jest.fn().mockResolvedValue(dto())});

test('UTC instant keeps native input events including milliseconds and clears to unknown',async()=>{
  function Draft(){const [value,setValue]=React.useState(null);return <><InstantField label="Instante" value={value} onChange={setValue}/><output>{value||'desconocido'}</output></>;}
  await render(<Draft/>);
  await act(async()=>{field('Instante').value='2026-10-15T10:22:33.456';Simulate.input(field('Instante'));});
  expect(container.querySelector('output').textContent).toBe('2026-10-15T10:22:33.456Z');
  await act(async()=>{field('Instante').value='';Simulate.input(field('Instante'));});
  expect(container.querySelector('output').textContent).toBe('desconocido');
});

test('inventory history and valuation dates persist native input across other field changes',async()=>{
  const a=api();await render(<EnsCategoryEditor api={a} base={base} system={system} data={dto()} onSaved={()=>{}}/>);
  for(const name of ['Inicio real del sistema','Última determinación','Última reevaluación'])await act(async()=>{field(name).value='2026-10-15T10:00';Simulate.input(field(name));});
  await click('Información: Tickets');
  await act(async()=>{field('Fecha y hora de la valoración').value='2026-10-15T10:01';Simulate.input(field('Fecha y hora de la valoración'));});
  await change('Motivo del registro','Conservar instantes');await act(async()=>Simulate.submit(container.querySelector('form')));
  const payload=JSON.parse(a.write.mock.calls[0][0].body);
  expect(payload.historialTemporal.fechaInicio).toBe('2026-10-15T10:00:00.000Z');
  expect(payload.historialTemporal.ultimaDeterminacionEn).toBe(payload.historialTemporal.fechaInicio);
  expect(payload.historialTemporal.ultimaReevaluacionEn).toBe(payload.historialTemporal.fechaInicio);
  expect(payload.inventario.elementos[0].valoradoEn).toBe('2026-10-15T10:01:00.000Z');
});

test('CAT conflict cancel preserves draft; acceptance synchronizes header and editor without saving',async()=>{
  const first=dto(),latest={...dto(),version:2,versionActual:2,referencia:ref(catId,2),revision:{registradoEn:'2026-10-15T11:00:00.000Z',motivo:'Cambio A'}};
  latest.contenido.categorizacion.inventario.delimitacion='Contenido A actual';
  let fetches=0;const a=api();a.get.mockImplementation(path=>Promise.resolve(path.endsWith('/contrato')?{permisos:{consultar:true,actualizar:true}}:path===categoryPath(base,'categorizaciones-ens',catId)?(++fetches===1?first:latest):path.startsWith(categoryPath(base)+'?')?{...empty,registros:[first]}:path.endsWith('/versiones?limite=10')?{versiones:[],paginacion:{hayMas:false}}:empty));
  a.write.mockRejectedValue(new ApiError('Conflicto',409));
  await render(<EnsCategorization api={a} base={base} system={system} onBack={()=>{}}/>);
  await click('Consultar categorización');await click('Actualizar inventario y valoraciones');await change('Motivo del registro','Borrador B');
  await act(async()=>Simulate.submit(container.querySelector('form')));await click('Consultar versión actual para comparar');
  jest.spyOn(window,'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  await click('Reabrir la versión actual y descartar este borrador');
  expect(field('Motivo del registro').value).toBe('Borrador B');expect(container.textContent).toContain('Versión consultada 1 · versión actual 1');
  await click('Reabrir la versión actual y descartar este borrador');
  expect(container.textContent).toContain('Versión consultada 2 · versión actual 2');expect(field('Motivo del registro').value).toBe('');
  expect(field('¿Qué información').value).toBe('Contenido A actual');expect(a.write).toHaveBeenCalledTimes(1);
  await click('Cerrar editor');expect(container.textContent).toContain('Versión consultada 2 · versión actual 2');
});
test.each(['BAJO','MEDIO','ALTO'])('renders server proposal %s without averaging vector',async level=>{await render(<CategoryProposal value={proposal(level)}/>);expect(container.querySelector('.ens-category-result').textContent).toBe({BAJO:'Básica',MEDIO:'Media',ALTO:'Alta'}[level]);expect(container.textContent).toContain('DisponibilidadBajo');expect(container.textContent).not.toContain('%');});
test('ALTA lower bound never hides unknown or turns into formal determination',async()=>{const p={...proposal('ALTO'),estado:'INCOMPLETO',categoriaPropuesta:null,categoriaMinimaConocida:'ALTA',carencias:[{tipo:'DESCONOCIDO',elemento:element().id,dimension:'D'}]};await render(<CategoryProposal value={p} elements={[element()]}/>);expect(container.textContent).toContain('No hay una propuesta completa');expect(container.textContent).toContain('Tickets');expect(container.textContent).toContain('Mínimo conocido');});
test('absent proposal does not synthesize calculation',async()=>{await render(<CategoryProposal/>);expect(container.textContent).toContain('no ha devuelto una propuesta');});
test('403 metadata does not render actionable forms or fallback records',async()=>{const a=api();a.get.mockRejectedValue(new ApiError('Denegado',403));await render(<EnsCategorization api={a} base={base} system={system} onBack={()=>{}}/>);expect(container.textContent).toContain('Acceso no autorizado');expect(button('Preparar categorización ENS')).toBeUndefined();expect(a.write).not.toHaveBeenCalled();});
test('list creation uses explicit effective permission and pagination',async()=>{const a=api();a.get.mockImplementation(path=>Promise.resolve(path.endsWith('/contrato')?{permisos:{consultar:true,crear:false}}:{...empty,paginacion:{hayMas:true,siguienteAntes:catId}}));await render(<EnsCategorization api={a} base={base} system={system} onBack={()=>{}}/>);expect(button('Preparar categorización ENS')).toBeUndefined();await click('Expedientes anteriores');expect(a.get.mock.calls.at(-1)[0]).toContain('antes='+catId);});
test('editing sends exact category references, increments changed element, no server output',async()=>{const a=api(),d=dto();await render(<EnsCategoryEditor api={a} base={base} system={system} data={d} onSaved={()=>{}} onRestart={()=>{}}/>);await click('Información: Tickets');await change('Nombre de la información','Tickets y adjuntos');await change('Motivo del registro','Aclarar contenido');await act(async()=>Simulate.submit(container.querySelector('form')));const job=a.write.mock.calls[0][0],body=JSON.parse(job.body);expect(job.method).toBe('PATCH');expect(body.version).toBe(1);expect(body.inventario.elementos[0].version).toBe(2);expect(body.sistema).toEqual(ref());expect(body).not.toHaveProperty('propuesta');});
test('409 leaves draft and prevents automatic resubmission',async()=>{const a=api();a.write.mockRejectedValue(new ApiError('Version changed',409));await render(<EnsCategoryEditor api={a} base={base} system={system} data={dto()} onSaved={()=>{}} onRestart={()=>{}}/>);await change('Motivo del registro','Borrador conservado');await act(async()=>Simulate.submit(container.querySelector('form')));expect(container.textContent).toContain('Tu borrador sigue aquí');expect(field('Motivo del registro').value).toBe('Borrador conservado');expect(button('Guardar valoraciones y consultar propuesta').disabled).toBe(true);await act(async()=>Simulate.submit(container.querySelector('form')));expect(a.write).toHaveBeenCalledTimes(1);});
test('uncertain 503 retries the identical idempotency key and body',async()=>{const a=api();a.write.mockRejectedValueOnce(new ApiError('Unavailable',503));await render(<EnsCategoryEditor api={a} base={base} system={system} data={dto()} onSaved={()=>{}}/>);await change('Motivo del registro','Intento único');await act(async()=>Simulate.submit(container.querySelector('form')));await click('Reintentar exactamente el mismo envío');expect(a.write.mock.calls[1][0]).toEqual(a.write.mock.calls[0][0]);});
test('review editor has no preselected conclusion or temporal justification',async()=>{await render(<CategoryReviewEditor api={api()} base={base} categorization={dto()}/>);expect(field('Valoración del criterio 1').value).toBe('');expect(field('Qué has constatado').value).toBe('');expect(container.textContent).toContain('El alta en la app no reinicia');});
test('determination requires explicit confirmation and does not submit on mount',async()=>{const a=api();await render(<DeterminationEditor api={a} base={base} system={system} categorization={dto()}/>);expect(field('He contrastado').checked).toBe(false);expect(a.write).not.toHaveBeenCalled();});
test('historical proposal and current derived state are visibly separate',async()=>{const d=dto();d.versionActual=2;d.estadoCategorizacion={seRefiereAVersionActual:2,satisfaccionActual:'requiere_revision',avisos:['sistema_modificado']};await render(<CategoryRead dto={d}/>);expect(container.textContent).toContain('Estado derivado de la versión actual 2');expect(container.textContent).toContain('no sustituye el contenido');expect(container.querySelector('.ens-category-result').textContent).toBe('Básica');});
test.each(['actual','historica'])('explicit review purpose %s is submitted unchanged',finalidadRevision=>{expect(reviewBody(dto(),{...reviewDraft(),finalidadRevision}).finalidadRevision).toBe(finalidadRevision);});
test('existing determination before annual reassessment is a separate explicit modality',()=>{expect(reviewBody(dto(),{...reviewDraft(),modalidadTemporal:'determinacion_previa_sin_reevaluacion_vencida'}).modalidadTemporal).toBe('determinacion_previa_sin_reevaluacion_vencida');expect(()=>reviewBody(dto(),{...reviewDraft(),finalidadRevision:''})).toThrow('finalidad');});
test('five distinct criteria cannot be replaced by duplicate entries',()=>{const d=reviewDraft();d.criteria[4]=d.criteria[0];expect(()=>reviewBody(dto(),d)).toThrow('cinco');});
test('mathematical proposal does not conceal missing documentary authority',async()=>{const d=dto();d.contenido.categorizacion.carenciasDocumentales=[{tipo:'RESPONSABLE_PENDIENTE',elemento:element().id}];await render(<CategoryRead dto={d}/>);expect(container.textContent).toContain('documentación de la valoración está incompleta');expect(container.textContent).toContain('Tickets');});
test('historical evidence lookup requests exact version; mismatch never shows evidence content',async()=>{const a=api();a.get.mockResolvedValue({id,referencia:{...ref(),sha256:'f'.repeat(64)},contenido:{evidencia:{titulo:'Must not display'}}});await render(<EnsExactEvidence api={a} base={base} refs={[ref()]}/>);await click('Consultar evidencia 1 · versión 1');expect(a.get).toHaveBeenCalledWith(base+'/normativa/evidencias/'+id+'/versiones/1');expect(container.textContent).toContain('no coincide');expect(container.textContent).not.toContain('Must not display');});
test('UTF8 size guard prevents oversized write before transport',async()=>{const a=api();await render(<SaveForm api={a} path={categoryPath(base)} title="Test" maxBodyBytes={128*1024} body={()=>({texto:'á'.repeat(70000)})}><p>Contenido conservado</p></SaveForm>);await act(async()=>Simulate.submit(container.querySelector('form')));expect(a.write).not.toHaveBeenCalled();expect(container.textContent).toContain('128 KiB');expect(container.textContent).toContain('Contenido conservado');});
test('server 413 keeps editable draft, explains size and does not retry automatically',async()=>{const a=api();a.write.mockRejectedValue(new ApiError('Payload too large',413));await render(<EnsCategoryEditor api={a} base={base} system={system} data={dto()} onSaved={()=>{}}/>);await change('Motivo del registro','Conservar este borrador');await act(async()=>Simulate.submit(container.querySelector('form')));expect(field('Motivo del registro').value).toBe('Conservar este borrador');expect(field('Motivo del registro').disabled).toBe(false);expect(container.textContent).toContain('resume los textos');expect(a.write).toHaveBeenCalledTimes(1);});
