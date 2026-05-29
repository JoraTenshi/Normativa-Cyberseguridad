import { useEffect, useState } from 'react';

const STORAGE_KEY = 'cyberlaw_cookie_consent_v1';
const RECONFIRM_DAYS = 365;

const POR_DEFECTO = {
  tecnicas:     true,  // siempre true: exentas Art. 22.2
  preferencias: false,
  analitica:    false,
  marketing:    false,
};

function leer() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);

    // Si rechazó, devolvemos null para que el banner siga apareciendo
    if (data.rechazado) return null;

    const edad = (Date.now() - new Date(data.ts).getTime()) / 86400000;
    if (edad > RECONFIRM_DAYS) return null;

    return data;
  } catch { return null; }
}

function guardar(estado) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...estado,
    ts: new Date().toISOString(),
    version: 1,
  }));
}

export function useConsentimientoCookies() {
  const [estado, setEstado] = useState(undefined);

  useEffect(() => { setEstado(leer()); }, []);

  const aceptarTodo = () => {
    const s = { ...POR_DEFECTO, preferencias: true, analitica: true, marketing: true };
    guardar(s);
    setEstado(s);
  };

  const rechazarTodo = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...POR_DEFECTO,
      rechazado: true,
      ts: new Date().toISOString(),
      version: 1,
    }));
    // Estado local: null → el banner vuelve a mostrarse
    setEstado(null);
  };

  const configurar = (cfg) => {
    const s = { ...POR_DEFECTO, ...cfg };
    guardar(s);
    setEstado(s);
  };

  const revocar = () => {
    localStorage.removeItem(STORAGE_KEY);
    setEstado(null);
  };

  return { estado, aceptarTodo, rechazarTodo, configurar, revocar };
}
