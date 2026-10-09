import React, { useEffect, useState } from 'react';
import { getHistorial } from '../services/api';
import { toEvaluations, selectEvaluations } from './historyAdapter';
import WorkspaceLayout from './WorkspaceLayout';
import EvaluationList from './EvaluationList';
import styles from './Workspace.module.css';

export default function WorkspacePage() {
  const [state, setState] = useState({ status: 'loading', items: [] });
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState('all');

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', items: [] });
    getHistorial()
      .then(toEvaluations)
      .then(items => {
        if (active) setState({ status: 'ready', items });
      })
      .catch(() => {
        if (active) setState({ status: 'error', items: [] });
      });
    return () => { active = false; };
  }, [retry]);

  const visible = selectEvaluations(state.items, query, version);

  return (
    <WorkspaceLayout>
      <p className={styles.notice}>
        Estos índices proceden de respuestas declaradas.
        No acreditan conformidad ni equivalen a una certificación.
      </p>
      {state.status === 'loading' && <p role="status">Cargando...</p>}
      {state.status === 'error' && (
        <div role="alert">
          <p>No se pudo cargar el historial. No se muestran datos de ejemplo.</p>
          <button type="button" onClick={() => setRetry(n => n + 1)}>
            Reintentar
          </button>
        </div>
      )}
      {state.status === 'ready' && (
        <>
          <div className={styles.filters}>
            <label>Buscar normativa
              <input type="search" value={query}
                onChange={event => setQuery(event.target.value)} />
            </label>
            <label>Fórmula de la evaluación
              <select value={version}
                onChange={event => setVersion(event.target.value)}>
                <option value="all">Todas las fórmulas</option>
                <option value="1">Anterior (v1)</option>
                <option value="2">Actual (v2)</option>
              </select>
            </label>
          </div>
          <p role="status">{visible.length} de {state.items.length} evaluaciones</p>
          {!state.items.length ? <p>Aún no tienes evaluaciones guardadas.</p>
            : !visible.length ? <p>No hay resultados para estos filtros.</p>
            : <EvaluationList items={visible} />}
        </>
      )}
    </WorkspaceLayout>
  );
}
