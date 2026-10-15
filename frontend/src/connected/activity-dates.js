// Calendar-day filters in Europe/Madrid, independent of the browser time zone.
export const activityIdFields = Object.freeze({
  unidadId:'Unidad de trabajo', subespacioId:'Servicio o producto', documentoId:'Documento',
  contextoId:'Contexto general', operacionId:'Operación', decisionId:'Decisión general',
  decisionOperacionId:'Decisión de operación', actorId:'Usuario autor del cambio',
  miembroId:'Membresía afectada por el cambio'
});
export const emptyActivityForm = () => ({ categoria:'', orden:'desc', desde:'', hasta:'',
  ...Object.fromEntries(Object.keys(activityIdFields).map(k => [k, ''])), reglaId:'', accion:'' });
export function madridBoundary(day, next = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) throw new Error('Fecha no válida');
  const utc = new Date(day + 'T00:00:00.000Z');
  if (Number.isNaN(utc.getTime()) || utc.toISOString().slice(0, 10) !== day) throw new Error('Fecha no válida');
  if (next) utc.setUTCDate(utc.getUTCDate() + 1);
  const target = utc.getTime(); let guess = target;
  const format = new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Madrid', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(format.formatToParts(new Date(guess)).map(p => [p.type, p.value]));
    const localAsUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    guess += target - localAsUTC;
  }
  return new Date(guess).toISOString();
}
export function activityFilters(form) {
  if (form.desde && form.hasta && form.desde > form.hasta) throw new Error('La fecha inicial debe ser anterior o igual a la final.');
  if (form.orden && !['asc','desc'].includes(form.orden)) throw new Error('Orden no válido.');
  const extra = {};
  for (const [key, label] of Object.entries(activityIdFields)) {
    const value = (form[key] || '').trim();
    if (!value) continue;
    if (!/^[a-f0-9]{24}$/i.test(value)) throw new Error(`${label}: introduce un identificador de 24 caracteres hexadecimales.`);
    extra[key] = value.toLowerCase();
  }
  for (const key of ['reglaId','accion']) {
    const value = (form[key] || '').trim();
    if (!value) continue;
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(value) || ['constructor','prototype','__proto__','toJSON'].includes(value)) throw new Error(`${key === 'reglaId' ? 'Regla' : 'Acción'}: utiliza la clave exacta registrada por el servidor, sin espacios.`);
    extra[key] = value;
  }
  return { ...extra, categoria: form.categoria || undefined, orden: form.orden || 'desc',
    desde: form.desde ? madridBoundary(form.desde) : undefined,
    hasta: form.hasta ? madridBoundary(form.hasta, true) : undefined };
}
