import React from 'react';
import { formatDay } from './dateFormat';
import styles from './WorkspaceUnits.module.css';

const ORIGIN_LABELS = {
  legal: 'Obligación legal',
  contractual: 'Requisito contractual',
  voluntary: 'Estándar voluntario',
};

const REVIEW_LABELS = {
  pending: 'Pendiente de revisión',
  in_review: 'En revisión',
  reviewed: 'Revisión realizada',
};

// Componente puro. Muestra de dónde viene cada exigencia y qué falta por confirmar.
// items: [{ id, title, origin, source?, reviewStatus, reviewedAt?, missing?: string[] }]
// Un origen o estado desconocido se indica como tal; nunca se adivina.
export default function RequirementPanel({ items = [] }) {
  const list = Array.isArray(items) ? items : [];

  return (
    <section className={styles.unit} aria-label="Requisitos del alcance">
      <p className={styles.help}>
        Que un requisito aparezca aquí no establece por sí solo que sea jurídicamente aplicable.
        Confirma su aplicabilidad antes de actuar.
      </p>

      {list.length === 0 ? (
        <p role="status">No hay requisitos para este alcance todavía.</p>
      ) : (
        <ul className={styles.reqList}>
          {list.map(item => {
            const originLabel = ORIGIN_LABELS[item.origin] ?? 'Origen sin clasificar';
            const reviewLabel = REVIEW_LABELS[item.reviewStatus] ?? 'Estado de revisión desconocido';
            const reviewedDay = formatDay(item.reviewedAt);
            const missing = Array.isArray(item.missing) ? item.missing : [];
            return (
              <li className={styles.reqItem} key={item.id}>
                <h3>{item.title || 'Requisito sin título'}</h3>
                <p className={styles.reqMeta}>
                  <span className={styles.badge}>{originLabel}</span>
                  <span>Fuente: {item.source || 'Fuente sin indicar'}</span>
                </p>
                <p className={styles.reqMeta}>
                  <span className={styles.badge}>{reviewLabel}</span>
                  {item.reviewStatus === 'reviewed' && (
                    <span>
                      {reviewedDay ? `Revisado el ${reviewedDay}` : 'Fecha de revisión no disponible'}
                    </span>
                  )}
                </p>
                {missing.length > 0 && (
                  <div className={styles.missing}>
                    <p><strong>Falta por confirmar</strong></p>
                    <ul>
                      {missing.map(text => <li key={text}>{text}</li>)}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
