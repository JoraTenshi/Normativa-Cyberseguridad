import axios from 'axios';

const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' }
});

// Attach JWT automatically on every request when available
api.interceptors.request.use(config => {
  const token = localStorage.getItem('cyberaudit_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
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

// ── Historial ─────────────────────────────────────────────────────────────────
export const getHistorial = async () => {
  const { data } = await api.get('/me/historial');
  return data.data;
};

export const getHistorialDetalle = async (id) => {
  const { data } = await api.get(`/me/historial/${id}`);
  return data.data;
};
