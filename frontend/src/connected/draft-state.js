const dirty = new Set();
export function markDraft(id, value) { value ? dirty.add(id) : dirty.delete(id); }
export function hasDrafts() { return dirty.size > 0; }
export function confirmLeave(message = 'Hay cambios sin guardar. ¿Descartar ese borrador y continuar?') { return !hasDrafts() || window.confirm(message); }
