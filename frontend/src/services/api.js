import axios from 'axios';

const api = axios.create({
  baseURL:         '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      const url = err.config?.url ?? '';
      const isAuthCall = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/2fa');
      if (!isAuthCall) {
        localStorage.removeItem('cyberaudit_user');
        window.location.href = '/auth';
      }
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

export const loginApi = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password });
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
  const { data } = await api.get('/me/2fa/setup');
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