import React, { useEffect, useRef, useState } from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { MemoryRouter, createMemoryRouter, RouterProvider, Outlet } from 'react-router-dom';
import LearningGuideProvider, { LearningRouteSurface, useLearningSurface } from './LearningGuide';
import { readProgress, storageKey } from './progress';
import { confirmLeave, markDraft } from '../draft-state';
import DraftNavigationGuard from '../../session/DraftNavigationGuard';

let mockAuth;
jest.mock('../../context/AuthContext', () => ({ useAuth:() => mockAuth }));
let motion, mediaListener;
beforeEach(() => {
  mockAuth = {user:{id:'account-a'},phase:'authenticated',generation:1};
  window.localStorage.clear();
  motion = {matches:false, addEventListener:jest.fn((type, fn) => { mediaListener = fn; }), removeEventListener:jest.fn()};
  window.matchMedia = jest.fn(() => motion);
  Element.prototype.scrollIntoView = jest.fn();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
});
afterEach(() => { markDraft('learning-test', false); jest.restoreAllMocks(); jest.useRealTimers(); });

function Workspace({ role = 'administrador', org = 'org-a', ready = true, navigateSpy = () => {} }) {
  const [section, setSection] = useState('overview'), heading = useRef(null);
  const root = useLearningSurface({id:'workspace',kind:'workspace',chapter:'entry',priority:3,role,
    scope:org+':'+role,section,ready,heading,navigate:next => {
      navigateSpy(next); if (!confirmLeave()) return false; setSection(next); return true;
    }});
  return <main ref={root}><h1 ref={heading} tabIndex={-1}>Pantalla {section}</h1><input aria-label="Trabajo sin guardar" defaultValue=""/>
    <button onClick={() => setSection('spaces')}>Navegación manual a servicios</button></main>;
}
function App(props) {
  return <MemoryRouter initialEntries={['/espacio-de-trabajo']} future={{v7_startTransition:true,v7_relativeSplatPath:true}}><LearningGuideProvider><Workspace {...props}/></LearningGuideProvider></MemoryRouter>;
}
const openGuide = () => fireEvent.click(screen.getByRole('button', {name:'Guía de uso'}));
const choose = title => fireEvent.click(within(screen.getByRole('navigation', {name:'Capítulos de aprendizaje'})).getByRole('button', {name:new RegExp(title)}));

test('optional nonmodal guide highlights real mounted content; no auto completion or business action', () => {
  const navigate = jest.fn(); render(<App navigateSpy={navigate}/>);
  expect(screen.queryByRole('complementary')).toBeNull(); openGuide(); choose('Vista general');
  expect(screen.queryByRole('dialog')).toBeNull();
  const input = screen.getByLabelText('Trabajo sin guardar');
  fireEvent.change(input, {target:{value:'Puedo seguir trabajando'}});
  expect(input).toHaveValue('Puedo seguir trabajando');
  expect(document.querySelector('.learning-guide-target')).toBe(screen.getByRole('heading', {name:'Pantalla overview'}));
  expect(readProgress('account-a').value.steps['overview.locate']).toBe('visited');
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name:'Siguiente'}));
  expect(readProgress('account-a').value.steps['overview.locate']).toBe('visited');
  fireEvent.click(screen.getByRole('button', {name:'Ver'}));
  expect(readProgress('account-a').value.steps['overview.understand']).toBe('visited');
  expect(Object.values(readProgress('account-a').value.steps)).not.toContain('understood');
  expect(input).toHaveValue('Puedo seguir trabajando');
});

test.each(['administrador','colaborador','consulta'])('chapter catalogue and navigation respect %s', async role => {
  render(<App role={role}/>); openGuide();
  const nav = screen.getByRole('navigation', {name:'Capítulos de aprendizaje'});
  expect(within(nav).getAllByRole('button')).toHaveLength(role === 'administrador' ? 17 : 8);
  if (role !== 'administrador') expect(within(nav).queryByRole('button', {name:/Tareas y responsables/})).toBeNull();
  choose('Documentación');
  await screen.findByRole('heading', {name:'Documentación'});
  expect(screen.getByRole('heading', {name:'Pantalla documents'})).toHaveClass('learning-guide-target');
  expect(readProgress('account-a').value.steps['documents.locate']).toBe('visited');
});

