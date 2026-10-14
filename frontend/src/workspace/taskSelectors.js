import { toTime } from './dateFormat';

export const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  terminada: 'Terminada',
};

export const NO_OWNER = '__sin_responsable__';

export const DEFAULT_FILTERS = { text: '', status: 'all', owner: 'all' };

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? 'Estado no reconocido';
}

function ownerOf(item) {
  return typeof item.owner === 'string' ? item.owner.trim() : '';
}

// Responsables distintos, sin vacíos y en orden alfabético.
export function ownerOptions(items) {
  const names = new Set();
  items.forEach(item => {
    const name = ownerOf(item);
    if (name) names.add(name);
  });
  return [...names].sort((a, b) => a.localeCompare(b, 'es'));
}

// Lista activa: excluye archivadas, filtra y ordena por fecha prevista.
// Sin fecha (o fecha inválida) va al final; en empate, por id. No modifica `items`.
export function selectTasks(items, filters = DEFAULT_FILTERS) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const term = String(f.text ?? '').trim().toLocaleLowerCase('es');
  return items
    .filter(item => !item.archivedAt)
    .filter(item => String(item.title ?? '').toLocaleLowerCase('es').includes(term))
    .filter(item => f.status === 'all' || item.status === f.status)
    .filter(item => {
      if (f.owner === 'all') return true;
      return f.owner === NO_OWNER ? ownerOf(item) === '' : ownerOf(item) === f.owner;
    })
    .map(item => ({ item, due: toTime(item.dueDate) }))
    .sort((a, b) => {
      if (a.due === b.due) return String(a.item.id).localeCompare(String(b.item.id));
      if (a.due === null) return 1;
      if (b.due === null) return -1;
      return a.due - b.due;
    })
    .map(entry => entry.item);
}
