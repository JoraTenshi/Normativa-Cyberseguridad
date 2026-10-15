import React, { useState } from 'react';
import { Panel, useRemote, RemoteStatus, when } from './ui';

// Visual primitives from B.06. No demo model, fabricated results or localStorage.
export function Glyph({ type = 'grid' }) {
  const paths = { grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', tasks:'m3 6 2 2 3-4M11 6h10M3 13h5m3 0h10M3 20h5m3 0h10', file:'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6', book:'M12 5v16M3 4c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1z', clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', arrow:'M5 12h14m-6-6 6 6-6 6', check:'m5 12 4 4L19 6', search:'M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0' };
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[type] || paths.grid}/></svg>;
}
function Metric({ title, remote, items, more, icon, disabled, onClick }) {
  const loaded = Array.isArray(remote.data?.[items]) && !remote.error && !remote.loading;
  const count = loaded ? remote.data[items].length : null;
  const incomplete = loaded && more(remote.data);
  return <button className="desk-metric" disabled={disabled} onClick={onClick}><span className="desk-metric-icon"><Glyph type={icon}/></span><span><strong>{title}</strong><b>{count === null ? '—' : `${count}${incomplete ? '+' : ''}`}</b><small>{disabled ? 'Acceso restringido' : remote.loading ? 'Consultando…' : remote.error ? 'No disponible' : incomplete ? 'Hay más registros; abre el listado' : 'Registros accesibles'}</small></span></button>;
}
export function Dashboard({ api, base, admin, onNavigate }) {
  const ops = useRemote(api, admin ? base+'/operaciones?limite=20' : null);
  const actions = useRemote(api, admin ? base+'/normativa/actuaciones?limite=20' : null);
  const docs = useRemote(api, base+'/documentos?estado=activo&limite=20');
  const spaces = useRemote(api, base+'/subespacios?estado=activo&limite=20');
  const [search, setSearch] = useState(''), [selected, setSelected] = useState(null);
  const rows = (ops.data?.operaciones || []).filter(o => `${o.nombre} ${o.descripcion || ''}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  const chosen = rows.find(o => o.id === selected) || rows[0];
  const spaceName = id => !id ? 'Ámbito de empresa' : spaces.data?.subespacios?.find(s => s.id === id)?.nombre || 'Servicio fuera de esta página';
  return <>
    <div className="desk-metrics">
      <Metric title="Operaciones" remote={ops} items="operaciones" more={d => d.paginacion?.hayMas} icon="tasks" disabled={!admin} onClick={() => onNavigate('operations')}/>
      <Metric title="Documentos activos" remote={docs} items="documentos" more={d => d.siguiente} icon="file" onClick={() => onNavigate('documents')}/>
      <Metric title="Servicios y productos" remote={spaces} items="subespacios" more={d => d.siguiente} icon="grid" onClick={() => onNavigate('spaces')}/>
      <Metric title="Actuaciones registradas" remote={actions} items="registros" more={d => d.paginacion?.hayMas} icon="check" disabled={!admin} onClick={() => onNavigate('tasks')}/>
    </div>
    <div className="desk-date-note"><span>Resumen de la primera página accesible · Hasta 20 registros por apartado</span><button onClick={() => { ops.refresh(); docs.refresh(); spaces.refresh(); actions.refresh(); }}>Actualizar resumen</button></div>
    <div className="desk-columns"><section className="desk-center" aria-labelledby="overview-operations">
      <header className="desk-panel-heading"><div><span className="desk-overline">EL CASO CONCRETO, PRIMERO</span><h2 id="overview-operations">Operaciones de la empresa</h2></div>{admin && <button className="api-primary" onClick={() => onNavigate('operations')}>Gestionar operaciones</button>}</header>
      {admin ? <>
        <label className="desk-search"><Glyph type="search"/><span className="desk-sr-only">Buscar en las operaciones cargadas</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar en esta página de operaciones"/></label>
        <div className="desk-list-status"><RemoteStatus remote={ops}/></div>
        {ops.data && !ops.error && !ops.loading && <>
          {rows.length ? <table className="desk-table"><thead><tr><th>Operación</th><th>Servicio o producto</th><th>Revisión</th></tr></thead><tbody>{rows.map(o => <tr key={o.id} className={chosen?.id === o.id ? 'is-selected' : ''}><td><button className="desk-task-button" aria-pressed={chosen?.id === o.id} onClick={() => setSelected(o.id)}><strong>{o.nombre}</strong><small>{o.descripcion || 'Sin descripción adicional'}</small></button></td><td><span className="desk-ref">{spaceName(o.subespacioId)}</span></td><td><span className="desk-revision">v{o.versionActual}</span><small>{when(o.revision?.registradoEn)}</small></td></tr>)}</tbody></table>
            : <div className="desk-empty"><Glyph type="tasks"/><h3>{search ? 'Sin coincidencias en esta página' : 'Todavía no hay operaciones'}</h3><p>{search ? 'Prueba otro término o abre el listado completo para consultar más páginas.' : 'Empieza describiendo una actividad real de la empresa. Sus datos y revisiones quedarán separados de los demás casos.'}</p><button onClick={() => onNavigate('operations')}>{search ? 'Abrir listado completo' : 'Describir la primera operación'} <Glyph type="arrow"/></button></div>}
          <div className="desk-table-footer"><span>{rows.length} visibles de {ops.data.operaciones.length} cargadas{ops.data.paginacion?.hayMas ? ' · Hay páginas anteriores' : ''}</span><button onClick={() => onNavigate('operations')}>Todas las operaciones <Glyph type="arrow"/></button></div>
        </>}
      </> : <div className="desk-empty"><h3>Tu acceso está limitado a tu membresía</h3><p>Las operaciones y el contexto general están reservados al administrador. Puedes consultar los documentos y servicios que el servidor autorice para tu cuenta.</p><button onClick={() => onNavigate('documents')}>Abrir documentación <Glyph type="arrow"/></button></div>}
    </section><aside className="desk-detail" aria-label="Detalle y siguiente paso">
      <header><span className="desk-overline">{chosen ? 'OPERACIÓN SELECCIONADA' : 'SIGUIENTE PASO'}</span><h2>{chosen?.nombre || 'Delimita lo que hace tu empresa'}</h2></header>
      <div className="desk-detail-body">{chosen ? <><p>{chosen.descripcion || 'Esta operación aún no tiene una descripción adicional.'}</p><dl><dt>Ámbito</dt><dd>{spaceName(chosen.subespacioId)}</dd><dt>Revisión actual</dt><dd>{chosen.versionActual}</dd><dt>Último registro</dt><dd>{when(chosen.revision?.registradoEn)}</dd></dl><div className="desk-next"><strong>Continúa con las cuestiones del caso</strong><p>Consulta sus respuestas, datos y decisiones guardadas. Las propuestas normativas siguen siendo orientativas.</p></div><button className="api-primary" onClick={() => onNavigate('operations',chosen.id)}>Abrir esta operación <Glyph type="arrow"/></button></> : <><p>{admin ? 'Separa el contexto general de cada servicio o actividad concreta. Así podrás saber a qué caso pertenece cada respuesta.' : 'Revisa primero la documentación compartida contigo. Su disponibilidad depende de los permisos vigentes.'}</p><button className="api-primary" onClick={() => onNavigate(admin ? 'context' : 'documents')}>{admin ? 'Revisar contexto de empresa' : 'Consultar documentos'}</button></>}
        <div className="desk-detail-note"><strong>Información declarada, no certificada</strong><p>Una operación registrada o un PDF adjunto no significa que sus requisitos estén cumplidos.</p></div>
      </div>
    </aside></div>
    <div className="desk-resource-notices"><RemoteStatus remote={docs}/><RemoteStatus remote={spaces}/></div>
    <div className="desk-bottom-grid"><section className="desk-next-card"><Glyph type="file"/><div><h2>Documentación con trazabilidad</h2><p>Consulta los PDF, su historial de versiones y los permisos de lectura.</p><button onClick={() => onNavigate('documents')}>Abrir documentación <Glyph type="arrow"/></button></div></section><section className="desk-next-card"><Glyph type="clock"/><div><h2>Qué ha cambiado</h2><p>El historial recoge los eventos guardados y permite filtrarlos por el alcance autorizado.</p><button onClick={() => onNavigate('activity')}>Consultar historial <Glyph type="arrow"/></button></div></section></div>
  </>;
}
export function PendingSection({ section, admin, onNavigate }) {
  return <Panel title={section === 'tasks' ? 'El trabajo colaborativo todavía no está conectado' : 'El catálogo del alcance todavía no está integrado'}>
    <span className="desk-pending">Integración pendiente</span>
    {section === 'tasks' ? <><p>El dashboard anterior simulaba tareas, responsables, evidencias y estados. Aquí no se han trasladado esos ejemplos como datos de tu organización.</p><p>Falta conectar la asignación, el trabajo compartido, la revisión favorable y el archivo. Las métricas deberán derivarse de requisitos aplicables y revisados, no de contar operaciones o archivos adjuntos.</p><p>Los gráficos de cumplimiento y el PDS quedan pendientes de ese circuito; no se muestran porcentajes ni documentos ficticios.</p></> : <><p>No hay en esta pantalla un catálogo normativo completo y validado para tu empresa. La ausencia de referencias no significa que no tengas obligaciones.</p><p>Sí puedes consultar las cuestiones y decisiones de una operación. El borrador RGPD y cualquier regla marcada DEMO conservan sus avisos y límites; no equivalen a una revisión jurídica ni a una certificación.</p></>}
    <div className="api-actions"><button onClick={() => onNavigate(admin ? 'operations' : 'documents')}>{admin ? 'Ir a operaciones y cuestiones' : 'Consultar documentación'}</button><button onClick={() => onNavigate('overview')}>Volver a la vista general</button></div>
  </Panel>;
}
