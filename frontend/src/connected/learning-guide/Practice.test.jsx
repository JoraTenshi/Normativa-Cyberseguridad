import React, {useState} from 'react';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import LearningGuideProvider, {useLearningSurface} from './LearningGuide';
import {usePracticeTarget,usePracticeRemote,journey} from './Practice';
import {readPractice,parsePractice,practiceKey} from './practice-progress';
import {storageKey} from './progress';
import {confirmLeave,markDraft} from '../draft-state';

let mockAuth;
jest.mock('../../context/AuthContext',()=>({useAuth:()=>mockAuth}));
beforeEach(()=>{mockAuth={user:{id:'learner'},phase:'authenticated',generation:1};localStorage.clear();window.matchMedia=()=>({matches:true});Element.prototype.scrollIntoView=jest.fn();});
afterEach(()=>{markDraft('practice-test',false);jest.restoreAllMocks();});
const api={get:jest.fn()};
function List({base}) {
 const [filter,setFilter]=useState('active');
 const remote=usePracticeRemote(api,'/docs?'+filter,'documents',base,'documentos');
 return <><select ref={remote.practiceRef} aria-label="Filtro real" onChange={e=>{remote.armPractice();setFilter(e.target.value);}} value={filter}><option value="active">Activos</option><option value="archived">Archivados</option></select>{remote.error&&<p>Error real</p>}</>;
}
function Workspace({org='org-a',role='administrador',ready=true}) {
 const [section,setSection]=useState('overview');
 const base='/organizaciones/'+org;
 const root=useLearningSurface({id:'work',kind:'workspace',chapter:'entry',section,scope:org+':'+role,practiceScope:base,role,ready,priority:3,navigate:next=>{if(!confirmLeave())return false;setSection(next);return true;}});
 const company=usePracticeTarget('company',base,ready);
 return <main ref={root}><p>Pantalla {section}</p><button ref={company.root} onClick={()=>company.observe('practiced')}>Empresa y permisos</button><input aria-label="Borrador"/>{section==='documents'&&<List base={base}/>}</main>;
}
function App(props){return <MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><LearningGuideProvider><Workspace {...props}/></LearningGuideProvider></MemoryRouter>;}
function start(){fireEvent.click(screen.getByRole('button',{name:'Tus primeros pasos'}));}
function documents(){fireEvent.click(screen.getByRole('button',{name:/Localiza tu documentación/}));fireEvent.click(screen.getByRole('button',{name:'Ir a practicar'}));}

