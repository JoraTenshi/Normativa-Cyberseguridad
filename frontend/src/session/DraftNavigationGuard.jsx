import React, { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { hasDrafts } from '../connected/draft-state';

// Data-router blocking covers links, programmatic navigation and browser Back/Forward.
// beforeunload separately warns for full document navigation; no persistent drafts.
export default function DraftNavigationGuard() {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => hasDrafts() &&
    (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  const dialog = useRef(null);
  useEffect(() => {
    if (blocker.state === 'blocked' && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [blocker.state]);
  if (blocker.state !== 'blocked') return null;
  return <dialog ref={dialog} className="session-dialog" aria-labelledby="draft-navigation-title"
    onCancel={e => { e.preventDefault(); blocker.reset(); }}>
    <h2 id="draft-navigation-title">Hay cambios sin guardar</h2>
    <p>Salir de esta pantalla descarta el borrador de esta pestaña. No se enviará ni se guardará automáticamente.</p>
    <button onClick={() => blocker.reset()}>Seguir editando</button>
    <button onClick={() => blocker.proceed()}>Descartar y salir</button>
  </dialog>;
}
