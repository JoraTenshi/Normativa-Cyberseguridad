export async function sessionTransport(action, userId) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
  const path = action === 'activity' ? '/auth/session/actividad' : action === 'logout' ? '/auth/logout' : '/auth/session';
  try {
    const response = await fetch('/api'+path, {
      method:action === 'session' ? 'GET' : 'POST', credentials:'include', cache:'no-store',
      headers:{ 'Content-Type':'application/json', 'X-Requested-With':'XMLHttpRequest',
        // Session read deliberately has no expected account: it detects a cross-tab account change.
        ...(action !== 'session' && userId ? { 'X-Session-User':userId } : {}) },
      ...(action === 'session' ? {} : { body:'{}' }), signal:controller.signal
    });
    const payload = await response.json();
    if (!response.ok || payload.ok !== true) throw Object.assign(new Error(payload.error || 'No se pudo comprobar la sesión'), { status:response.status, code:payload.codigo });
    return payload.data;
  } finally { clearTimeout(timer); }
}
