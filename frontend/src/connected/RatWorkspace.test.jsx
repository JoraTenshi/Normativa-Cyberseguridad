import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RatWorkspace, { RatStatus } from './RatWorkspace';
import RatEditor from './RatEditor';
import { RatReview, RatAction } from './RatReview';
import { pendingRATField, ratRecordBody, operationRef, ratPath, storedRef } from './rat-model';

// Simulated API/contract only. Real Mongo/browser tests are reported separately.
const id='a'.repeat(24),org='b'.repeat(24),op='c'.repeat(24),hash='d'.repeat(64),base='/organizaciones/'+org;
const ref={id,version:1,sha256:hash};
const contract={id:'REGISTRO_RAT_E11',version:1,funciones:['responsable','encargado'],campo:{estados:['conocido','pendiente','conflictivo','no_corresponde','imposible_motivado']},condicionales:['representante','dpd','sujeto77','comunicacionDPD','transferencias','corresponsables'],cuandoSeaPosible:['supresion','medidas'],camposResponsable:['finalidades','interesados','datos','destinatarios','transferencias','supresion','medidas','corresponsables'],camposEncargado:['transferencias','medidas'],limites:{entradas:50,operaciones:200,cuerpoHttpBytes:131072},criterios:{responsable:['RAT_PERIMETRO'],encargado:['RAT_PERIMETRO']}};
const common=()=>Object.fromEntries(['representante','dpd','sujeto77','comunicacionDPD','disponibilidadAutoridad'].map(k=>[k,pendingRATField()]));
const draft=(funcion='responsable')=>({nombre:'Registro sintético',funcion,fechaReferencia:'2026-10-16',inventarioCompleto:false,entidad:{nombre:'Entidad ficticia',contacto:'Contacto de pruebas'},...common(),entradas:[]});
const dto=(version=1)=>({id,version,versionActual:version,tipo:'registro_rat',referencia:{...ref,version},permisos:{actualizar:true,revisar:true},revision:{registradoEn:'2026-10-16T00:00:00Z',motivo:'Alta'},contenido:{registroRAT:{...draft(),alcance:ref,evidencias:[],diagnostico:{incidencias:['registro_sin_entradas']}}},estadoRAT:{seRefiereAVersionActual:version,satisfaccionActual:'sin_revisar',conclusionHistorica:null,revision:null,requiereRevision:false,diagnosticoActual:{permiteRevisionFavorable:false}}});
beforeEach(()=>Object.defineProperty(global,'crypto',{configurable:true,value:{randomUUID:()=> 'e'.repeat(24)}}));
const click=name=>fireEvent.click(screen.getByRole('button',{name}));
test('RAT uses exact scope and evidence; empty/incomplete is not marked complete',()=>{
  const body=ratRecordBody(draft(),storedRef(ref),[],'Registro pendiente',contract);
  expect(body.alcance).toEqual(ref);expect(body.inventarioCompleto).toBe(false);expect(body.entradas).toEqual([]);expect(body.dpd.estado).toBe('pendiente');expect(body).not.toHaveProperty('diagnostico');
});
test('no_corresponde is forbidden for ordinary mandatory fields',()=>{
  const d=draft();d.disponibilidadAutoridad={estado:'no_corresponde',contenido:'',motivo:'No queremos'};
  expect(()=>ratRecordBody(d,storedRef(ref),[],'Prueba',contract)).toThrow('No corresponde');
});
test('exact operation version does not inherit a global company role',()=>{
  expect(operationRef({operacion:{id:op},contexto:{version:2},revision:{sha256:hash}})).toEqual({id:op,version:2,sha256:hash});
  expect(()=>operationRef({operacion:{id:op},contexto:{version:2},revision:{}})).toThrow();
});
test('duplicate operation across entries is rejected',()=>{
  const d=draft('encargado'),entry={id:'entrada-1',titulo:'Soporte',operaciones:[storedRef({...ref,id:op})],campos:{transferencias:pendingRATField(),medidas:pendingRATField()},responsables:[],evidencias:[]};d.entradas=[entry,{...entry,id:'entrada-2'}];
  expect(()=>ratRecordBody(d,storedRef(ref),[],'Prueba',contract)).toThrow('repetida');
});
test('encargado preserves per-responsible categories and finalities',()=>{
  const d=draft('encargado');d.entradas=[{id:'entrada-1',titulo:'Soporte',operaciones:[storedRef({...ref,id:op})],campos:{transferencias:pendingRATField(),medidas:pendingRATField()},responsables:[{id:'entidad-1',responsable:{nombre:'Cliente A',contacto:'Canal A'},representante:pendingRATField(),dpd:pendingRATField(),categorias:{estado:'conocido',contenido:'Alojamiento',motivo:''},finalidades:pendingRATField()}],evidencias:[]}];
  const body=ratRecordBody(d,storedRef(ref),[],'Prueba',contract);expect(body.entradas[0].responsables[0].categorias.contenido).toBe('Alojamiento');expect(body.entradas[0].responsables[0].finalidades.estado).toBe('pendiente');expect(body.entradas[0].campos).not.toHaveProperty('datos');
});
test('historical favourable remains distinct from changed current bases',()=>{
  render(<RatStatus dto={{estadoRAT:{seRefiereAVersionActual:4,satisfaccionActual:'requiere_revision',conclusionHistorica:'favorable',requiereRevision:true,motivos:['operacion_modificada'],cubrePeriodo:true}}}/>);
  expect(screen.getByText(/versión 4: Requiere revisión/)).toBeInTheDocument();expect(screen.getByText(/Conclusión histórica: Favorable/)).toBeInTheDocument();
});
test.each([403,503])('failed RAT contract %s never loads fictional records',async status=>{
  render(<RatWorkspace api={{get:jest.fn().mockRejectedValue({status,message:'Contrato inaccesible'})}} base={base}/>);
  await screen.findByText('Contrato inaccesible');expect(screen.queryByRole('button',{name:'Preparar un RAT'})).not.toBeInTheDocument();
});
test('function switch cancels without losing entry; acceptance resets draft only',async()=>{
  render(<RatEditor api={{get:jest.fn().mockResolvedValue({alcances:[],operaciones:[],registros:[]})}} base={base} contract={contract}/>);
  click(/Actividades del registro/);click('Añadir actividad al registro');fireEvent.change(screen.getByLabelText('Título de la actividad'),{target:{value:'Actividad conservada'}});click(/Identidad y perímetro/);
  const confirm=jest.spyOn(window,'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  try{fireEvent.change(screen.getByLabelText('Función del registro'),{target:{value:'encargado'}});expect(screen.getByLabelText('Función del registro')).toHaveValue('responsable');click(/Actividades del registro/);expect(screen.getByLabelText('Título de la actividad')).toHaveValue('Actividad conservada');click(/Identidad y perímetro/);fireEvent.change(screen.getByLabelText('Función del registro'),{target:{value:'encargado'}});click(/Actividades del registro/);expect(screen.queryByLabelText('Título de la actividad')).not.toBeInTheDocument();}finally{confirm.mockRestore();}
});
test('RAT editor preserves draft on 409 and sends real route with version only',async()=>{
  const api={get:jest.fn().mockResolvedValue({alcances:[],registros:[]}),write:jest.fn().mockRejectedValue({status:409,message:'Conflicto'})};render(<RatEditor api={api} base={base} contract={contract} data={dto()} onSaved={()=>{}} onRestart={()=>{}}/>);
  fireEvent.change(screen.getByLabelText('Nombre del registro'),{target:{value:'Borrador B'}});fireEvent.change(screen.getByLabelText('Motivo del registro o cambio'),{target:{value:'Actualizar'}});click('Guardar versión del RAT');await screen.findByText('Tu borrador sigue aquí');expect(screen.getByLabelText('Nombre del registro')).toHaveValue('Borrador B');expect(api.write.mock.calls[0][0].path).toBe(ratPath(base,'registros-rat',id));expect(JSON.parse(api.write.mock.calls[0][0].body).version).toBe(1);expect(screen.getByRole('button',{name:'Guardar versión del RAT'})).toBeDisabled();
});
test('RAT review does not preselect favourable and sends motivated unknown as immutable review',async()=>{
  const api={get:jest.fn().mockResolvedValue({registros:[]}),write:jest.fn().mockResolvedValue({})};render(<RatReview api={api} base={base} contract={contract} record={dto()} onSaved={()=>{}}/>);
  expect(screen.getByLabelText('Valoración · 1')).toHaveValue('');
  for(const [label,value] of [['Periodo examinado · desde','2026-10-14'],['Periodo examinado · hasta','2026-10-15'],['Fecha y hora en que se examinó','2026-10-15T10:00'],['Valoración · 1','no_determinado'],['Motivo · 1','Faltan datos'],['Motivo del registro o cambio','Examen parcial']])fireEvent.change(screen.getByLabelText(label),{target:{value}});
  click('Guardar en el servidor');await waitFor(()=>expect(api.write).toHaveBeenCalledTimes(1));const job=api.write.mock.calls[0][0],body=JSON.parse(job.body);expect(job.method).toBe('POST');expect(body.registro).toEqual(ref);expect(body.revisionAnterior).toBeNull();expect(body.conclusion).toBe('no_determinado');expect(body.evidencias).toEqual([]);
});

test('action requires explicit parent comparison and confirmation; cancel preserves old reference',async()=>{
  const member='f'.repeat(24),action={id:op,version:1,contenido:{actuacionRAT:{registro:ref,titulo:'Revisar',descripcion:'Trabajo sintético',responsableMembresiaId:member,estado:'pendiente'}}};
  const api={get:jest.fn(path=>Promise.resolve(path.includes('/responsables')?{responsables:[{membresiaId:member,nombre:'Responsable QA'}]}:dto(2))),write:jest.fn().mockResolvedValue({})};
  render(<RatAction api={api} base={base} contract={contract} data={action} onSaved={()=>{}} onRestart={()=>{}}/>);
  const link=await screen.findByRole('button',{name:'He revisado el RAT; vincular esta actuación a la versión 2'});
  expect(screen.getByRole('button',{name:'Guardar en el servidor'})).toBeDisabled();
  const confirm=jest.spyOn(window,'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  try{fireEvent.click(link);expect(screen.getByText(/Versión vinculada a este borrador: 1/)).toBeInTheDocument();expect(api.write).not.toHaveBeenCalled();fireEvent.click(link);expect(screen.getByText(/Versión vinculada a este borrador: 2/)).toBeInTheDocument();expect(api.write).not.toHaveBeenCalled();fireEvent.change(screen.getByLabelText('Motivo del registro o cambio'),{target:{value:'Examinada v2 y trabajo todavía pertinente'}});click('Guardar en el servidor');await waitFor(()=>expect(api.write).toHaveBeenCalledTimes(1));expect(JSON.parse(api.write.mock.calls[0][0].body).registro).toEqual({...ref,version:2});}finally{confirm.mockRestore();}
});

test('action cannot relink to a different RAT or failed parent lookup',async()=>{
  const member='f'.repeat(24),action={id:op,version:1,contenido:{actuacionRAT:{registro:ref,titulo:'Revisar',descripcion:'Trabajo',responsableMembresiaId:member,estado:'pendiente'}}};
  const api={get:jest.fn(path=>path.includes('/responsables')?Promise.resolve({responsables:[]}):Promise.reject({status:403,message:'RAT no accesible'})),write:jest.fn()};
  render(<RatAction api={api} base={base} contract={contract} data={action}/>);await screen.findByText('RAT no accesible');expect(screen.getByRole('button',{name:'Guardar en el servidor'})).toBeDisabled();expect(screen.queryByRole('button',{name:/He revisado el RAT/})).not.toBeInTheDocument();expect(api.write).not.toHaveBeenCalled();
});

test('successful action creation navigates without unsaved-draft prompt',async()=>{
  const member='f'.repeat(24),created={id:op,tipo:'actuacion_rat',version:1,versionActual:1,referencia:{...ref,id:op},revision:{registradoEn:'2026-10-16T00:00:00Z',motivo:'QA'},permisos:{actualizar:true},contenido:{actuacionRAT:{registro:ref,titulo:'Trabajo guardado',descripcion:'Revisar inventario',estado:'pendiente',responsableMembresiaId:member}}};
  const api={get:jest.fn(path=>Promise.resolve(path.endsWith('/rat/contrato')?{contrato:contract,permisos:{crear:true}}:path.includes('/responsables')?{responsables:[{membresiaId:member,nombre:'QA'}]}:path.includes('/versiones')?{versiones:[]}:path===ratPath(base,'registros-rat',id)?dto():path===ratPath(base,'actuaciones-rat',op)?created:{registros:path.startsWith(ratPath(base,'registros-rat')+'?')?[dto()]:[]})),write:jest.fn().mockResolvedValue(created)};
  const confirm=jest.spyOn(window,'confirm').mockReturnValue(false);
  try{render(<RatWorkspace api={api} base={base}/>);await screen.findByRole('button',{name:'Consultar registro'});click('Consultar registro');await screen.findByRole('button',{name:'Preparar actuación del RAT'});click('Preparar actuación del RAT');await screen.findByRole('option',{name:'QA'});fireEvent.change(screen.getByLabelText('Trabajo a realizar'),{target:{value:'Trabajo guardado'}});fireEvent.change(screen.getByLabelText('Descripción del trabajo'),{target:{value:'Revisar inventario'}});fireEvent.change(screen.getByLabelText('Responsable del trabajo'),{target:{value:member}});fireEvent.change(screen.getByLabelText('Motivo del registro o cambio'),{target:{value:'QA'}});click('Guardar en el servidor');await screen.findByRole('heading',{name:'Trabajo guardado'});expect(confirm).not.toHaveBeenCalled();expect(api.write).toHaveBeenCalledTimes(1);}finally{confirm.mockRestore();}
});
