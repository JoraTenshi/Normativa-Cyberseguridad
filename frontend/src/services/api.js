import axios from 'axios';

const api = axios.create({
  baseURL:         '',
  withCredentials: true,  // send the HttpOnly cookie on every request
  headers: { 'Content-Type': 'application/json' }
});

// ── Normativas ────────────────────────────────────────────────────────────────
export const getNormativas = async () => {
  const { data } = await api.get('/normativas');
  return data.data;
};

export const getNormativa = async (id) => {
  const { data } = await api.get(`/normativas/${id}`);
  return data.data;
};

// ── Resultado ─────────────────────────────────────────────────────────────────
export const enviarResultado = async (normativaId, respuestas) => {
  const { data } = await api.post('/resultado', { normativa: normativaId, respuestas });
  return data.data;
};

// ── Auth ──────────────────────────────────────────────────────────────────────
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

// ── Historial ─────────────────────────────────────────────────────────────────
export const getHistorial = async () => {
  const { data } = await api.get('/me/historial');
  return data.data;
};

export const getHistorialDetalle = async (id) => {
  const { data } = await api.get(`/me/historial/${id}`);
  return data.data;
};
