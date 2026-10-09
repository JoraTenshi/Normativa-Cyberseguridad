import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Workspace.module.css';

export default function WorkspaceLayout({ children }) {
  return (
    <section className={styles.shell} aria-label="Espacio de trabajo">
      <aside className={styles.sidebar}>
        <p className={styles.eyebrow}>NormativaCheck</p>
        <nav aria-label="Secciones del espacio">
          <Link to="/espacio-de-trabajo" aria-current="page">
            Evaluaciones
          </Link>
          <Link to="/">Nueva autoevaluación</Link>
          <Link to="/settings">Seguridad de mi cuenta</Link>
        </nav>
        <p>Vista personal. Todavía no es un espacio multiempresa.</p>
      </aside>
      <div className={styles.content}>
        <header>
          <p className={styles.eyebrow}>Espacio de trabajo</p>
          <h1>Mis evaluaciones</h1>
          <p>Consulta y filtra las evaluaciones guardadas de tu cuenta.</p>
        </header>
        {children}
      </div>
    </section>
  );
}
