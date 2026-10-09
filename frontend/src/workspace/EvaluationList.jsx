import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Workspace.module.css';

const formatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid',
});

export default function EvaluationList({ items }) {
  return (
    <ul className={styles.list}>
      {items.map(item => (
        <li className={styles.row} key={item.id}>
          <div>
            <Link to={`/historial/${item.id}`}>{item.name}</Link>
            <p>{item.formula}</p>
            {item.date === null ? <p>Fecha no disponible</p> : (
              <time dateTime={new Date(item.date).toISOString()}>
                {formatter.format(item.date)} (Madrid)
              </time>
            )}
          </div>
          <strong>{item.label}</strong>
        </li>
      ))}
    </ul>
  );
}
