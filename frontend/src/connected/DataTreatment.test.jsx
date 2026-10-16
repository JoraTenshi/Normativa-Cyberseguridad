import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataTreatment, { TreatmentEditor } from './DataTreatment';
import { OperationsPage } from './ContextOperations';
import { FactQuestions, OperationFactsEditor } from './NormativeEditors';
import { RouteFacts } from './ReviewEditor';
import { treatmentChanges, typedFactError, validTypedValue } from './typed-facts';

// Contract and API below are test doubles; these tests do not establish real HTTP/Mongo acceptance.
const contract = { id:'OPERACION_DP_E11', version:1, revisionEditorial:2, limites:{ cambiosPorPeticion:50, cuerpoHttpBytes:10240 }, campos:[
  {clave:'dp_rol',tipo:'texto',valores:['responsable','encargado'],pregunta:'Papel en el tratamiento',requiereAnalisis:true,ayuda:'No se deduce de los permisos.'},
  {clave:'dp_fase',tipo:'texto',valores:['prevista','activa','residual','finalizada'],pregunta:'Fase'},
  {clave:'dp_ambito_rgpd',tipo:'booleano',pregunta:'Valoración del ámbito',etiquetasBooleanas:{true:'Incluido según valoración',false:'Excluido justificadamente'}},
  {clave:'rat_personas_empleadas',tipo:'numero',entero:true,minimo:0,maximo:1e12,pregunta:'Personas empleadas'}
] };
const base='/organizaciones/'+ 'a'.repeat(24), id='b'.repeat(24), path=base+'/operaciones/'+id;
const dto=(version=1,hechos=[])=>({operacion:{id,nombre:'Soporte del SaaS',descripcion:'Operación sintética'},contexto:{version,hechos},versionActual:version,revision:{registradoEn:'2026-10-16T00:00:00Z',motivo:'Prueba',sha256:'c'.repeat(64)}});
beforeEach(()=>Object.defineProperty(global,'crypto',{configurable:true,value:{randomUUID:()=> 'd'.repeat(24)}}));
const change=(label,value)=>fireEvent.change(screen.getByLabelText(label),{target:{value}});
const click=text=>fireEvent.click(screen.getByRole('button',{name:text}));
function editor(api={write:jest.fn()}, data=dto(), props={}) {return render(<TreatmentEditor api={api} data={data} path={path} contract={contract} onSaved={()=>{}} onRestart={()=>{}} {...props}/>);}