test('cancel workspace discard preserves draft, section and progress; accepting uses existing guard', async () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  render(<App/>); const input = screen.getByLabelText('Trabajo sin guardar');
  fireEvent.change(input, {target:{value:'No borrar'}}); markDraft('learning-test', true);
  openGuide(); choose('Documentación');
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('heading', {name:'Pantalla overview'})).toBeInTheDocument();
  expect(input).toHaveValue('No borrar');
  expect(readProgress('account-a').value.lastStep).toBeNull();
  confirm.mockReturnValue(true); choose('Documentación');
  await screen.findByRole('heading', {name:'Documentación'});
  expect(confirm).toHaveBeenCalledTimes(2);
});

test('close/escape is always available, returns focus and resume does not restore business state', () => {
  render(<App/>); openGuide(); choose('Vista general');
  fireEvent.click(screen.getByRole('button', {name:'Siguiente'}));
  fireEvent.keyDown(document, {key:'Escape'});
  expect(screen.queryByRole('complementary')).toBeNull();
  expect(screen.getByRole('button', {name:'Guía de uso'})).toHaveFocus();
  expect(document.querySelector('.learning-guide-target')).toBeNull();
  openGuide(); fireEvent.click(screen.getByRole('button', {name:'Retomar donde lo dejé'}));
  expect(screen.getByText(/Objetivo 2 de 2/)).toBeInTheDocument();
  expect(screen.getByRole('button', {name:'Siguiente'})).toBeDisabled();
  fireEvent.click(screen.getByRole('link', {name:'Índice de capítulos'}));
  expect(readProgress('account-a').value.steps['overview.understand']).toBe('visited');
  expect(screen.getByRole('navigation', {name:'Capítulos de aprendizaje'})).toBeInTheDocument();
});

