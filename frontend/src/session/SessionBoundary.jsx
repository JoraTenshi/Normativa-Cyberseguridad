import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Auth from '../pages/Auth';
import { confirmLeave, hasDrafts } from '../connected/draft-state';
import './session.css';

export default function SessionBoundary({ children }) {
  const { phase, user, machine, remainingMs, workspaceKey, error } = useAuth();
  const blocked = !!user && phase !== 'authenticated';
  const dialog = useRef(null);
  useEffect(() => {
    if (blocked && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!blocked && dialog.current?.open) dialog.current.close();
  }, [blocked]);
  useEffect(() => {
    const unload = e => { if (hasDrafts()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, []);
  const close = async () => { if (confirmLeave('Cerrar sesión descartará el borrador de esta pestaña. ¿Continuar?')) await machine.logout(); };
  return <>
    {phase === 'authenticated' && remainingMs <= 120000 && <section className="session-warning" role="status">
      <strong>La sesión está próxima a caducar.</strong>
      <span>Tiempo restante aproximado: {Math.ceil(remainingMs/1000)} s. El servidor decide la caducidad.</span>
      <button onClick={() => machine.activity(true)}>Seguir trabajando</button>
      <span>La actividad no amplía el máximo de ocho horas.</span>
    </section>}
    <div hidden={blocked} key={workspaceKey}>{children}</div>
    {blocked && <dialog ref={dialog} className="session-dialog green-app" aria-labelledby="session-title" onCancel={e => e.preventDefault()}>
      <h2 id="session-title">Sesión bloqueada</h2>
      <p role="alert">{error || 'Comprobando la sesión…'}</p>
      <p>El borrador permanece solo en esta pestaña. Vuelve con la misma cuenta para conservarlo.
        Acceder con otra cuenta lo descarta. No recargues ni cierres la pestaña.</p>
      {phase !== 'closing' && <button onClick={() => machine.sync()}>Volver a comprobar la sesión</button>}
      {phase === 'locked' && <Auth embedded />}
      <button disabled={phase === 'closing'} onClick={close}>{phase === 'closing' ? 'Confirmando cierre…' : 'Cerrar sesión y descartar el borrador'}</button>
    </dialog>}
  </>;
}
