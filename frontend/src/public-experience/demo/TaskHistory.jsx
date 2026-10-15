/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
import React from 'react';
import { OWNERS } from './workspace-model';
import { EVENT_TYPES, INITIAL_HISTORY_FILTERS, archivedTasks, historyEvents, historyTime, invalidPeriod, describeChanges } from './task-history';
import { CaseTimeline } from './CasePanels';
import './task-history.css';

export default function TaskHistory({ data, scope, rows, selected, view, onView, filters, onFilters, onPick, onReport }) {
  const archived = archivedTasks(rows, filters), events = historyEvents(data, scope, filters);
  const set = patch => onFilters({ ...filters, ...patch });
  const invalid = invalidPeriod(filters), count = view === 'archive' ? archived.length : events.length;
  return <div className="task-history">
    <div data-guide="activity" className="desk-panel-heading"><div><h2>Archivo y cronología</h2><p>Conserva el contexto del trabajo, también después de terminarlo.</p></div><button className="desk-primary" onClick={onReport}>Descargar informe</button></div>
    <div className="history-tabs" role="group" aria-label="Vista del histórico"><button aria-pressed={view === 'archive'} onClick={() => { onView('archive'); set({ kind: 'all' }); }}>Tareas archivadas <span>{rows.filter(task => task.archivedAt).length}</span></button><button aria-pressed={view === 'timeline'} onClick={() => onView('timeline')}>Cronología de cambios</button></div>
    <div className="history-filters">
      <label className="history-search">Buscar tarea o referencia<input type="search" value={filters.query} onChange={e => set({ query: e.target.value })} placeholder="Código, título, norma…" /></label>
      <label>Responsable actual<select value={filters.owner} onChange={e => set({ owner: e.target.value })}><option>Todos</option>{OWNERS.map(owner => <option key={owner}>{owner}</option>)}</select></label>
      <label>Desde<input type="date" value={filters.from} onInput={e => set({ from: e.currentTarget.value })} onChange={e => set({ from: e.target.value })} /></label><label>Hasta<input type="date" value={filters.to} onInput={e => set({ to: e.currentTarget.value })} onChange={e => set({ to: e.target.value })} /></label>
      {view === 'timeline' && <label>Tipo de cambio<select value={filters.kind} onChange={e => set({ kind: e.target.value })}>{Object.entries(EVENT_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      <label>Orden de fechas<select value={filters.order} onChange={e => set({ order: e.target.value })}><option value="desc">Más recientes primero</option><option value="asc">Más antiguas primero</option></select></label>
    </div>
    <div className="history-filter-summary"><span role="status">{count} {view === 'archive' ? count === 1 ? 'tarea' : 'tareas' : count === 1 ? 'cambio' : 'cambios'} · fechas de {view === 'archive' ? 'archivo' : 'cambio'} · hora de Madrid</span><button onClick={() => onFilters({ ...INITIAL_HISTORY_FILTERS })}>Limpiar filtros</button></div>
    {invalid && <p role="alert" className="desk-error">La fecha «Desde» no puede ser posterior a «Hasta».</p>}
    {view === 'archive' ? <>
      <p className="desk-section-intro">Archivar retira una tarea terminada del panel activo, sin borrar su documentación. Restaurarla la devuelve como terminada. Para reabrir el trabajo, cambia después su estado.</p>
      <div className="history-archive-list">{archived.map(task => <button key={task.id} aria-pressed={selected === task.id} onClick={() => onPick(task.id)}><span className="desk-task-code">{task.code} · Terminada / archivada</span><strong>{task.title}</strong><span>{task.owner}</span><small>Archivada: {historyTime(task.archivedAt)}</small><small>Finalización: {task.completedAt ? historyTime(task.completedAt) : 'fecha no registrada en la versión anterior'}</small><span className="history-evidence">{task.evidence.length} documento(s) · sin revisar <b aria-hidden="true">↗</b></span></button>)}</div>
      {!archived.length && <div className="desk-empty"><h3>{rows.some(task => task.archivedAt) ? 'Sin coincidencias en el archivo' : 'Todavía no hay tareas archivadas'}</h3><p>Abre una tarea terminada en «Tareas y responsables» y pulsa «Archivar tarea». Su cronología y referencias seguirán disponibles aquí.</p></div>}
    </> : <>
      <p className="desk-section-intro">Cambios guardados en este navegador. «Responsable actual» filtra la asignación de hoy, no quién efectuó cada cambio. Las entradas anteriores pueden no conservar el valor previo.</p>
      <ol className="history-events">{events.map((event, index) => <li key={`${event.time}-${index}`}><time>{historyTime(event.time)}</time><div><button onClick={() => onPick(event.id)}>{rows.find(task => task.id === event.id)?.code} · {rows.find(task => task.id === event.id)?.title}</button><p>{event.text}</p>{describeChanges(event).length > 0 && <ul>{describeChanges(event).map((text, i) => <li key={i}>{text}</li>)}</ul>}<small>{event.actor || 'Actor no registrado · versión anterior'}{event.owner ? ` · Asignada a: ${event.owner}` : ''}</small></div></li>)}</ol>
      {!events.length && <div className="desk-empty"><h3>No hay cambios con esta selección</h3><p>Puedes ampliar los filtros. La falta de registros no acredita que nunca se haya trabajado en una tarea.</p></div>}
      <details className="history-background"><summary>Antecedentes ficticios · separados del registro local</summary><CaseTimeline scope={scope} onTask={onPick} /></details>
    </>}
    <p className="history-limit">Registro local, no auditoría de servidor. Las versiones anteriores guardaban hasta 50 cambios; desde B.06 no se recortan, pero su conservación depende de este navegador. Archivar o terminar no acredita cumplimiento.</p>
  </div>;
}
