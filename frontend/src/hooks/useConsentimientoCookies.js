import { useEffect, useState } from 'react';

// Reuse only the old notice key. Never clear session or demo storage.
export const STORAGE_KEY = 'cyberlaw_cookie_consent_v1';
const CHANGE_EVENT = 'normativacheck:storage-notice';
function leer() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return data?.version === 2 && data?.avisoLeido === true &&
      data.preferencias === false && data.analitica === false && data.marketing === false ? data : null;
  } catch { return null; }
}
export function useConsentimientoCookies() {
  const [estado,setEstado] = useState(undefined);
  useEffect(() => {
    setEstado(leer());
    const localChange = event => setEstado(event.detail);
    const externalChange = event => { if (event.key === STORAGE_KEY || event.key === null) setEstado(leer()); };
    window.addEventListener(CHANGE_EVENT, localChange);
    window.addEventListener('storage', externalChange);
    return () => { window.removeEventListener(CHANGE_EVENT,localChange); window.removeEventListener('storage',externalChange); };
  }, []);
  function recordarAviso() {
    const next = { version:2, avisoLeido:true, tecnicas:true, preferencias:false, analitica:false, marketing:false, ts:new Date().toISOString() };
    let saved = true;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { saved = false; }
    // Still allow dismissal if storage is unavailable; this is not consent.
    setEstado(next);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT,{detail:next}));
    return saved;
  }
  return { estado, recordarAviso, desactivarOpcionales:recordarAviso };
}
