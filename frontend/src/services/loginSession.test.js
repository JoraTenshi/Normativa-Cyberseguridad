import axios from 'axios';
import { loginApi, verify2fa } from './api';
jest.mock('axios', () => {
  const client = { post:jest.fn(), interceptors:{request:{use:jest.fn()},response:{use:jest.fn()}} };
  return { create:jest.fn(() => client) };
});
const client=axios.create();
beforeEach(()=>{client.post.mockReset();client.post.mockResolvedValue({data:{data:{usuario:{id:'sintetico'}}}});});
test('el login no recuerda la sesión por defecto',async()=>{
  await loginApi('sintetico@example.invalid','ClaveFicticia91');
  expect(client.post).toHaveBeenCalledWith('/auth/login',{email:'sintetico@example.invalid',password:'ClaveFicticia91',mantenerSesion:false});
});
test('la preferencia explícita se envía con la contraseña, sin fechas o permisos',async()=>{
  await loginApi('sintetico@example.invalid','ClaveFicticia91',true);
  expect(client.post).toHaveBeenCalledWith('/auth/login',{email:'sintetico@example.invalid',password:'ClaveFicticia91',mantenerSesion:true});
});
test('MFA solo envía el código: la preferencia queda protegida en el desafío del servidor',async()=>{
  await verify2fa('123456');
  expect(client.post).toHaveBeenCalledWith('/auth/2fa/verify',{token:'123456'});
});
