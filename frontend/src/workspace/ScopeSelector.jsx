import React, { useId } from 'react';
import styles from './WorkspaceUnits.module.css';

// Componente puro: no guarda la selección ni pide datos. La página contenedora
// valida el contexto y decide qué hacer en onChange.
// options: [{ id, name, description?, restricted? }]
export default function ScopeSelector({ options = [], selectedId = null, onChange, error = null }) {
  const groupName = useId();
  const list = Array.isArray(options) ? options : [];
  const selected = list.find(option => option.id === selectedId) ?? null;
  const hasSelection = selectedId !== null && selectedId !== undefined;
  const missing = hasSelection && !selected;
  const restricted = Boolean(selected && selected.restricted);

  return (
    <section className={styles.unit} aria-label="Alcance de trabajo">
      <p className={styles.help}>
        Un alcance es el servicio o producto que se está considerando.
        No equivale al sector de la empresa ni a una norma.
      </p>

      {error ? (
        <div className={styles.alert} role="alert">{error}</div>
      ) : list.length === 0 ? (
        <p role="status">No hay alcances definidos todavía.</p>
      ) : (
        <>
          <fieldset className={styles.fieldset}>
            <legend>Elige el alcance en el que vas a trabajar</legend>
            <ul className={styles.optionList}>
              {list.map(option => {
                const checked = option.id === selectedId;
                return (
                  <li key={option.id}>
                    <label className={`${styles.option} ${checked ? styles.optionChecked : ''}`}>
                      <input
                        type="radio"
                        name={groupName}
                        value={option.id}
                        checked={checked}
                        disabled={Boolean(option.restricted)}
                        onChange={() => {
                          // Un alcance restringido nunca se notifica, aunque el DOM lo permita.
                          if (!option.restricted && onChange) onChange(option.id);
                        }}
                      />
                      <span>
                        <strong>{option.name}</strong>
                        {option.restricted && (
                          <span className={styles.badge}>Acceso restringido</span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          {missing ? (
            <div className={styles.alert} role="alert">
              El alcance seleccionado ya no está disponible. Elige otro de la lista.
            </div>
          ) : restricted ? (
            <div className={styles.alert} role="alert">
              No tienes acceso al alcance seleccionado, por lo que no se muestra su contexto.
            </div>
          ) : selected ? (
            <div className={styles.context} role="status">
              <p>Contexto actual: <strong>{selected.name}</strong></p>
              {selected.description && <p>{selected.description}</p>}
            </div>
          ) : (
            <p role="status">Ningún alcance seleccionado.</p>
          )}
        </>
      )}
    </section>
  );
}
