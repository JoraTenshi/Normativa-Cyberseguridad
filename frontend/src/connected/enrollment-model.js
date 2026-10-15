import { ApiError, resourceId } from '../api-client';

export const ownRequestsPath = '/me/solicitudes-organizacion';
export const platformRequestsPath = '/plataforma/solicitudes-organizacion';
export const capabilitiesPath = '/me/altas-capacidades';
export const requestStates = { pendiente_revision: 'pending', aclaracion_requerida: 'correction', aprobada: 'approved', rechazada: 'rejected' };
export const requestLabels = { pendiente_revision: 'Pendiente de revisión', aclaracion_requerida: 'Aclaración requerida', aprobada: 'Aprobada', rechazada: 'Rechazada' };
export const emptyRequest = { razonSocial: '', pais: 'ES', nif: '', funcionProfesional: '', justificacion: '' };
const bad = () => { throw new ApiError('El servidor no ha devuelto un estado de alta válido. No se habilitará ningún acceso.', 502, 'CONTRATO_ALTAS_INVALIDO'); };
export function parseCapabilities(data) {
  if (!data || ['gestionarAltas','requiereMfa','requiereAutenticacionReciente'].some(key => typeof data[key] !== 'boolean')) bad();
  return { gestionarAltas: data.gestionarAltas, requiereMfa: data.requiereMfa, requiereAutenticacionReciente: data.requiereAutenticacionReciente };
}
export function parseRequest(row, admin = false) {
  if (!row || !/^[a-f0-9]{24}$/i.test(row.id || '') || !Number.isSafeInteger(row.version) || row.version < 1 || !Object.hasOwn(requestStates, row.estado)) bad();
  if (!row.datos || Object.keys(emptyRequest).some(key => typeof row.datos[key] !== 'string')) bad();
  if (admin && (!row.solicitante || typeof row.solicitante.nombre !== 'string' || typeof row.solicitante.email !== 'string' || typeof row.solicitante.emailVerificado !== 'boolean' || typeof row.puedeDecidir !== 'boolean')) bad();
  if (row.historial !== undefined && (!Array.isArray(row.historial) || row.historial.some(event => !Number.isSafeInteger(event.version) || typeof event.accion !== 'string'))) bad();
  return row;
}
export function parseList(data, admin = false) {
  if (!data || !Array.isArray(data.solicitudes) || (data.siguiente != null && !/^[a-f0-9]{24}$/i.test(data.siguiente))) bad();
  return { solicitudes: data.solicitudes.map(row => parseRequest(row, admin)), siguiente: data.siguiente || null };
}
export function requestView(row) {
  return { id: row.id, version: row.version, state: requestStates[row.estado], companyName: row.datos.razonSocial, country: row.datos.pais, taxId: row.datos.nif, representation: row.datos.funcionProfesional, justification: row.datos.justificacion, applicantName: row.solicitante?.nombre, applicantEmail: row.solicitante?.email, emailVerified: row.solicitante?.emailVerificado };
}
export function requestBody(draft) {
  const body = Object.fromEntries(Object.keys(emptyRequest).map(key => [key, String(draft[key] || '').trim()]));
  body.nif = body.nif.toUpperCase();
  if (!body.razonSocial || body.razonSocial.length > 200 || body.pais !== 'ES' || !/^[A-Z0-9]{9}$/.test(body.nif) || !body.funcionProfesional || body.funcionProfesional.length > 120 || !body.justificacion || body.justificacion.length > 1000) throw new ApiError('Revisa el nombre, el NIF, tu función y la justificación. El NIF debe tener nueve letras o números.', 400, 'DATOS_INVALIDOS');
  return body;
}
export function requestPath(admin, id) { return (admin ? platformRequestsPath : ownRequestsPath) + '/' + resourceId(id); }
