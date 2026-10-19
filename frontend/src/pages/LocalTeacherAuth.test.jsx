import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Auth from './Auth';
import ForgotPassword from './ForgotPassword';
import VerifyEmail from './VerifyEmail';
import ResetPassword from './ResetPassword';
import { useAuth } from '../context/AuthContext';
import { register, forgotPassword, resendVerification, verifyEmail, resetPassword } from '../services/api';

jest.mock('../utils/localTeacherDemo', () => ({ isLocalTeacherDemo: () => true }));
jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/api', () => ({
  register: jest.fn(), loginApi: jest.fn(), verify2fa: jest.fn(), resendVerification: jest.fn(),
  forgotPassword: jest.fn(), verifyEmail: jest.fn(), resetPassword: jest.fn()
}));

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user: null, phase: 'anonymous', login: jest.fn() });
});

const show = (component, route = '/auth') => render(
  <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {component}
  </MemoryRouter>
);

test('la URL de registro de la demo muestra solo login y explica la cuenta ficticia', () => {
  show(<Auth />, '/auth?modo=registro');
  expect(screen.getByText(/admin.workspace@example.invalid/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Registrarse|Crear cuenta|Regístrate/ })).toBeNull();
  expect(screen.queryByRole('link', { name: /Has olvidado/ })).toBeNull();
  expect(register).not.toHaveBeenCalled();
});

test('las rutas directas de correo de la demo no ofrecen formularios ni llaman a la API', () => {
  for (const component of [<ForgotPassword />, <VerifyEmail />, <ResetPassword />]) {
    const view = show(component);
    expect(screen.getByRole('link', { name: /inicio de sesión|Iniciar sesión/ })).toHaveAttribute('href', '/auth');
    expect(screen.queryByRole('textbox')).toBeNull();
    view.unmount();
  }
  expect(forgotPassword).not.toHaveBeenCalled();
  expect(resendVerification).not.toHaveBeenCalled();
  expect(verifyEmail).not.toHaveBeenCalled();
  expect(resetPassword).not.toHaveBeenCalled();
});
