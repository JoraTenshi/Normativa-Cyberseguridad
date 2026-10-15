import { sessionTicket, acceptSessionResponse } from './session/session-bridge';
// API mode only. No synthetic fallback, bearer tokens, localStorage or automatic writes.
export class ApiError extends Error {
  constructor(message, status = 0, code = status === 400 ? 'DATOS_INVALIDOS' : status ? 'PETICION_RECHAZADA' : 'RED_NO_DISPONIBLE') { super(message); this.status = status; this.code = code; }
}
export function resourceId(id) {
  if (!/^[a-f0-9]{24}$/i.test(id || '')) throw new ApiError('Introduce un identificador de organización/recurso válido.', 400, 'ID_INVALIDO');
  return id.toLowerCase();
}
export function queryString(values = {}) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null && value !== '') q.set(key, String(value));
  const encoded = q.toString();
  return encoded ? `?${encoded}` : '';
}
export function newWrite(method, path, body, uuid = () => crypto.randomUUID()) {
  return Object.freeze({ method, path, body: JSON.stringify(body), key: uuid() });
}
export function createApi(fetcher = (...args) => fetch(...args)) {
  async function request(path, { method = 'GET', body, key, binary = false, download = false } = {}) {
    if (!path.startsWith('/') || path.startsWith('//') || /[?#]/.test(path.split('?')[0]) || path.includes('..')) throw new ApiError('Ruta no válida', 400);
    const ticket = sessionTicket();
    const headers = { 'X-Requested-With':'XMLHttpRequest', 'X-Session-User':ticket.userId };
    if (body !== undefined) headers['Content-Type'] = binary ? 'application/pdf' : 'application/json';
    if (key) headers['Idempotency-Key'] = key;
    let response;
    try { response = await fetcher('/api' + path, { method, headers, body, credentials: 'include', cache: 'no-store' }); }
    catch { throw new ApiError('No se ha podido contactar con el servidor. El borrador se conserva; un envío podría haberse guardado.'); }
    if (response.status === 401) acceptSessionResponse(ticket, 401);
    const type = response.headers.get('content-type') || '';
    if (download && response.ok && !type.includes('text/html') && !type.includes('application/json')) {
      const blob = await response.blob(); acceptSessionResponse(ticket, response.status); return blob;
    }
    let payload;
    try { payload = await response.json(); } catch { throw new ApiError('El servidor no ha devuelto el contrato JSON esperado. Comprueba el backend y el proxy.', response.status, 'RESPUESTA_NO_VALIDA'); }
    acceptSessionResponse(ticket, response.status, payload?.codigo);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new ApiError('Respuesta JSON incompatible con el contrato.', response.status, 'RESPUESTA_NO_VALIDA');
    if (!response.ok || payload.ok === false) throw new ApiError(payload.error || 'No se pudo completar la petición.', response.status, payload.codigo || payload.code || 'PETICION_RECHAZADA');
    if (download) throw new ApiError('No se recibió un archivo descargable.', response.status, 'RESPUESTA_NO_VALIDA');
    return Object.hasOwn(payload, 'data') ? payload.data : payload;
  }
  return {
    get: path => request(path),
    write: job => request(job.path, { method: job.method, body: job.body, key: job.key }),
    post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
    upload: (path, file, key) => request(path, { method: 'POST', body: file, key, binary: true }),
    download: path => request(path, { download: true }),
  };
}
export function orgPath(id) { return '/organizaciones/' + resourceId(id); }
export function cleanFact(fact) {
  if (fact.estado === 'conocido') return { clave: fact.clave, estado: fact.estado, valor: fact.valor };
  if (fact.estado === 'desconocido') return { clave: fact.clave, estado: fact.estado, motivo: fact.motivo || 'por_consultar' };
  if (fact.estado === 'conflictivo') return { clave: fact.clave, estado: fact.estado, alternativas: fact.alternativas.map(a => ({ valor: a.valor })) };
  throw new ApiError('Estado de dato no válido', 400, 'DATOS_INVALIDOS');
}
export function contextIsHistorical(data) { return !!data?.contexto && data.contexto.version !== data.versionActual; }
export function changedFacts(previous, edited) {
  const old = new Map(previous.map(f => [f.clave, JSON.stringify(cleanFact(f))]));
  return edited.map(cleanFact).filter(f => old.get(f.clave) !== JSON.stringify(f));
}
export function safeFilename(name) { return String(name || 'descarga').replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 150); }
export function downloadBlob(blob, name) {
  const href = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = href; a.download = safeFilename(name); a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
