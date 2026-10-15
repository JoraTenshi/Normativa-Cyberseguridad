// No credentials or drafts in browser storage. The server remains authoritative.
export function createSessionMachine(transport, { now = () => Date.now(), mono = () => performance.now(), publish = () => {} } = {}) {
  let state = { phase:'checking', user:null, remainingMs:0, error:null, workspaceKey:0, generation:0 };
  let anchor = null, flight = null, lastActivity = -Infinity, serial = 0;
  const listeners = new Set();
  const emit = changes => { state = { ...state, ...changes }; listeners.forEach(fn => fn()); };
  const statusOf = e => e.status || e.response?.status;
  function lock(message = 'La sesión ha caducado. Identifícate para continuar.') {
    if (state.phase === 'closing') return; // Do not cancel an in-flight server logout.
    serial++; flight = null; anchor = null;
    emit({ phase:state.user ? 'locked' : 'anonymous', remainingMs:0, error:message, generation:state.generation+1 });
  }
  function consume(data, started) {
    const u = data?.usuario, remaining = data?.restanteMs;
    if (!u?.id || typeof u.email !== 'string' || !Number.isFinite(remaining) || remaining < 0 ||
        remaining > 30*60000 || !Number.isFinite(Date.parse(data.expiraEn))) throw new Error('Respuesta de sesión no válida');
    const changed = state.user && state.user.id !== u.id;
    const resumed = state.phase !== 'authenticated' || changed;
    const elapsed = Math.max(0, now()-started.wall, mono()-started.mono);
    anchor = { wall:now(), mono:mono(), remaining:Math.max(0, remaining-elapsed) };
    emit({ phase:'authenticated', user:u, remainingMs:anchor.remaining, session:data,
      error:null, workspaceKey:state.workspaceKey+(changed ? 1 : 0),
      generation:state.generation+(resumed ? 1 : 0) });
    if (!anchor.remaining) lock();
  }
  async function run(kind) {
    if (state.phase === 'closing') return false;
    if (flight) return flight;
    const seq = ++serial, started = { wall:now(), mono:mono() };
    const task = (async () => {
      try {
        const data = await transport(kind, state.user?.id);
        if (seq !== serial) return false;
        consume(data, started); return state.phase === 'authenticated';
      } catch(e) {
        if (seq !== serial) return false;
        if (statusOf(e) === 401 || e.code === 'CUENTA_CAMBIADA') lock();
        else emit({ phase:state.user ? 'unavailable' : 'unavailable', error:'No se puede comprobar la sesión. El trabajo no se ha descartado.' });
        return false;
      } finally { if (seq === serial) flight = null; }
    })();
    flight = task;
    return task;
  }
  const api = {
    getSnapshot: () => state,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    sync: () => run('session'),
    async signedIn() {
      if (state.phase === 'closing') return false;
      serial++; flight = null;
      const ok = await run('session'); // Never trust the supplied login JSON or localStorage.
      if (ok) { lastActivity = mono(); publish('session-changed'); }
      return ok;
    },
    lock,
    tick() {
      if (state.phase !== 'authenticated' || !anchor) return;
      const remainingMs = Math.max(0, anchor.remaining-Math.max(0, now()-anchor.wall, mono()-anchor.mono));
      if (!remainingMs) lock(); else emit({ remainingMs });
    },
    activity(force = false) {
      if (state.phase !== 'authenticated' || flight || (!force && mono()-lastActivity < 60000)) return Promise.resolve(false);
      // Only an actual visible interaction (or explicit button) invokes this method.
      lastActivity = mono();
      return run('activity');
    },
    async logout() {
      serial++; flight = null;
      const seq = serial;
      emit({ phase:'closing', generation:state.generation+1, error:null });
      try {
        await transport('logout', state.user?.id);
        if (seq !== serial) return false;
        anchor = null;
        emit({ phase:'anonymous', user:null, session:null, remainingMs:0,
          workspaceKey:state.workspaceKey+1, error:null });
        publish('signed-out'); return true;
      } catch {
        if (seq === serial) emit({ phase:state.user ? 'locked' : 'unavailable',
          error:'El servidor no ha confirmado el cierre. Reinténtalo; no des por cerrada la sesión.' });
        return false;
      }
    },
    ticket() {
      api.tick();
      if (state.phase !== 'authenticated') throw Object.assign(new Error('Sesión bloqueada; no se ha enviado el cambio.'), { status:401, code:'SESION_BLOQUEADA' });
      return { generation:state.generation, userId:state.user.id };
    },
    accept(ticket, status, code) {
      if (ticket.generation !== state.generation) throw Object.assign(new Error('Respuesta de una sesión anterior descartada.'), { status:0, code:'RESPUESTA_ANTIGUA' });
      if (status === 401 || code === 'CUENTA_CAMBIADA') lock(code === 'CUENTA_CAMBIADA' ? 'La cuenta cambió en otra pestaña. Vuelve a identificarte.' : undefined);
      if (state.phase !== 'authenticated') throw Object.assign(new Error('Sesión bloqueada; el borrador permanece aquí.'), { status:status === 401 || code === 'CUENTA_CAMBIADA' ? 401 : 0, code:'SESION_BLOQUEADA' });
    }
  };
  return api;
}
