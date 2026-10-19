import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, Link } from 'react-router-dom';
import Auth from './Auth';
import VerifyEmail from './VerifyEmail';
import ResetPassword from './ResetPassword';
import { useAuth } from '../context/AuthContext';
import { register, loginApi, resendVerification, verifyEmail, verify2fa, resetPassword } from '../services/api';
import { REGISTRATION_REQUESTED, VERIFICATION_REQUESTED } from './account-feedback';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../components/CookieBanner', () => ({ PrivacyAccess: () => <span>Privacidad</span> }));
jest.mock('../services/api', () => ({ register: jest.fn(), loginApi: jest.fn(), resendVerification: jest.fn(), verifyEmail: jest.fn(), verify2fa: jest.fn(), resetPassword: jest.fn() }));
const sessionLogin = jest.fn();
const rejection = (error, status = 400, code) => ({ response: { status, data: { error, code } } });
function Location() { const loc = useLocation(); return <div data-testid="route">{loc.pathname}</div>; }
function show(node = <Auth/>, entry = '/auth') { return render(<MemoryRouter initialEntries={[entry]} future={{v7_startTransition:true,v7_relativeSplatPath:true}}>{node}<Location/></MemoryRouter>); }
function fill(label, value) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
function credentials() { fill('Email', 'qa@example.invalid'); fill('Contraseña', 'ExamplePass1'); }
function submitLogin() { credentials(); fireEvent.click(screen.getByRole('button', { name:'Entrar', exact:true })); }
function submitRegistration() { fill('Nombre', 'QA'); credentials(); fireEvent.click(screen.getByRole('button', { name:'Crear cuenta', exact:true })); }
function submitReset(password='ExamplePass1', confirm=password) { fill('Contraseña nueva',password); fill('Repite la contraseña',confirm); fireEvent.click(screen.getByRole('button',{name:'Cambiar contraseña'})); }
beforeEach(() => {
  jest.resetAllMocks(); window.history.replaceState({}, '', '/');
  sessionLogin.mockResolvedValue(true);
  useAuth.mockReturnValue({user:null,phase:'anonymous',login:sessionLogin});
});
afterEach(() => jest.restoreAllMocks());

