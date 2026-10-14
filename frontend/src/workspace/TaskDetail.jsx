import React, { useId, useState } from 'react';
import { statusLabel } from './taskSelectors';
import styles from './WorkspaceUnits.module.css';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Contrato propuesto (no hay endpoint todavía):
//   task: { id, title, status, owner?, dueDate?: 'YYYY-MM-DD'|null, notes?, context?, reason?,
//           references?: [{ label, source? }], documents?: [{ id, name }],
//           updatedAt?, archivedAt? }
//   onSave(id, changes, operation)  changes = { owner, dueDate, notes }
//     operation: 'save' | 'finish' | 'reopen'. El estado resultante lo decide el servidor.
//   onArchive(id)
//   saving / error los controla el contenedor. El borrador no se pierde si hay error.
function TaskForm({ task, saving, error, onSave, onArchive }) {
  const fieldId = useId();
  const initial = {
    owner: (typeof task.owner === 'string' ? task.owner.trim() : '') || null,
    dueDate: DATE_ONLY.test(task.dueDate ?? '') ? task.dueDate : null,
    notes: (task.notes ?? '').trim(),
  };
  const [owner, setOwner] = useState(initial.owner ?? '');
  const [dueDate, setDueDate] = useState(initial.dueDate ?? '');
  const [notes, setNotes] = useState(initial.notes);

  const changes = { owner: owner.trim() || null, dueDate: dueDate || null, notes: notes.trim() };
  const dirty = changes.owner !== initial.owner
    || changes.dueDate !== initial.dueDate
    || changes.notes !== initial.notes;

  const archived = Boolean(task.archivedAt);
  const finished = task.status === 'terminada';
  const open = task.status === 'pendiente' || task.status === 'en_curso';
  const references = Array.isArray(task.references) ? task.references : [];
  const documents = Array.isArray(task.documents) ? task.documents : [];

  const submit = event => {
    event.preventDefault();
    if (onSave) onSave(task.id, changes, 'save');
  };

  return (
    <section className={styles.unit} aria-label="Detalle de la tarea">
      <h2>{task.title || 'Tarea sin título'}</h2>
      <p><span className={styles.badge}>{statusLabel(task.status)}</span></p>

      <dl className={styles.dl}>
        <dt>Contexto</dt>
        <dd>{task.context || 'Sin contexto indicado'}</dd>
        <dt>Motivo</dt>
        <dd>{task.reason || 'Sin motivo indicado'}</dd>
        <dt>Referencias</dt>
        <dd>
          {references.length === 0 ? 'Sin referencias indicadas' : (
            <ul>
              {references.map((ref, index) => (
                <li key={`${ref.label}-${index}`}>
                  {ref.label}{ref.source ? ` · ${ref.source}` : ''}
                </li>
              ))}
            </ul>
          )}
        </dd>
        <dt>Documentación relacionada</dt>
        <dd>
          {documents.length === 0 ? 'Sin documentación relacionada' : (
            <>
              <ul>
                {documents.map(doc => <li key={doc.id}>{doc.name}</li>)}
              </ul>
              <p className={styles.help}>
                Que un documento figure aquí no prueba su contenido ni el cumplimiento.
              </p>
            </>
          )}
        </dd>
      </dl>

      {archived ? (
        <p role="status">Tarea archivada. Ya no aparece en la lista activa.</p>
      ) : (
        <form onSubmit={submit} className={styles.form}>
          <label className={styles.field} htmlFor={`${fieldId}-owner`}>Responsable</label>
          <input
            id={`${fieldId}-owner`} type="text" value={owner} disabled={saving}
            onChange={event => setOwner(event.target.value)}
          />
          <label className={styles.field} htmlFor={`${fieldId}-due`}>Fecha prevista</label>
          <input
            id={`${fieldId}-due`} type="date" value={dueDate} disabled={saving}
            onChange={event => setDueDate(event.target.value)}
          />
          <label className={styles.field} htmlFor={`${fieldId}-notes`}>Notas</label>
          <textarea
            id={`${fieldId}-notes`} rows={4} value={notes} disabled={saving}
            onChange={event => setNotes(event.target.value)}
          />

          {saving && <p role="status">Guardando...</p>}
          {error && <div className={styles.alert} role="alert">{error}</div>}

          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled={saving || !dirty}>
              Guardar cambios
            </button>
            {open && (
              <button
                type="button" className={styles.secondary} disabled={saving}
                onClick={() => onSave && onSave(task.id, changes, 'finish')}
              >
                Finalizar tarea
              </button>
            )}
            {finished && (
              <>
                <button
                  type="button" className={styles.secondary} disabled={saving}
                  onClick={() => onSave && onSave(task.id, changes, 'reopen')}
                >
                  Reabrir tarea
                </button>
                <button
                  type="button" className={styles.secondary} disabled={saving}
                  onClick={() => onArchive && onArchive(task.id)}
                >
                  Archivar tarea
                </button>
              </>
            )}
          </div>
          <p className={styles.help}>
            Terminada indica que el trabajo se dio por hecho; no acredita por sí sola el cumplimiento.
            {finished && ' Archivar retira la tarea de la lista activa; no la borra.'}
            {!open && !finished && ' Estado no reconocido: no se ofrecen acciones de estado.'}
          </p>
        </form>
      )}
    </section>
  );
}

export default function TaskDetail({ task = null, saving = false, error = null, onSave, onArchive }) {
  if (!task) {
    return (
      <section className={styles.unit} aria-label="Detalle de la tarea">
        <p role="status">Selecciona una tarea para ver su detalle.</p>
      </section>
    );
  }
  // El borrador solo se reinicia si cambia la tarea o llega una versión nueva del servidor.
  return (
    <TaskForm
      key={`${task.id}:${task.updatedAt ?? ''}`}
      task={task} saving={saving} error={error} onSave={onSave} onArchive={onArchive}
    />
  );
}
