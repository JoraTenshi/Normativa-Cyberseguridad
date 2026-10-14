const dayFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium', timeZone: 'Europe/Madrid',
});

// Devuelve milisegundos o null. Una fecha ausente o inválida nunca se sustituye por hoy.
export function toTime(value) {
  if (typeof value !== 'string' || value === '') return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function formatDay(value) {
  const time = toTime(value);
  return time === null ? null : dayFormatter.format(time);
}
