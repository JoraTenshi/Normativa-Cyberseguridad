import React, { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createSessionMachine } from '../session/session-machine';
import { sessionTransport } from '../session/transport';
import { bindSession } from '../session/session-bridge';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const channelRef = useRef(null);
  const [machine] = useState(() => createSessionMachine(sessionTransport, {
    publish:type => {
      // Ephemeral signal only. Never credentials, profile, dates or drafts.
      // Send through the receiver's own channel: BroadcastChannel excludes
      // that object, so our successful login cannot lock its own tab.
      channelRef.current?.postMessage({ type });
    }
  }));
  const state = useSyncExternalStore(machine.subscribe, machine.getSnapshot);
  useEffect(() => {
    const unbind = bindSession(machine);
    try { localStorage.removeItem('cyberaudit_user'); } catch { /* Storage may be disabled. */ }
    machine.sync();
    const timer = setInterval(() => machine.tick(), 1000);
    const poll = setInterval(() => { if (document.visibilityState === 'visible' && machine.getSnapshot().phase === 'authenticated') machine.sync(); }, 60000);
    const active = event => { if (event.isTrusted && document.visibilityState === 'visible') machine.activity(); };
    const visible = () => { if (document.visibilityState === 'visible') machine.sync(); };
    const hidden = () => { if (document.visibilityState === 'hidden' && machine.getSnapshot().user) machine.lock('Comprobando la sesión al volver a esta pestaña.'); else visible(); };
    // No mousemove, timer or API polling is counted as user activity.
    ['pointerdown','keydown','input','wheel'].forEach(name => window.addEventListener(name, active, { passive:true }));
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('focus', visible);
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('normativacheck-session') : null;
    channelRef.current = channel;
    if (channel) channel.onmessage = event => {
      if (['session-changed','signed-out'].includes(event.data?.type)) {
        machine.lock('La sesión ha cambiado en otra pestaña.');
        if (event.data.type !== 'signed-out') machine.sync();
      }
    };
    return () => {
      unbind(); clearInterval(timer); clearInterval(poll); channel?.close();
      if (channelRef.current === channel) channelRef.current = null;
      ['pointerdown','keydown','input','wheel'].forEach(name => window.removeEventListener(name, active));
      document.removeEventListener('visibilitychange', hidden); window.removeEventListener('focus', visible);
    };
  }, [machine]);
  return <AuthContext.Provider value={{ ...state, machine, login:machine.signedIn, logout:machine.logout }}>
    {children}
  </AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
