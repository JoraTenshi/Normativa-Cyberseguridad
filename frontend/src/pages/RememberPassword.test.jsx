import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Auth from './Auth';
import { useAuth } from '../context/AuthContext';
import { loginApi, verify2fa } from '../services/api';
import { canOfferPasswordSave, canChooseSavedPassword, chooseSavedPassword, offerPasswordSave } from '../services/browserPasswordManager';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../components/CookieBanner', () => ({ PrivacyAccess: () => null }));
jest.mock('../services/api', () => ({ register: jest.fn(), loginApi: jest.fn(), resendVerification: jest.fn(), verify2fa: jest.fn() }));
jest.mock('../services/browserPasswordManager', () => ({ canOfferPasswordSave: jest.fn(), canChooseSavedPassword: jest.fn(), chooseSavedPassword: jest.fn(), offerPasswordSave: jest.fn() }));

const sessionLogin = jest.fn();
const show = () => render(<MemoryRouter initialEntries={['/auth']} future={{v7_startTransition:true,v7_relativeSplatPath:true}}><Auth/></MemoryRouter>);
const fillLogin = () => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'qa@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'ExamplePass1' } });
};
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

beforeEach(() => {
  jest.clearAllMocks();
  canOfferPasswordSave.mockReturnValue(true);
  canChooseSavedPassword.mockReturnValue(true);
  sessionLogin.mockResolvedValue(true);
  useAuth.mockReturnValue({ user: null, phase: 'anonymous', login: sessionLogin });
});

test('session persistence and browser password saving are separate, opt-in choices', async () => {
  loginApi.mockResolvedValue({}); show();
  expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username');
  expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password');
  expect(screen.getByLabelText('Mantener la sesión en este dispositivo')).not.toBeChecked();
  expect(screen.getByLabelText('Pedir al navegador que guarde la contraseña')).not.toBeChecked();
  fillLogin(); submit();
  await waitFor(() => expect(sessionLogin).toHaveBeenCalledTimes(1));
  expect(loginApi).toHaveBeenCalledWith('qa@example.invalid', 'ExamplePass1', false);
  expect(offerPasswordSave).not.toHaveBeenCalled();
});

test('a successful confirmed login offers the password only to the browser', async () => {
  loginApi.mockResolvedValue({}); show(); fillLogin();
  fireEvent.click(screen.getByLabelText('Pedir al navegador que guarde la contraseña'));
  submit();
  await waitFor(() => expect(offerPasswordSave).toHaveBeenCalledWith({ email: 'qa@example.invalid', password: 'ExamplePass1' }));
  expect(sessionLogin).toHaveBeenCalledTimes(1);
  expect(loginApi).toHaveBeenCalledWith('qa@example.invalid', 'ExamplePass1', false);
});

test('authentication does not unmount the form before the browser save request settles', async () => {
  let finishSaving;
  offerPasswordSave.mockImplementation(() => new Promise(resolve => { finishSaving = resolve; }));
  loginApi.mockResolvedValue({});
  const app = () => <MemoryRouter initialEntries={['/auth']} future={{v7_startTransition:true,v7_relativeSplatPath:true}}><Auth/></MemoryRouter>;
  const rendered = render(app());
  fillLogin();
  fireEvent.click(screen.getByLabelText('Pedir al navegador que guarde la contraseña'));
  submit();
  await waitFor(() => expect(offerPasswordSave).toHaveBeenCalledTimes(1));
  useAuth.mockReturnValue({ user: { id: 'user-1' }, phase: 'authenticated', login: sessionLogin });
  rendered.rerender(app());
  expect(screen.getByLabelText('Email')).toBeInTheDocument();
  await act(async () => { finishSaving(true); });
});

test('rejected credentials or unconfirmed server session never offer a password', async () => {
  loginApi.mockRejectedValueOnce(new Error('Credenciales incorrectas')).mockResolvedValueOnce({});
  sessionLogin.mockResolvedValue(false);
  show(); fillLogin(); fireEvent.click(screen.getByLabelText('Pedir al navegador que guarde la contraseña'));
  submit(); await screen.findByRole('alert');
  expect(offerPasswordSave).not.toHaveBeenCalled();
  submit(); await waitFor(() => expect(sessionLogin).toHaveBeenCalledTimes(1));
  expect(offerPasswordSave).not.toHaveBeenCalled();
});

test('MFA saves only after valid second factor and confirmed session', async () => {
  loginApi.mockResolvedValue({ requires2fa: true });
  verify2fa.mockRejectedValueOnce(new Error('Código incorrecto')).mockResolvedValueOnce({});
  show(); fillLogin(); fireEvent.click(screen.getByLabelText('Pedir al navegador que guarde la contraseña'));
  submit(); await screen.findByLabelText('Código 2FA');
  expect(offerPasswordSave).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Código 2FA'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));
  await screen.findByRole('alert'); expect(offerPasswordSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));
  await waitFor(() => expect(offerPasswordSave).toHaveBeenCalledWith({ email: 'qa@example.invalid', password: 'ExamplePass1' }));
});

test('without API support it never promises app-side password storage', () => {
  canOfferPasswordSave.mockReturnValue(false); show();
  expect(screen.queryByLabelText('Pedir al navegador que guarde la contraseña')).toBeNull();
  expect(screen.getByText(/navegador puede ofrecerte guardar/)).toBeInTheDocument();
});

test('a saved credential fills the form but still requires explicit sign-in and MFA', async () => {
  chooseSavedPassword.mockResolvedValue({ email: 'qa@example.invalid', password: 'ExamplePass1' });
  loginApi.mockResolvedValue({ requires2fa: true });
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Usar contraseña guardada' }));
  await waitFor(() => expect(screen.getByLabelText('Email')).toHaveValue('qa@example.invalid'));
  expect(screen.getByLabelText('Contraseña')).toHaveValue('ExamplePass1');
  expect(loginApi).not.toHaveBeenCalled();
  submit();
  await screen.findByLabelText('Código 2FA');
  expect(loginApi).toHaveBeenCalledWith('qa@example.invalid', 'ExamplePass1', false);
  expect(offerPasswordSave).not.toHaveBeenCalled();
});

test('declining the browser chooser leaves credentials empty and explains what happened', async () => {
  chooseSavedPassword.mockResolvedValue(null);
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Usar contraseña guardada' }));
  expect(await screen.findByRole('status')).toHaveTextContent('No se seleccionó ninguna contraseña guardada');
  expect(screen.getByLabelText('Email')).toHaveValue('');
  expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  expect(loginApi).not.toHaveBeenCalled();
});

test('DOM autofill is submitted even when the browser did not emit React change events', async () => {
  loginApi.mockResolvedValue({});
  show();
  const setNativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setNativeValue.call(screen.getByLabelText('Email'), 'saved@example.invalid');
  setNativeValue.call(screen.getByLabelText('Contraseña'), 'SavedPass1');
  submit();
  await waitFor(() => expect(loginApi).toHaveBeenCalledWith('saved@example.invalid', 'SavedPass1', false));
});