test('5 objectives and separate evidence: viewing or understanding does not simulate practice',()=>{
 render(<App/>);start();expect(screen.getByText(/0 de 5 prácticas observadas/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Lo he comprendido'}));
 expect(readPractice('learner').value.steps.company).toEqual({seen:true,understood:true});
 fireEvent.click(screen.getByRole('button',{name:'Empresa y permisos'}));
 expect(readPractice('learner').value.steps.company.practiced).toBeUndefined();
 fireEvent.click(screen.getByRole('button',{name:'Ir a practicar'}));fireEvent.click(screen.getByRole('button',{name:'Empresa y permisos'}));
 expect(readPractice('learner').value.steps.company.practiced).toBe(true);
 expect(screen.getByText(/1 de 5 prácticas observadas/)).toBeInTheDocument();
 expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Señalar el control'}));
 expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({behavior:'auto',block:'center'});
});
test('a filter needs a new successful response, not arrival, loading or an error',async()=>{
 let resolve;api.get.mockResolvedValueOnce({documentos:[{id:'private-id'}]}).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 render(<App/>);start();documents();await waitFor(()=>expect(api.get).toHaveBeenCalled());
 expect(readPractice('learner').value.steps.documents.practiced).toBeUndefined();
 fireEvent.change(screen.getByLabelText('Filtro real'),{target:{value:'archived'}});
 expect(readPractice('learner').value.steps.documents.practiced).toBeUndefined();
 await act(async()=>resolve({documentos:[{id:'private-id',title:'SECRET'}]}));
 expect(readPractice('learner').value.steps.documents.practiced).toBe(true);
 expect(localStorage.getItem(practiceKey('learner'))).not.toMatch(/SECRET|private-id|org-a/);
});
test('empty success is explored without data, not a practiced record',async()=>{
 api.get.mockReset().mockResolvedValue({documentos:[]});render(<App/>);start();documents();
 await screen.findByRole('button',{name:'He explorado el estado sin datos'});
 fireEvent.click(screen.getByRole('button',{name:'He explorado el estado sin datos'}));
 expect(readPractice('learner').value.steps.documents).toEqual({seen:true,empty:true});
 expect(screen.getByText(/0 de 5 prácticas observadas · 1 exploradas sin datos/)).toBeInTheDocument();
});
test('failed filter never marks a practice or invents data',async()=>{
 api.get.mockReset().mockResolvedValueOnce({documentos:[]}).mockRejectedValueOnce(Error('offline'));
 render(<App/>);start();documents();await screen.findByRole('button',{name:'He explorado el estado sin datos'});
 fireEvent.change(screen.getByLabelText('Filtro real'),{target:{value:'archived'}});await screen.findByText('Error real');
 expect(readPractice('learner').value.steps.documents).toEqual({seen:true});
 expect(screen.queryByRole('button',{name:'He explorado el estado sin datos'})).toBeNull();
});
test.each(['consulta','colaborador'])('%s has a permitted document equivalent, not tasks',role=>{
 render(<App role={role}/>);start();expect(screen.queryByRole('button',{name:/Relaciona una tarea/})).toBeNull();
 expect(screen.getByRole('button',{name:/Consulta el contexto de un documento/})).toBeInTheDocument();
 expect(journey(role)).toHaveLength(5);
});
test.each(['org','role','account','lock'])('%s changes pause and do not leak practice',async kind=>{
 const view=render(<App/>);start();fireEvent.click(screen.getByRole('button',{name:'Ir a practicar'}));
 if(kind==='account')mockAuth={...mockAuth,user:{id:'other'}};
 if(kind==='lock')mockAuth={...mockAuth,phase:'locked',generation:2};
 view.rerender(<App org={kind==='org'?'org-b':'org-a'} role={kind==='role'?'consulta':'administrador'}/>);
 await waitFor(()=>expect(screen.queryByRole('complementary')).toBeNull());
 expect(readPractice('other').value.steps).toEqual({});
 expect(document.querySelector('.learning-guide-target')).toBeNull();
});
test('cancel preserves draft and stays on the explanation; accepting only navigates',async()=>{
 api.get.mockReset().mockResolvedValue({documentos:[]});const confirm=jest.spyOn(window,'confirm').mockReturnValue(false);
 render(<App/>);fireEvent.change(screen.getByLabelText('Borrador'),{target:{value:'Keep me'}});markDraft('practice-test',true);
 start();documents();expect(screen.getByText('Pantalla overview')).toBeInTheDocument();expect(screen.getByLabelText('Borrador')).toHaveValue('Keep me');
 expect(readPractice('learner').value.steps.documents.practiced).toBeUndefined();
 confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'Ir a practicar'}));await screen.findByText('Pantalla documents');
 expect(confirm).toHaveBeenCalledTimes(2);
});
test('v1 is untouched; v2 corruption and unknown IDs are rejected',()=>{
 localStorage.setItem(storageKey('learner'),JSON.stringify({version:1,steps:{'documents.locate':'understood'},lastStep:'documents.locate'}));
 expect(readPractice('learner').value.steps).toEqual({});
 expect(()=>parsePractice('{"version":2,"steps":{"company":{"payload":"bad"}},"lastStep":null}')).toThrow();
 expect(()=>parsePractice('{"version":2,"steps":{"bad":{"seen":true}},"lastStep":null}')).toThrow();
 expect(()=>parsePractice('x'.repeat(5001))).toThrow();
 localStorage.setItem(practiceKey('learner'),'broken');expect(readPractice('learner').persistent).toBe(false);
});
test('quota failure keeps progress in the mounted session and close restores focus',()=>{
 jest.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota');});render(<App/>);start();
 fireEvent.click(screen.getByRole('button',{name:'Lo he comprendido'}));expect(screen.getByText(/Comprendido por ti/)).toBeInTheDocument();
 fireEvent.keyDown(document,{key:'Escape'});expect(screen.getByRole('button',{name:'Guía de uso'})).toHaveFocus();
 start();expect(screen.getByText(/Comprendido por ti/)).toBeInTheDocument();
});
test('resume restores only the explanation, never navigation or evidence of practice',()=>{
 localStorage.setItem(practiceKey('learner'),JSON.stringify({version:2,steps:{documents:{seen:true}},lastStep:'documents'}));
 render(<App/>);start();expect(screen.getByText('Paso 3 de 5')).toBeInTheDocument();
 expect(screen.getByText('Pantalla overview')).toBeInTheDocument();
 expect(readPractice('learner').value.steps.documents).toEqual({seen:true});
});
test('a pending response after changing company cannot earn progress in the new company',async()=>{
 let resolve;api.get.mockReset().mockResolvedValueOnce({documentos:[]}).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 const view=render(<App/>);start();documents();await screen.findByRole('button',{name:'He explorado el estado sin datos'});
 fireEvent.change(screen.getByLabelText('Filtro real'),{target:{value:'archived'}});
 view.rerender(<App org="org-b"/>);await act(async()=>resolve({documentos:[{id:'old-company'}]}));
 expect(readPractice('learner').value.steps.documents.practiced).toBeUndefined();
 expect(screen.queryByRole('complementary')).toBeNull();
});