test.each([false,true])('confirmation is discoverable before login, embedded=%s', embedded => {
  show(<Auth embedded={embedded}/>);
  const link = screen.getByRole('link',{name:/No has confirmado tu correo/});
  expect(link).toHaveAttribute('href','/verify-email');
  const recovery = screen.getByRole('link',{name:/Has olvidado/});
  if (embedded) {
    for (const el of [link,recovery]) { expect(el).toHaveAttribute('target','_blank'); expect(el).toHaveAttribute('rel','noopener noreferrer'); }
    expect(screen.getByText(/Conserva esta pestaña/)).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Registrarse'})).toBeNull();
  }
});
test('navigation to login updates a reused registration form',()=>{
  show(<><Link to="/auth">Header login</Link><Auth/></>,'/auth?modo=registro');
  expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link',{name:'Header login'}));
  expect(screen.queryByLabelText('Nombre')).toBeNull(); expect(screen.getByRole('button',{name:'Entrar'})).toBeInTheDocument();
});
test('late registration response cannot overwrite the login route',async()=>{
  let done; register.mockImplementation(()=>new Promise(resolve=>{done=resolve;}));
  show(<><Link to="/auth">Header login</Link><Auth/></>,'/auth?modo=registro'); submitRegistration();
  fireEvent.click(screen.getByRole('link',{name:'Header login'}));
  await act(async()=>done({registrationRequested:true}));
  expect(screen.queryByRole('heading',{name:'Solicitud recibida'})).toBeNull(); expect(screen.getByRole('button',{name:'Entrar'})).toBeEnabled();
});
test.each(['EMAIL_NOT_VERIFIED',undefined])('unverified rejection always has an escape path, code=%s',async code=>{
  loginApi.mockRejectedValue(rejection('Confirma tu correo antes de iniciar sesión',403,code)); show(); submitLogin();
  expect(await screen.findByRole('alert')).toHaveTextContent('Confirma tu correo');
  expect(screen.getByRole('link',{name:/No has confirmado tu correo/})).toHaveAttribute('href','/verify-email');
  expect(sessionLogin).not.toHaveBeenCalled();
  if(code) expect(screen.getByRole('button',{name:'Reenviar enlace de confirmación'})).toBeEnabled();
});
test('changing account clears the previous account resend state', async()=>{
  loginApi.mockRejectedValue(rejection('Confirma tu correo',403,'EMAIL_NOT_VERIFIED')); show(); submitLogin(); await screen.findByRole('alert');
  fill('Email','other@example.invalid');
  expect(screen.queryByRole('button',{name:'Reenviar enlace de confirmación'})).toBeNull(); expect(screen.queryByRole('alert')).toBeNull();
});
test.each([{registrationRequested:true},{emailSent:false},{emailSent:true},{}])('registration request never claims creation or delivery: %j',async response=>{
  register.mockResolvedValue(response); show(<Auth/>,'/auth?modo=registro'); submitRegistration();
  expect(await screen.findByRole('heading',{name:'Solicitud recibida'})).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(REGISTRATION_REQUESTED);
  expect(screen.queryByLabelText('Contraseña')).toBeNull(); expect(screen.queryByText(/Cuenta creada/)).toBeNull();
  expect(sessionLogin).not.toHaveBeenCalled(); expect(screen.getByTestId('route')).toHaveTextContent('/auth');
  fireEvent.click(screen.getByRole('button',{name:'Ir al inicio de sesión'}));
  expect(screen.getByLabelText('Contraseña')).toHaveValue(''); expect(screen.getByLabelText('Email')).toHaveValue('qa@example.invalid');
});
test('registration validates password with persistent accessible guidance',()=>{
  show(<Auth/>,'/auth?modo=registro'); fill('Nombre','QA'); credentials(); fill('Contraseña','weakpass'); fireEvent.click(screen.getByRole('button',{name:'Crear cuenta'}));
  expect(screen.getByRole('alert')).toHaveTextContent('Mínimo 8'); expect(register).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-describedby','registration-password-help');
});
test('legacy registration conflict is neutral in the UI (HTTP must be fixed separately)', async()=>{
  register.mockRejectedValue(rejection('El email ya está registrado',409)); show(<Auth/>,'/auth?modo=registro'); submitRegistration();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido completar el registro'); expect(screen.queryByText('El email ya está registrado')).toBeNull();
});
test('pending registration locks edits/tab changes and cannot double-submit',async()=>{
  let done; register.mockImplementation(()=>new Promise(resolve=>{done=resolve;})); show(<Auth/>,'/auth?modo=registro'); submitRegistration();
  expect(screen.getByLabelText('Email')).toBeDisabled(); expect(screen.getByRole('button',{name:'Iniciar sesión',exact:true})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:/Procesando/})); expect(register).toHaveBeenCalledTimes(1);
  await act(async()=>done({registrationRequested:true}));
});
test('inline resend is neutral and its success is not mixed with a later error',async()=>{
  loginApi.mockRejectedValue(rejection('Confirma tu correo',403,'EMAIL_NOT_VERIFIED')); resendVerification.mockResolvedValue({message:'Mensaje antiguo que promete entrega'});
  show(); submitLogin(); await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button',{name:'Reenviar enlace de confirmación'}));
  expect(await screen.findByRole('status')).toHaveTextContent(VERIFICATION_REQUESTED); expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByRole('button',{name:'Reenviar enlace de confirmación'})).toBeNull();
});
test.each([false,true])('successful login confirms server session; embedded=%s',async embedded=>{
  loginApi.mockResolvedValue({}); show(<Auth embedded={embedded}/>); submitLogin();
  await waitFor(()=>expect(sessionLogin).toHaveBeenCalledTimes(1));
  await waitFor(()=>expect(screen.getByTestId('route')).toHaveTextContent(embedded?'/auth':'/espacio-de-trabajo'));
});
test('failed session confirmation never navigates to the workspace',async()=>{
  loginApi.mockResolvedValue({}); sessionLogin.mockResolvedValue(false); show(); submitLogin();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido confirmar la sesión'); expect(screen.getByTestId('route')).toHaveTextContent('/auth');
});
test.each(['//evil.invalid','/\\evil.invalid','https://evil.invalid'])('external return target rejected: %s',async from=>{
  loginApi.mockResolvedValue({}); show(<Auth/>,{pathname:'/auth',state:{from}}); submitLogin();
  await waitFor(()=>expect(screen.getByTestId('route')).toHaveTextContent('/espacio-de-trabajo'));
});
test('MFA has associated label and announces error; no session without valid second factor',async()=>{
  loginApi.mockResolvedValue({requires2fa:true}); verify2fa.mockRejectedValue(rejection('Código incorrecto',401)); show(); submitLogin();
  await screen.findByLabelText('Código 2FA'); expect(sessionLogin).not.toHaveBeenCalled();
  fill('Código 2FA','123456'); fireEvent.click(screen.getByRole('button',{name:'Verificar',exact:true}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Código incorrecto'); expect(sessionLogin).not.toHaveBeenCalled();
  verify2fa.mockResolvedValue({}); fireEvent.click(screen.getByRole('button',{name:'Verificar',exact:true})); await waitFor(()=>expect(sessionLogin).toHaveBeenCalledTimes(1));
});

test('confirmation page without token is a normal form, not an error',()=>{
  show(<VerifyEmail/>); expect(screen.queryByRole('alert')).toBeNull(); expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Iniciar sesión'})).toHaveAttribute('href','/auth'); expect(verifyEmail).not.toHaveBeenCalled();
});
test.each(['#token=synthetic-confirmation','?token=synthetic-confirmation'])('confirmation strips token from URL and does not start session: %s',async suffix=>{
  window.history.replaceState({},'',`/verify-email${suffix}`); verifyEmail.mockResolvedValue({}); show(<React.StrictMode><VerifyEmail/></React.StrictMode>);
  expect(await screen.findByRole('heading',{name:'Correo confirmado'})).toBeInTheDocument(); expect(verifyEmail).toHaveBeenCalledTimes(1);
  expect(verifyEmail).toHaveBeenCalledWith('synthetic-confirmation'); expect(window.location.hash+window.location.search).toBe(''); expect(sessionLogin).not.toHaveBeenCalled();
});
test.each([400,503])('invalid/expired token or unavailable server has actionable error: %s',async status=>{
  window.history.replaceState({},'','/verify-email#token=synthetic-confirmation'); verifyEmail.mockRejectedValue(rejection(status===400?'El enlace es inválido, ha caducado o ya fue utilizado':'Servicio no disponible temporalmente',status)); show(<VerifyEmail/>);
  expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument(); expect(screen.getByRole('link',{name:'Iniciar sesión'})).toBeInTheDocument();
});
test('resend has a distinct neutral requested state; another address requires explicit action',async()=>{
  resendVerification.mockResolvedValue({message:'Se envió el correo'}); show(<VerifyEmail/>); fill('Correo electrónico','qa@example.invalid'); fireEvent.click(screen.getByRole('button',{name:'Reenviar enlace'}));
  expect(await screen.findByRole('heading',{name:'Solicitud recibida'})).toBeInTheDocument(); expect(screen.getByRole('status')).toHaveTextContent(VERIFICATION_REQUESTED);
  expect(screen.queryByLabelText('Correo electrónico')).toBeNull(); fireEvent.click(screen.getByRole('button',{name:'Usar otro correo'})); expect(screen.getByLabelText('Correo electrónico')).toHaveValue(''); expect(screen.queryByRole('status')).toBeNull();
});
test('resend failure retains address and announces error',async()=>{
  resendVerification.mockRejectedValue(rejection('Demasiadas solicitudes',429)); show(<VerifyEmail/>); fill('Correo electrónico','qa@example.invalid'); fireEvent.click(screen.getByRole('button',{name:'Reenviar enlace'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Demasiadas solicitudes'); expect(screen.getByLabelText('Correo electrónico')).toHaveValue('qa@example.invalid');
});
test('resend pending prevents editing and duplicate submission',async()=>{
  let done; resendVerification.mockImplementation(()=>new Promise(resolve=>{done=resolve;})); show(<VerifyEmail/>); fill('Correo electrónico','qa@example.invalid'); fireEvent.click(screen.getByRole('button',{name:'Reenviar enlace'}));
  expect(screen.getByLabelText('Correo electrónico')).toBeDisabled(); fireEvent.click(screen.getByRole('button',{name:'Solicitando...'})); expect(resendVerification).toHaveBeenCalledTimes(1); await act(async()=>done({}));
});

test('reset without token explains the problem without technical jargon and offers recovery',()=>{
  show(<ResetPassword/>); expect(screen.getByRole('alert')).toHaveTextContent('enlace de recuperación está incompleto'); expect(screen.getByRole('link',{name:'Solicitar otro enlace'})).toHaveAttribute('href','/forgot-password'); expect(screen.queryByLabelText('Contraseña nueva')).toBeNull();
});
test.each([['ExamplePass1','DifferentPass2'],['weakpass','weakpass']])('reset validates confirmation and strength before sending: %s', (password,confirmation)=>{
  window.history.replaceState({},'','/reset-password#token=synthetic-reset'); show(<ResetPassword/>); submitReset(password,confirmation);
  expect(screen.getByRole('alert')).toBeInTheDocument(); expect(resetPassword).not.toHaveBeenCalled();
});
test.each(['#token=synthetic-reset','?token=synthetic-reset'])('reset success is independent of message shape and storage; %s',async suffix=>{
  window.history.replaceState({},'',`/reset-password${suffix}`); resetPassword.mockResolvedValue({}); jest.spyOn(Storage.prototype,'removeItem').mockImplementation(()=>{throw new Error('Storage blocked');}); show(<ResetPassword/>); submitReset();
  expect(await screen.findByRole('heading',{name:'Contraseña cambiada'})).toBeInTheDocument(); expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByLabelText('Contraseña nueva')).toBeNull(); expect(screen.getByText(/Cambiar la contraseña no confirma tu correo/)).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Confirmar mi correo'})).toHaveAttribute('href','/verify-email'); expect(sessionLogin).not.toHaveBeenCalled(); expect(window.location.hash+window.location.search).toBe(''); expect(resetPassword).toHaveBeenCalledWith('synthetic-reset','ExamplePass1');
});
test('reset expired token keeps a new-link path and never reports success',async()=>{
  window.history.replaceState({},'','/reset-password#token=synthetic-reset'); resetPassword.mockRejectedValue(rejection('Enlace inválido o caducado')); show(<ResetPassword/>); submitReset();
  expect(await screen.findByRole('alert')).toHaveTextContent('Enlace inválido'); expect(screen.queryByRole('status')).toBeNull(); expect(screen.getByRole('link',{name:'Solicitar otro enlace'})).toBeInTheDocument();
});
