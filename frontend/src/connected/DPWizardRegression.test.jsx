import React from 'react';
import {render,screen,fireEvent,act,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import {Simulate} from 'react-dom/test-utils';
import DPCaseEditor from './DPCaseEditor';
import DPUnitEditor from './DPUnitEditor';
import {newCaseDraft} from './dp-case-model';
const rights=require('../../../backend/contracts/solicitudDerechos.v1.json');
const eipd=require('../../../backend/contracts/deteccionEIPD.v1.json');
const units=require('../../../backend/contracts/unidadDP.v1.json');
const id='a'.repeat(24),op='b'.repeat(24),scope='c'.repeat(24),hash='d'.repeat(64),base='/organizaciones/'+id;
const ref=id=>({id,version:1,sha256:hash});
const record={id:scope,version:1,versionActual:1,referencia:ref(scope),revision:{numero:1,sha256:hash},contenido:{alcance:{nombre:'Alcance QA'}}};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
beforeEach(()=>Object.defineProperty(global,'crypto',{configurable:true,value:{randomUUID:()=> 'qa-wizard-write-key'}}));

test.each(['solicitud_derechos','pretension_derecho','deteccion_eipd','unidad_informativa'])('%s cannot unmount a pending reference by changing blocks',async type=>{
 const job=deferred();const api={get:jest.fn(p=>p===base+'/alcances/'+scope?job.promise:Promise.resolve({alcances:[record],operaciones:[],registros:[]})),write:jest.fn()};
 const unit=type==='unidad_informativa';
 render(unit?<DPUnitEditor api={api} base={base} contract={units} clase={type}/>:<DPCaseEditor api={api} base={base} type={type} contract={type==='deteccion_eipd'?eipd:rights}/>);
 if(!unit)fireEvent.click(screen.getByRole('button',{name:'2. Contexto y referencias'}));
 await screen.findByRole('option',{name:'Alcance QA · v1'});
 fireEvent.change(screen.getByLabelText(unit?'Alcance de esta unidad':'Alcances del caso'),{target:{value:scope}});
 fireEvent.click(screen.getByRole('button',{name:'Siguiente bloque'}));
 expect(screen.getByLabelText(unit?'Alcance de esta unidad':'Alcances del caso')).toBeVisible();
 expect(screen.getByText(/Espera a que se consulten las referencias/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:unit?'2 Información concreta':'3. Información y valoración'}));
 expect(screen.getByLabelText(unit?'Alcance de esta unidad':'Alcances del caso')).toBeVisible();
 expect(api.write).not.toHaveBeenCalled();
 await act(async()=>job.resolve(record));
 fireEvent.click(screen.getByRole('button',{name:'Siguiente bloque'}));
 expect(screen.queryByLabelText(unit?'Alcance de esta unidad':'Alcances del caso')).not.toBeInTheDocument();
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Bloque anterior'})));
 expect(screen.getByText(/Versión 1 · ccccc/)).toBeVisible();
});

test('failed optional reference must be explicitly cancelled before leaving its block',async()=>{
 const job=deferred(),api={get:jest.fn(p=>p===base+'/alcances/'+scope?job.promise:Promise.resolve({alcances:[record],operaciones:[],registros:[]}))};
 render(<DPCaseEditor api={api} base={base} type="solicitud_derechos" contract={rights}/>);
 fireEvent.click(screen.getByRole('button',{name:'2. Contexto y referencias'}));await screen.findByRole('option',{name:'Alcance QA · v1'});
 fireEvent.change(screen.getByLabelText('Alcances del caso'),{target:{value:scope}});
 await act(async()=>job.reject(new Error('Consulta fallida')));
 fireEvent.click(screen.getByRole('button',{name:'Bloque anterior'}));expect(screen.getByLabelText('Alcances del caso')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Cancelar selección de Alcance QA'}));
 fireEvent.click(screen.getByRole('button',{name:'Bloque anterior'}));expect(screen.getByLabelText('Qué se ha recibido')).toBeVisible();
});

test('EIPD native input event preserves civil date through block changes and PATCH',async()=>{
 const draft=newCaseDraft('deteccion_eipd',eipd);Object.assign(draft,{operacion:ref(op),alcance:ref(scope),fechaEvaluacion:'2026-10-15',motivoContexto:'Pendiente'});Object.values(draft.declaraciones).forEach(d=>d.motivo='Pendiente de analizar');
 const data={id,version:1,contenido:{deteccionEIPD:draft}},api={get:jest.fn().mockResolvedValue({registros:[],alcances:[],operaciones:[]}),write:jest.fn().mockResolvedValue({id})};
 render(<DPCaseEditor api={api} base={base} type="deteccion_eipd" contract={eipd} data={data} onSaved={()=>{}}/>);
 act(()=>Simulate.input(screen.getByLabelText('Fecha de la evaluación orientativa'),{target:{value:'2026-10-16'}}));
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'2. Contexto y referencias'})));
 fireEvent.click(screen.getByRole('button',{name:'1. Datos del caso'}));expect(screen.getByLabelText('Fecha de la evaluación orientativa')).toHaveValue('2026-10-16');
 fireEvent.change(screen.getByLabelText('Motivo del registro o cambio'),{target:{value:'Fecha contrastada'}});fireEvent.click(screen.getByRole('button',{name:'Guardar registro y conservar versión'}));
 await waitFor(()=>expect(api.write).toHaveBeenCalledTimes(1));expect(JSON.parse(api.write.mock.calls[0][0].body).fechaEvaluacion).toBe('2026-10-16');
});

test('receipt native input event preserves a civil date without inventing an instant',async()=>{
 const draft=newCaseDraft('solicitud_derechos',rights);Object.assign(draft,{descripcion:'Recepción QA',motivoContexto:'Pendiente',operaciones:[],alcances:[],evidencias:[]});draft.recepcion.motivo='Registro original';draft.canal.motivo='Pendiente';
 const data={id,version:1,contenido:{solicitudDerechos:draft}},api={get:jest.fn().mockResolvedValue({registros:[],alcances:[],operaciones:[]}),write:jest.fn().mockResolvedValue({id})};
 render(<DPCaseEditor api={api} base={base} type="solicitud_derechos" contract={rights} data={data} onSaved={()=>{}}/>);
 fireEvent.change(screen.getByLabelText('Estado de la recepción'),{target:{value:'conocida'}});act(()=>Simulate.input(screen.getByLabelText('Fecha real de recepción'),{target:{value:'2026-10-16'}}));
 fireEvent.click(screen.getByLabelText('Confirmo la corrección de la recepción respecto a la versión guardada, sin reiniciar plazos'));
 fireEvent.change(screen.getByLabelText('Motivo del registro o cambio'),{target:{value:'Recepción contrastada'}});fireEvent.click(screen.getByRole('button',{name:'Guardar registro y conservar versión'}));
 await waitFor(()=>expect(api.write).toHaveBeenCalledTimes(1));expect(JSON.parse(api.write.mock.calls[0][0].body).recepcion).toMatchObject({fecha:'2026-10-16',instante:null,precision:'fecha_civil'});
});
