import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Auth from './Auth';
import { useAuth } from '../context/AuthContext';
import { loginApi, verify2fa } from '../services/api';
import { canOfferPasswordSave, offerPasswordSave } from '../services/browserPasswordManager';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../components/CookieBanner', () => ({ PrivacyAccess: () => null }));
jest.mock('../services/api', () => ({ register: jest.fn(), loginApi: jest.fn(), resendVerification: jest.fn(), verify2fa: jest.fn() }));
jest.mock('../services/browserPasswordManager', () => ({ canOfferPasswordSave: jest.fn(), offerPasswordSave: jest.fn() }));

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
  sessionLogin.mockResolvedValue(true);
  useAuth.mockReturnValue({ user: null, phase: 'anonymous', login: sessionLogin });
});

test('session persistence and browser password saving are separate, opt-in choices', async () => {
  loginApi.mockResolvedValue({}); show();
  expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username');
  expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password');
  expect(screen.getByLabelText('Mantener la sesión en este dispositivo')).not.toBeChecked();
  expect(screen.getByLabelText('Recordar contraseña en este navegador')).not.toBeChecked();
  fillLogin(); submit();
  await waitFor(() => expect(sessionLogin).toHaveBeenCalledTimes(1));
  expect(loginApi).toHaveBeenCalledWith('qa@example.invalid', 'ExamplePass1', false);
  expect(offerPasswordSave).not.toHaveBeenCalled();
});

test('a successful confirmed login offers the password only to the browser', async () => {
  loginApi.mockResolvedValue({}); show(); fillLogin();
  fireEvent.click(screen.getByLabelText('Recordar contraseña en este navegador'));
  submit();
  await waitFor(() => expect(offerPasswordSave).toHaveBeenCalledWith({ email: 'qa@example.invalid', password: 'ExamplePass1' }));
  expect(sessionLogin).toHaveBeenCalledTimes(1);
  expect(loginApi).toHaveBeenCalledWith('qa@example.invalid', 'ExamplePass1', false);
});

test('rejected credentials or unconfirmed server session never offer a password', async () => {
  loginApi.mockRejectedValueOnce(new Error('Credenciales incorrectas')).mockResolvedValueOnce({});
  sessionLogin.mockResolvedValue(false);
  show(); fillLogin(); fireEvent.click(screen.getByLabelText('Recordar contraseña en este navegador'));
  submit(); await screen.findByRole('alert');
  expect(offerPasswordSave).not.toHaveBeenCalled();
  submit(); await waitFor(() => expect(sessionLogin).toHaveBeenCalledTimes(1));
  expect(offerPasswordSave).not.toHaveBeenCalled();
});

test('MFA saves only after valid second factor and confirmed session', async () => {
  loginApi.mockResolvedValue({ requires2fa: true });
  verify2fa.mockRejectedValueOnce(new Error('Código incorrecto')).mockResolvedValueOnce({});
  show(); fillLogin(); fireEvent.click(screen.getByLabelText('Recordar contraseña en este navegador'));
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
  expect(screen.queryByLabelText('Recordar contraseña en este navegador')).toBeNull();
  expect(screen.getByText(/navegador puede ofrecerte guardar/)).toBeInTheDocument();
});
