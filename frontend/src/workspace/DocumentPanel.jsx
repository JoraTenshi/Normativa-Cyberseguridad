import React from 'react';
import { formatDay } from './dateFormat';
import styles from './Documents.module.css';

const KIND_LABELS = { guide: 'Guía orientativa', file: 'Archivo aportado' };
const REVIEW_LABELS = {
  pending: 'Pendiente de revisión',
  in_review: 'En revisión',
  reviewed: 'Revisión realizada',
};
const RELATION_LABELS = { task: 'Tarea', requirement: 'Requisito' };

// Componente puro. Separa tres cosas distintas: la guía (qué documento hace falta),
// el archivo realmente aportado y la revisión de ese archivo.
// items: [{ id, name, kind: 'guide'|'file', purpose?, provider?,
//           relatedTo?: { type: 'task'|'requirement', label },
//           uploadedAt?, reviewStatus?, reviewedAt? }]
// accessDenied limpia el detalle protegido y NO se presenta como error del documento.
export default function DocumentPanel({ items = [], error = null, accessDenied = false }) {
  const list = Array.isArray(items) ? items : [];

  return (
    <section className={styles.unit} aria-label="Documentación">
      <p className={styles.help}>
        Una guía explica qué documento hace falta; un archivo aportado es un documento real.
        Que un archivo figure como aportado no valida su contenido ni acredita el cumplimiento.
      </p>

      {accessDenied ? (
        <div className={styles.alert} role="alert">
          No tienes acceso a los documentos de este alcance.
        </div>
      ) : error ? (
        <div className={styles.alert} role="alert">{error}</div>
      ) : list.length === 0 ? (
        <p role="status">No hay documentación para este alcance todavía.</p>
      ) : (
        <ul className={styles.docList}>
          {list.map(item => {
            const isGuide = item.kind === 'guide';
            const isFile = item.kind === 'file';
            const kindLabel = KIND_LABELS[item.kind] ?? 'Tipo sin clasificar';
            const relation = item.relatedTo && item.relatedTo.label
              ? `${RELATION_LABELS[item.relatedTo.type] ?? 'Elemento'}: ${item.relatedTo.label}`
              : 'Sin relación indicada';
            const uploadedDay = formatDay(item.uploadedAt);
            const reviewedDay = formatDay(item.reviewedAt);
            const reviewLabel = REVIEW_LABELS[item.reviewStatus] ?? 'Estado de revisión desconocido';
            return (
              <li className={styles.docItem} key={item.id}>
                <h3>{item.name || 'Documento sin nombre'}</h3>
                <p className={styles.meta}>
                  <span className={styles.badge}>{kindLabel}</span>
                  {isGuide && <span>Esto es una guía: todavía no es un archivo aportado.</span>}
                </p>
                <p>Para qué sirve: {item.purpose || 'Sin descripción'}</p>
                <p>Relacionado con: {relation}</p>
                <p>Lo aporta: {item.provider || 'Sin responsable indicado'}</p>
                {isFile && (
                  <>
                    <p className={styles.meta}>
                      {uploadedDay ? `Aportado el ${uploadedDay}` : 'Fecha de aportación no disponible'}
                    </p>
                    <p className={styles.meta}>
                      <span className={styles.badge}>{reviewLabel}</span>
                      {item.reviewStatus === 'reviewed' && (
                        <span>
                          {reviewedDay ? `Revisado el ${reviewedDay}` : 'Fecha de revisión no disponible'}
                        </span>
                      )}
                    </p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