test('security dialog owns Escape; the guide does not close it or trap keyboard focus', () => {
  const view = render(<><App/><dialog open aria-label="Aviso de seguridad"><button>Confirmar fuera de la guía</button></dialog></>);
  openGuide(); fireEvent.keyDown(document, {key:'Escape'});
  expect(screen.getByRole('complementary')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toHaveAttribute('open');
  view.unmount(); expect(document.querySelector('.learning-guide-target')).toBeNull();
});

test('reduced motion applies initially and updates live without disabling interaction', () => {
  motion.matches = true; render(<App/>); openGuide(); choose('Vista general');
  fireEvent.click(screen.getByRole('button', {name:'Ver'}));
  expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({behavior:'auto',block:'center'});
  act(() => {motion.matches = false; mediaListener();});
  fireEvent.click(screen.getByRole('button', {name:'Ver'}));
  expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({behavior:'smooth',block:'center'});
  expect(screen.getByRole('button', {name:'Cerrar y pausar la guía'})).toBeEnabled();
});

test.each(['org','role','generation','locked','account'])('%s change pauses and does not leak old context', async change => {
  const view = render(<App/>); openGuide(); choose('Vista general');
  fireEvent.click(screen.getByRole('button', {name:'Ver'}));
  let props = {};
  if (change === 'org') props.org = 'org-b';
  if (change === 'role') props.role = 'consulta';
  if (change === 'generation') mockAuth = {...mockAuth,generation:2};
  if (change === 'locked') mockAuth = {...mockAuth,phase:'locked'};
  if (change === 'account') mockAuth = {...mockAuth,user:{id:'account-b'}};
  view.rerender(<App {...props}/>);
  await waitFor(() => expect(screen.queryByRole('complementary')).toBeNull());
  expect(document.querySelector('.learning-guide-target')).toBeNull();
  if (change === 'locked') expect(screen.queryByRole('button', {name:'Guía de uso'})).toBeNull();
  if (change === 'account') {
    openGuide(); expect(screen.getByRole('navigation', {name:'Capítulos de aprendizaje'})).toBeInTheDocument();
    expect(readProgress('account-b').value.lastStep).toBeNull();
  }
});

test('membership recheck gap cannot conceal an organization change', () => {
  const view = render(<App/>); openGuide(); choose('Vista general');
  view.rerender(<App ready={false}/>); expect(screen.queryByRole('complementary')).toBeNull();
  view.rerender(<App org="org-b"/>); expect(screen.queryByRole('complementary')).toBeNull();
});

test('storage quota failures preserve the app and in-memory last viewed step', () => {
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
  render(<App/>); openGuide(); choose('Vista general');
  fireEvent.click(screen.getByRole('button', {name:'Siguiente'}));
  expect(screen.getByText(/almacenamiento no está disponible/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', {name:'Índice de capítulos'}));
  fireEvent.click(screen.getByRole('button', {name:'Retomar donde lo dejé'}));
  expect(screen.getByText('Objetivo 2 de 2')).toBeInTheDocument();
});

test('corrupt progress is not rendered; unknown IDs cannot become routes or markup', () => {
  localStorage.setItem(storageKey('account-a'), '{"version":1,"steps":{"<script>":"understood"},"lastStep":"/malicious"}');
  render(<App/>); openGuide();
  expect(screen.queryByText('/malicious')).toBeNull();
  expect(screen.queryByRole('button', {name:'Retomar donde lo dejé'})).toBeNull();
  expect(screen.getByText(/registro anterior no era válido/)).toBeInTheDocument();
});

function AccountDraft() {
  useEffect(() => () => markDraft('learning-test', false), []);
  return <main><h1>Tu cuenta</h1><input aria-label="Borrador de cuenta" onChange={e => markDraft('learning-test', !!e.target.value)}/></main>;
}
function RoutingLayout() {
  return <><DraftNavigationGuard/><LearningGuideProvider><LearningRouteSurface><Outlet/></LearningRouteSurface></LearningGuideProvider></>;
}
test('cross-route guide respects the real Router blocker: cancel then accept without marking unvisited route', async () => {
  const router = createMemoryRouter([{element:<RoutingLayout/>,children:[
    {path:'/settings',element:<AccountDraft/>},{path:'/historial',element:<h1>Evaluaciones de la cuenta</h1>}
  ]}], {initialEntries:['/settings'],future:{v7_relativeSplatPath:true}});
  const view = render(<RouterProvider router={router} future={{v7_startTransition:true}}/>);
  fireEvent.change(screen.getByLabelText('Borrador de cuenta'), {target:{value:'Conservar'}});
  openGuide(); choose('Evaluaciones guardadas');
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/settings');
  fireEvent.click(screen.getByRole('button', {name:'Seguir editando'}));
  expect(screen.getByLabelText('Borrador de cuenta')).toHaveValue('Conservar');
  expect(readProgress('account-a').value.lastStep).toBeNull();
  fireEvent.click(screen.getByRole('button', {name:'Volver a capítulos'}));
  choose('Evaluaciones guardadas');
  fireEvent.click(await screen.findByRole('button', {name:'Descartar y salir'}));
  await screen.findByRole('heading', {name:'Evaluaciones guardadas'});
  expect(router.state.location.pathname).toBe('/historial');
  expect(readProgress('account-a').value.steps['history.locate']).toBe('visited');
  view.unmount(); router.dispose();
});

test('a missing arrival times out with a recoverable menu, never completes a step', () => {
  jest.useFakeTimers();
  function Missing() {
    const root = useLearningSurface({id:'missing',kind:'workspace',chapter:'entry',role:'administrador',ready:true,section:'overview',navigate:() => true});
    return <main ref={root}>Sin destino disponible</main>;
  }
  render(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><LearningGuideProvider><Missing/></LearningGuideProvider></MemoryRouter>);
  openGuide(); choose('Documentación');
  expect(screen.getByText(/Esperando la sección/)).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(8000));
  expect(screen.getByText(/No hemos llegado a esa sección/)).toBeInTheDocument();
  expect(screen.getByRole('button', {name:'Cerrar y pausar la guía'})).toBeEnabled();
  expect(readProgress('account-a').value.lastStep).toBeNull();
});
