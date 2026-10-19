import React from 'react';
import {render,screen,fireEvent,act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import ForgotPassword from './ForgotPassword';
import {forgotPassword} from '../services/api';

jest.mock('../services/api',()=>({forgotPassword:jest.fn()}));
beforeEach(()=>jest.clearAllMocks());
function show(){render(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><ForgotPassword/></MemoryRouter>);}
function submit(){fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'qa@example.invalid'}});fireEvent.click(screen.getByRole('button',{name:'Enviar enlace'}));}
test('initial view asks for the email without displaying confirmation',()=>{
  show();expect(screen.getByRole('heading',{name:'Recuperar contraseña'})).toBeInTheDocument();expect(screen.getByText(/Introduce el correo electrónico asociado/)).toBeInTheDocument();expect(screen.queryByRole('status')).toBeNull();
});
test.each([{message:'Si el email está registrado, recibirás un enlace de recuperación.'},{}])('successful request shows one neutral confirmation independently of backend copy: %j',async response=>{
  forgotPassword.mockResolvedValue(response);show();submit();
  expect(await screen.findByRole('heading',{name:'Solicitud recibida'})).toBeInTheDocument();
  expect(screen.getAllByRole('status')).toHaveLength(1);expect(screen.getByRole('status')).toHaveTextContent('Si la cuenta existe y el servicio de correo está disponible, se intentará enviar un enlace de recuperación. Este aviso no confirma el envío.');
  expect(screen.queryByText(/Introduce el correo/)).toBeNull();expect(screen.queryByLabelText('Correo electrónico')).toBeNull();expect(screen.queryByRole('button',{name:'Enviar enlace'})).toBeNull();expect(screen.queryByRole('heading',{name:'Recuperar contraseña'})).toBeNull();expect(screen.getByRole('link',{name:'Volver al inicio de sesión'})).toHaveAttribute('href','/auth');expect(forgotPassword).toHaveBeenCalledWith('qa@example.invalid');expect(forgotPassword).toHaveBeenCalledTimes(1);
});
test('failed request keeps entered email and form available for retry',async()=>{
  forgotPassword.mockRejectedValue({response:{data:{error:'No se pudo procesar la solicitud.'}}});show();submit();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo procesar la solicitud.');expect(screen.getByLabelText('Correo electrónico')).toHaveValue('qa@example.invalid');expect(screen.queryByRole('status')).toBeNull();expect(screen.getByRole('button',{name:'Enviar enlace'})).toBeEnabled();
});
test('confirmation appears only after the request resolves',async()=>{
  let resolve;forgotPassword.mockImplementation(()=>new Promise(done=>{resolve=done;}));show();submit();expect(screen.getByRole('button',{name:'Solicitando...'})).toBeDisabled();expect(screen.queryByRole('status')).toBeNull();
  await act(async()=>resolve({}));expect(screen.getByRole('heading',{name:'Solicitud recibida'})).toBeInTheDocument();
});
