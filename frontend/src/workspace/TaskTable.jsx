import React from 'react';
import {
  DEFAULT_FILTERS, NO_OWNER, STATUS_LABELS, ownerOptions, selectTasks, statusLabel,
} from './taskSelectors';
import { formatDay } from './dateFormat';
import styles from './WorkspaceUnits.module.css';

// Componente puro: la página contenedora es dueña de `filters` y de la selección.
// items: [{ id, title, status, owner?, dueDate?, archivedAt? }]
// onFilterChange recibe siempre el objeto de filtros completo.
export default function TaskTable({
  items = [], filters = DEFAULT_FILTERS, onFilterChange, onSelect, selectedId = null,
  showDueDate = true, contextLabel = 'Tareas del alcance', emptyLabel = 'Todavía no hay tareas en este alcance.',
}) {
  const list = Array.isArray(items) ? items : [];
  const active = list.filter(item => !item.archivedAt);
  const current = { ...DEFAULT_FILTERS, ...filters };
  const visible = selectTasks(list, current);

  const owners = ownerOptions(active);
  const knownOwner = current.owner === 'all' || current.owner === NO_OWNER
    || owners.includes(current.owner);
  const ownerChoices = knownOwner ? owners : [...owners, current.owner];

  const update = patch => onFilterChange && onFilterChange({ ...current, ...patch });

  return (
    <section className={styles.unit} aria-label="Tareas">
      {active.length === 0 ? (
        <p role="status">{emptyLabel}</p>
      ) : (
        <>
          <div className={styles.filtersRow}>
            <label className={styles.field}>Buscar tarea
              <input
                type="search"
                value={current.text}
                onChange={event => update({ text: event.target.value })}
              />
            </label>
            <label className={styles.field}>Estado
              <select value={current.status} onChange={event => update({ status: event.target.value })}>
                <option value="all">Todos los estados</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>Responsable
              <select value={current.owner} onChange={event => update({ owner: event.target.value })}>
                <option value="all">Todos los responsables</option>
                <option value={NO_OWNER}>Sin responsable</option>
                {ownerChoices.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          </div>

          <p role="status">{visible.length} de {active.length} tareas</p>

          {visible.length === 0 ? (
            <p>No hay tareas para estos filtros.</p>
          ) : (
            <div className={styles.tableWrap} role="region" aria-label="Tabla de tareas" tabIndex={0}>
              <table className={styles.table}>
                <caption>{contextLabel}</caption>
                <thead>
                  <tr>
                    <th scope="col">Tarea</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Responsable</th>
                    {showDueDate && <th scope="col">Fecha prevista</th>}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(task => {
                    const selected = task.id === selectedId;
                    const day = formatDay(task.dueDate);
                    const owner = typeof task.owner === 'string' ? task.owner.trim() : '';
                    return (
                      <tr key={task.id} className={selected ? styles.rowSelected : undefined}>
                        <th scope="row">
                          <button
                            type="button"
                            className={styles.rowButton}
                            aria-current={selected ? 'true' : undefined}
                            onClick={() => onSelect && onSelect(task.id)}
                          >
                            {task.title || 'Tarea sin título'}
                          </button>
                        </th>
                        <td>{statusLabel(task.status)}</td>
                        <td>{owner || 'Sin responsable'}</td>
                        {showDueDate && <td>
                          {day ? <time dateTime={task.dueDate}>{day}</time> : 'Sin fecha prevista'}
                        </td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