test('roles and phases keep text, employees keep integer, untouched fields are not inferred',async()=>{
  const api={write:jest.fn().mockResolvedValue(dto(2))};editor(api);
  expect(screen.getByText(/Requiere valoración previa/)).toBeInTheDocument();
  change('Situación · Papel en el tratamiento','conocido');change('Respuesta · Papel en el tratamiento','encargado');
  change('Situación · Fase','conocido');change('Respuesta · Fase','residual');
  click(/Datos para el registro/);change('Situación · Personas empleadas','conocido');change('Respuesta · Personas empleadas','12');
  change('Motivo del registro o cambio','Confirmar actividad');click('Guardar respuestas del tratamiento');
  await waitFor(()=>expect(api.write).toHaveBeenCalledTimes(1));
  expect(JSON.parse(api.write.mock.calls[0][0].body)).toEqual({version:1,motivo:'Confirmar actividad',cambios:[{clave:'dp_rol',estado:'conocido',valor:'encargado'},{clave:'dp_fase',estado:'conocido',valor:'residual'},{clave:'rat_personas_empleadas',estado:'conocido',valor:12}]});
});
test('unknown and conflicts survive unrelated edits without being rewritten',()=>{
  const previous=[{clave:'dp_rol',estado:'conflictivo',alternativas:[{valor:'responsable'},{valor:'encargado'}]},{clave:'dp_ambito_rgpd',estado:'desconocido',motivo:'no_sabe'}];
  expect(treatmentChanges(contract,previous,[...previous,{clave:'dp_fase',estado:'conocido',valor:'activa'}],'Cambio')).toEqual([{clave:'dp_fase',estado:'conocido',valor:'activa'}]);
});
test.each(['', -1, 1.5, '12', true, 1e13])('rejects invalid numeric value %p without coercing it',value=>{
  expect(()=>treatmentChanges(contract,[],[{clave:'rat_personas_empleadas',estado:'conocido',valor:value}],'Cambio')).toThrow();
});
test('clearing number does not become zero and hidden invalid block prevents save',async()=>{
  const api={write:jest.fn()};editor(api);click(/Datos para el registro/);change('Situación · Personas empleadas','conocido');change('Respuesta · Personas empleadas','12');change('Respuesta · Personas empleadas','');
  click(/Actividad y papel/);change('Motivo del registro o cambio','Cambio');click('Guardar respuestas del tratamiento');
  expect(await screen.findByText(/Personas empleadas: Selecciona/)).toBeInTheDocument();expect(api.write).not.toHaveBeenCalled();
});
test('explicit unknown is not false and analysis boolean labels come from contract',async()=>{
  const api={write:jest.fn().mockResolvedValue(dto(2))};editor(api);click(/Ámbito y valoración/);change('Situación · Valoración del ámbito','conocido');expect(screen.getByRole('option',{name:'Excluido justificadamente'})).toBeInTheDocument();change('Situación · Valoración del ámbito','desconocido');change('Motivo del registro o cambio','Falta análisis');click('Guardar respuestas del tratamiento');
  await waitFor(()=>expect(api.write).toHaveBeenCalled());expect(JSON.parse(api.write.mock.calls[0][0].body).cambios).toEqual([{clave:'dp_ambito_rgpd',estado:'desconocido',motivo:'por_consultar'}]);
});
test('contradictory enum alternatives have to be valid and distinct',()=>{
  const field=contract.campos[0];expect(typedFactError(field,{estado:'conflictivo',alternativas:[{valor:'responsable'},{valor:'encargado'}]})).toBeNull();
  expect(typedFactError(field,{estado:'conflictivo',alternativas:[{valor:'responsable'},{valor:'responsable'}]})).not.toBeNull();
});
test.each([403,503])('unavailable contract %s does not show a fake editable questionnaire',async status=>{
  render(<DataTreatment api={{get:jest.fn().mockRejectedValue({status,message:'No disponible'})}} base={base} path={path} data={dto()}/>);
  expect(await screen.findByText('No disponible')).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Guardar respuestas del tratamiento'})).not.toBeInTheDocument();
});
test('409 cancel preserves draft; accept adopts the same snapshot in header and editor without writing again',async()=>{
  const current=dto(2,[{clave:'dp_rol',estado:'conocido',valor:'responsable'}]);let calls=0;
  const api={get:jest.fn(p=>Promise.resolve(p.endsWith('/contrato-dp')?contract:p===path?(++calls===1?dto():current):p.includes('/subespacios')?{subespacios:[]}:{operaciones:[],paginacion:{hayMas:false}})),write:jest.fn().mockRejectedValue({status:409,message:'Versión antigua'})};
  render(<OperationsPage api={api} base={base} initialOperationId={id}/>);
  await screen.findByLabelText('Situación · Papel en el tratamiento');change('Situación · Papel en el tratamiento','conocido');change('Respuesta · Papel en el tratamiento','encargado');change('Motivo del registro o cambio','Borrador B');click('Guardar respuestas del tratamiento');
  await screen.findByText('Tu borrador sigue aquí');click('Consultar versión actual para comparar');await screen.findByRole('button',{name:'Reabrir la versión actual y descartar este borrador'});
  const confirm=jest.spyOn(window,'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  try {click('Reabrir la versión actual y descartar este borrador');expect(screen.getByLabelText('Respuesta · Papel en el tratamiento')).toHaveValue('encargado');click('Reabrir la versión actual y descartar este borrador');expect(screen.getByLabelText('Respuesta · Papel en el tratamiento')).toHaveValue('responsable');expect(screen.getByLabelText('Motivo del registro o cambio')).toHaveValue('');expect(screen.getByText(/Revisión 2 ·/)).toBeInTheDocument();expect(api.write).toHaveBeenCalledTimes(1);} finally {confirm.mockRestore();}
});
test('uncertain retry uses identical serialized payload and key',async()=>{
  const api={write:jest.fn().mockRejectedValueOnce({status:503,message:'Servicio temporalmente inaccesible'}).mockResolvedValueOnce(dto(2))};editor(api);change('Situación · Fase','desconocido');change('Motivo del registro o cambio','Consultar fase');click('Guardar respuestas del tratamiento');
  await screen.findByRole('button',{name:'Reintentar exactamente el mismo envío'});expect(screen.getByLabelText('Situación · Fase')).toBeDisabled();click('Reintentar exactamente el mismo envío');await waitFor(()=>expect(api.write).toHaveBeenCalledTimes(2));expect(api.write.mock.calls[0][0]).toBe(api.write.mock.calls[1][0]);
});
test('normative text questions are not displayed as yes/no',()=>{
  render(<FactQuestions fields={[{...contract.campos[0],pregunta:{grupo:'Actividad',texto:'Rol',motivo:'Delimita la función'}}]} facts={[{clave:'dp_rol',estado:'conocido',valor:'encargado'}]} onChange={()=>{}}/>);
  expect(screen.getByLabelText('Respuesta · Rol')).toHaveValue('encargado');expect(screen.queryByRole('option',{name:'Sí, según los datos disponibles'})).not.toBeInTheDocument();
});
test.each([['2026-02-28',true],['2026-02-30',false],['16/10/2026',false],['',false]])('civil date %s validates without using save date', (value,expected)=>{
  expect(validTypedValue({tipo:'texto',formato:'fecha_civil'},value)).toBe(expected);
});
test('RGPD32 questions obtain typed enums and analysis help from operation contract',async()=>{
  const api={get:jest.fn().mockResolvedValue(contract),write:jest.fn().mockResolvedValue(dto(2))};
  render(<OperationFactsEditor api={api} base={base} operation={dto()} fields={[{clave:'dp_rol',tipo:'texto',pregunta:{grupo:'Tratamiento',texto:'Rol sin opciones',motivo:'Ayuda original'}}]} onSaved={()=>{}}/>);
  await screen.findByLabelText('Situación · Papel en el tratamiento');expect(api.get).toHaveBeenCalledWith(base+'/operaciones/contrato-dp');change('Situación · Papel en el tratamiento','conocido');change('Respuesta · Papel en el tratamiento','encargado');change('Motivo del registro o cambio','Delimitar');click('Guardar en el servidor');await waitFor(()=>expect(api.write).toHaveBeenCalledTimes(1));expect(JSON.parse(api.write.mock.calls[0][0].body).cambios[0].valor).toBe('encargado');
});
test('schema2 route shows required textual value, not a misleading yes',()=>{
  const requirement={contenido:{paquete:{ficha:{satisfaccion:{hechos:[{clave:'lic_base6',pregunta:{texto:'Fundamento'}}]}}},requisito:{resultado:{snapshot:{contexto:{hechos:[{clave:'lic_base6',estado:'conocido',valor:'b'}]}}}}}};
  render(<RouteFacts requirement={requirement} route={{hechosRequeridos:[{clave:'lic_base6',valor:'b'}]}}/>);
  expect(screen.getByText(/respuesta requerida: b/)).toBeInTheDocument();expect(screen.queryByText(/respuesta requerida: Sí/)).not.toBeInTheDocument();
});
