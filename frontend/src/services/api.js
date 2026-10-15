import { sessionTicket, acceptSessionResponse } from '../session/session-bridge';
import axios from 'axios';

const api = axios.create({
  baseURL:         '/api',
  withCredentials: true,
  // X-Requested-With: lo exige el backend en peticiones que cambian datos (backend/middleware/origen.js)
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
});

// Guard both identity and generation. A late response cannot revive an old screen.
const protectedPath = path => /^\/(me|organizaciones)(\/|$)/.test(path || '');
api.interceptors.request.use(config => {
  if (protectedPath(config.url)) {
    const ticket = sessionTicket(); config.sessionTicket = ticket;
    config.headers['X-Session-User'] = ticket.userId;
  }
  return config;
});
api.interceptors.response.use(
  res => { if (res.config?.sessionTicket) acceptSessionResponse(res.config.sessionTicket, res.status); return res; },
  err => {
    if (err.config?.sessionTicket) {
      // TOTP incorrecto no significa que haya caducado la sesión ya autenticada.
      const wrongTotp = /^\/me\/2fa\//.test(err.config.url || '') && err.response?.status === 401 && err.response?.data?.error === 'Código incorrecto';
      acceptSessionResponse(err.config.sessionTicket, wrongTotp ? 400 : err.response?.status, err.response?.data?.codigo);
    }
    return Promise.reject(err);
  }
);

export const getNormativas = async () => {
  const { data } = await api.get('/normativas');
  return data.data;
};

export const getNormativa = async (id) => {
  const { data } = await api.get(`/normativas/${id}`);
  return data.data;
};

export const enviarResultado = async (normativaId, respuestas) => {
  const { data } = await api.post('/resultado', { normativa: normativaId, respuestas });
  return data.data;
};

export const register = async (nombre, email, password) => {
  const { data } = await api.post('/auth/register', { nombre, email, password });
  return data.data;
};

export const verifyEmail = async (token) => {
  const { data } = await api.post('/auth/verify-email', { token });
  return data;
};

export const resendVerification = async (email) => {
  const { data } = await api.post('/auth/resend-verification', { email });
  return data;
};

export const forgotPassword = async (email) => {
  const { data } = await api.post('/auth/forgot-password', { email });
  return data;
};

export const resetPassword = async (token, password) => {
  const { data } = await api.post('/auth/reset-password', { token, password });
  return data;
};

export const loginApi = async (email, password, mantenerSesion = false) => {
  const { data } = await api.post('/auth/login', { email, password, mantenerSesion });
  return data.data;
};

export const logoutApi = async () => {
  await api.post('/auth/logout');
};

export const verify2fa = async (token) => {
  const { data } = await api.post('/auth/2fa/verify', { token });
  return data.data;
};

export const get2faSetup = async () => {
  const { data } = await api.post('/me/2fa/setup');
  return data.data;
};

export const enable2fa = async (token) => {
  await api.post('/me/2fa/enable', { token });
};

export const disable2fa = async (token) => {
  await api.post('/me/2fa/disable', { token });
};

export const getHistorial = async () => {
  const { data } = await api.get('/me/historial');
  return data.data;
};

export const getHistorialDetalle = async (id) => {
  const { data } = await api.get(`/me/historial/${id}`);
  return data.data;
};

export const getPlanDirector = async (resultadoId) => {
  const { data } = await api.get(`/me/pds/${resultadoId}`);
  return data.data;
};
