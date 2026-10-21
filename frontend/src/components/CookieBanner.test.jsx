import React, {useState} from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import CookieBanner,{ModalLegal,TEXTOS_LEGALES} from './CookieBanner';
import {ProductFooter} from '../product/ProductFrame';
import {STORAGE_KEY} from '../hooks/useConsentimientoCookies';
beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());
function storage() { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
test('notice is non-modal, has no optional consent actions and dismissal disables old flags only', () => {
  localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,analitica:true,marketing:true,preferencias:true}));
  localStorage.setItem('demo-fixture','unchanged'); localStorage.setItem('session-fixture','unchanged');
  render(<CookieBanner/>);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Aceptar todo'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Cerrar aviso de almacenamiento'}));
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(storage()).toMatchObject({version:2,avisoLeido:true,analitica:false,marketing:false,preferencias:false});
  expect(localStorage.getItem('demo-fixture')).toBe('unchanged');
  expect(localStorage.getItem('session-fixture')).toBe('unchanged');
});
test('read notice stays dismissed after remount without a fictitious 365-day promise', () => {
  const first=render(<CookieBanner/>); fireEvent.click(screen.getByRole('button',{name:'Entendido'})); first.unmount();
  render(<CookieBanner/>); expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
});
test('unavailable storage never traps the user', () => {
  jest.spyOn(Storage.prototype,'setItem').mockImplementation(() => {throw new Error('storage denied');});
  render(<CookieBanner/>); fireEvent.click(screen.getByRole('button',{name:'Entendido'}));
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
});
test.each(['{bad','null','{}'])('invalid stored data %s shows the notice', raw => {
  localStorage.setItem(STORAGE_KEY,raw); render(<CookieBanner/>);
  expect(screen.getByRole('complementary',{name:'Información de almacenamiento'})).toBeInTheDocument();
});
test('footer exposes persistent privacy and storage controls with real effect', () => {
  localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,analitica:true}));
  render(<MemoryRouter><ProductFooter/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Sesión y almacenamiento'}));
  fireEvent.click(screen.getByRole('button',{name:'Desactivar opciones del panel anterior'}));
  expect(storage().analitica).toBe(false);
  expect(screen.getByRole('status')).toHaveTextContent('La demo y la sesión se conservan');
  fireEvent.click(screen.getByRole('button',{name:'Volver'}));
  fireEvent.click(screen.getByRole('button',{name:'Privacidad'}));
  expect(screen.getByRole('dialog')).toHaveTextContent('José Luis Burguera Gómez');
  expect(screen.getByRole('dialog')).toHaveTextContent('normativacheck@gmail.com');
});
test('modal supports Escape, focus return and keyboard containment', () => {
  function Harness() { const [open,setOpen]=useState(false); return <><button onClick={()=>setOpen(true)}>Abrir</button>{open&&<ModalLegal tipo="privacidad" onCerrar={()=>setOpen(false)}/>}</>; }
  render(<Harness/>); const opener=screen.getByRole('button',{name:'Abrir'}); opener.focus(); fireEvent.click(opener);
  const close=screen.getByRole('button',{name:'Cerrar información'}); expect(close).toHaveFocus();
  fireEvent.keyDown(close,{key:'Tab',shiftKey:true}); expect(screen.getByRole('button',{name:'Volver'})).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('button',{name:'Volver'}),{key:'Tab'}); expect(close).toHaveFocus();
  fireEvent.keyDown(close,{key:'Escape'}); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(opener).toHaveFocus();
});
test('unavailable storage is reported honestly from persistent controls', () => {
  jest.spyOn(Storage.prototype,'setItem').mockImplementation(() => {throw new Error('storage denied');});
  render(<ModalLegal tipo="cookies" onCerrar={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Desactivar opciones del panel anterior'}));
  expect(screen.getByRole('status')).toHaveTextContent('no permite guardar');
});
test('no inherited entity, emails, retention or blanket legal basis in active texts', () => {
  const content=JSON.stringify(TEXTOS_LEGALES);
  expect(content).not.toMatch(/Evolve Academy|cyber-law\.app|30 días|6\.1\.b|No cedemos datos|Juzgados y Tribunales/);
  expect(content).toContain('no constituye una política de privacidad definitiva');
  expect(content).toContain('plazos de conservación');
});
test('remembering a session does not promise longer absolute or inactivity limits', () => {
  const session=TEXTOS_LEGALES.cookies.secciones.find(([title])=>title==='Tu cuenta')[1];
  expect(session).toContain('al cerrar y volver a abrir el navegador');
  expect(session).toContain('sin ampliar los mismos límites');
  expect(session).toContain('8 horas desde el acceso y 30 minutos sin actividad');
  expect(session).not.toContain('amplía su duración');
});
test('storage information distinguishes the optional account guide from the fictitious demo', () => {
  render(<CookieBanner/>);
  expect(screen.getByRole('complementary',{name:'Información de almacenamiento'})).toHaveTextContent('la guía de uso de tu cuenta');
  fireEvent.click(screen.getByRole('button',{name:'Ver información'}));
  const guide=TEXTOS_LEGALES.cookies.secciones.find(([title])=>title==='Guía de uso de la cuenta')[1];
  expect(guide).toContain('por cuenta');
  expect(guide).toContain('No guarda allí contraseñas, documentos ni datos de la empresa');
  expect(screen.getByRole('dialog')).toHaveTextContent('Este progreso no se sincroniza con otros dispositivos');
});
test('privacy account contact separates identity, contact and sender clarification into three paragraphs',()=>{
  render(<ModalLegal tipo="privacidad" onCerrar={()=>{}}/>);
  const section=screen.getByRole('heading',{name:'Responsable de los datos de las cuentas'}).parentElement;
  expect(Array.from(section.querySelectorAll('p'),p=>p.textContent)).toEqual([
    'José Luis Burguera Gómez.',
    'Contacto para consultas y solicitudes de privacidad: normativacheck@gmail.com.',
    'Este contacto no identifica al remitente técnico de los correos de verificación o recuperación.',
  ]);
});
