/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
import React, { useEffect, useRef, useState } from 'react';
import { ACTIVITIES, SCOPES } from './model';
import { CASE_DATE, WORKSPACE_KEY, OWNERS, STATES, REFERENCES, createWorkspace, validWorkspace, rowsFor, countsFor, filterTasks, overdue, changeTask, simulateEvidence, setTaskArchived } from './workspace-model';
import TaskHistory from './TaskHistory';
import { TASK_ORDERS, INITIAL_HISTORY_FILTERS, sortTasks, archivedTasks, historyTime, invalidPeriod, historySelection, buildHistoryReport } from './task-history';
import './workspace.css';
import { HelpCenter } from './HelpCenter';
import GuidedTour from './GuidedTour';
import { HELP_KEY, TOUR_STEPS, validHelpProgress, tourProgress } from './help-model';
import { caseTask } from './case-content';
import { CompanyContext, CaseSummary, DiagnosticPanel, TaskContext, SampleReader, ContextualBasis, ScopeReport } from './CasePanels';
import EntryFocus from '../EntryFocus';
import CloseIcon from '../CloseIcon';
import useTaskArrival from '../../product/useTaskArrival';

const SECTIONS = {
  overview: ['Vista general', 'Prioridades y trabajo pendiente de este alcance.'],
  tasks: ['Tareas y responsables', 'Organiza actuaciones sin perder su fundamento ni sus evidencias.'],
  documents: ['Documentación', 'Lo que falta aportar y lo que todavía requiere revisión.'],
  regulations: ['Normativa del alcance', 'Solo referencias vinculadas a este caso y a sus tareas.'],
  activity: ['Histórico de tareas', 'Archivo, seguimiento de cambios e informe cronológico del alcance.']
};
const FILTERS = { all: 'Todas las tareas', active: 'En curso', blocked: 'Bloqueadas', review: 'Por revisar', overdue: 'Vencidas', missing: 'Sin documentación' };
function Glyph({ type = 'grid' }) {
  const shapes = { grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', tasks: 'm3 6 2 2 3-4M11 6h10M3 13h5m3 0h10M3 20h5m3 0h10', file: 'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6', book: 'M12 5v16M3 4c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1z', clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', arrow: 'M5 12h14m-6-6 6 6-6 6', down: 'm6 9 6 6 6-6', close: 'm6 6 12 12M6 18 18 6', plus: 'M12 5v14M5 12h14', search: 'M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0', check: 'm5 12 4 4L19 6', alert: 'M12 7v6m0 3v1M12 2 2 21h20z', external: 'M13 3h8v8m0-8L10 14M10 5H4v15h15v-6' };
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={shapes[type] || shapes.grid} /></svg>;
}
function Status({ value }) { return <span className={`desk-status status-${STATES.indexOf(value)}`}><span />{value}</span>; }
function day(value) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'Sin fecha'; }
function DeskModal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => { const previous = document.activeElement; ref.current.showModal(); ref.current.querySelector('button')?.focus(); return () => { ref.current?.close(); previous?.focus(); }; }, []);
  return <dialog className={`desk-modal ${wide ? 'desk-modal-wide' : ''}`} ref={ref} onCancel={onClose} aria-labelledby="desk-dialog-title"><header><h2 id="desk-dialog-title">{title}</h2><button className="desk-icon-button nc-close-control" aria-label="Cerrar diálogo" onClick={onClose}><CloseIcon/></button></header>{children}</dialog>;
}
function readHelp() {
  try { const value = JSON.parse(localStorage.getItem(HELP_KEY)); return validHelpProgress(value) ? value : null; }
  catch { return null; }
}
function readWorkspace(legacy) {
  try { const raw = localStorage.getItem(WORKSPACE_KEY); if (!raw) return { data: createWorkspace(legacy), error: '' }; const parsed = JSON.parse(raw); if (!validWorkspace(parsed)) throw new Error(); return { data: parsed, error: '' }; }
  catch { return { data: createWorkspace(legacy), error: 'No se ha podido recuperar B.06. El estado anterior se conserva; no se sobrescribirá. Puedes explorar o reiniciar B explícitamente.' }; }
}

export default function Workspace({ legacy, taskJump = null, entryFocus = null, initialScope = 'saas', initialSection = 'overview', initialPanel = 'work', initialModal = null, initialTask = 'proveedor' }) {
  const [entryDismissed,setEntryDismissed]=useState(false);
  const [initial] = useState(() => readWorkspace(legacy));
  const [data, setData] = useState(initial.data);
  const [blockedStorage, setBlockedStorage] = useState(!!initial.error);
  const [storageError, setStorageError] = useState(initial.error);
  const [scope, setScope] = useState(initialScope);
  const [section, setSection] = useState(initialSection);
  const [selected, setSelected] = useState(initialTask);
  const [filter, setFilter] = useState('all');
  const [owner, setOwner] = useState('Todos');
  const [query, setQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('due-asc');
  const [historyView, setHistoryView] = useState('archive');
  const [historyFilters, setHistoryFilters] = useState({ ...INITIAL_HISTORY_FILTERS });
  const [reportMode, setReportMode] = useState('all');
  const [exportError, setExportError] = useState('');
  const [panel, setPanel] = useState(initialPanel);
  const [activeRef, setActiveRef] = useState(null);
  const [modal, setModal] = useState(initialModal);
  const [helpProgress, setHelpProgress] = useState(readHelp);
  const [helpError, setHelpError] = useState('');
  const [helpArticle, setHelpArticle] = useState(null);
  const [tourIndex, setTourIndex] = useState(null);
  const [helpReturnIndex, setHelpReturnIndex] = useState(null);
  const tourReturn = useRef(null);
  const helpButton = useRef(null);
  const [reader, setReader] = useState({ id: 'encargo', section: null });
  const [draftProfile, setDraftProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [toast, setToast] = useState('');
  const [failSave, setFailSave] = useState(false);
  const [saveError, setSaveError] = useState('');
  const panelHeading = useRef(null);
  const [taskArrival,setTaskArrival]=useState(null);
  const [taskOrigin,setTaskOrigin]=useState(null);
  const lastTaskJump=useRef(null);
  const pageHeading = useRef(null);
  const allRows = rowsFor(data, scope);
  const counts = countsFor(data, scope);
  const priorityView = section === 'overview' && filter === 'all' && !query && owner === 'Todos';
  const panelRows = allRows.filter(t => !t.archivedAt);
  const candidates = priorityView ? panelRows.filter(t => overdue(t) || ['Bloqueada', 'Por revisar'].includes(t.status)) : panelRows;
  const visible = sortTasks(filterTasks(candidates, { filter, owner, query }), sortOrder);
  const visibleIds = visible.map(t => t.id).join(',');
  const task = allRows.find(t => t.id === selected);
  const showDetail = !!task && (taskArrival?.id===selected || (section === 'activity' && historyView === 'archive' ? archivedTasks(allRows, historyFilters).some(t => t.id === selected) : !['overview', 'tasks'].includes(section) || visible.some(t => t.id === selected)));
  const arrival=useTaskArrival(scope+':'+selected,taskArrival?.nonce,showDetail&&!modal);
  const reference = REFERENCES[activeRef || task?.refs[0]];
  const exportSelection = modal === 'history-report' ? historySelection(data, scope, historyFilters, historyView, reportMode) : null;

  useEffect(() => {
    if (blockedStorage) return;
    try { localStorage.setItem(WORKSPACE_KEY, JSON.stringify(data)); setStorageError(''); }
    catch { setStorageError('No se puede guardar en este navegador. Los cambios actuales podrían perderse al cerrar.'); }
  }, [data, blockedStorage]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!taskArrival && ['overview', 'tasks'].includes(section) && visible.length && !visible.some(t => t.id === selected)) {
      setSelected(visible[0].id); setPanel('work'); setActiveRef(null); setSaveError('');
    }
  }, [section, visibleIds, selected, taskArrival]);
  useEffect(() => {
    if (taskArrival || section !== 'activity' || historyView !== 'archive') return;
    const archived = archivedTasks(allRows, historyFilters);
    if (archived.length && !archived.some(t => t.id === selected)) { setSelected(archived[0].id); setPanel('work'); setActiveRef(null); }
  }, [section, historyView, historyFilters, scope, data, selected, taskArrival]);
  function navigate(next) { setTaskArrival(null);setTaskOrigin(null);setSection(next); setFilter('all'); setQuery(''); setOwner('Todos'); requestAnimationFrame(() => pageHeading.current?.focus({ preventScroll: true })); }
  function chooseScope(next) { setTaskArrival(null);setTaskOrigin(null);setScope(next); setSelected('proveedor'); setPanel('work'); setActiveRef(null); setFilter('all'); setQuery(''); setOwner('Todos'); setSaveError(''); }
  function pick(id, tab = 'work', ref = null, targetScope = scope) {
    if(!rowsFor(data,targetScope).some(row=>row.id===id)){setToast('No se ha encontrado la tarea solicitada. No se ha seleccionado otra tarea.');return;}
    setTaskOrigin({scope,selected,panel,activeRef,arrival:taskArrival,element:document.activeElement,scroll:window.scrollY});
    setScope(targetScope);setSelected(id);setPanel(tab);setActiveRef(ref);setSaveError('');setModal(null);setEntryDismissed(true);
    setTaskArrival(previous=>({id,nonce:(previous?.nonce||0)+1}));
  }
  function returnToTaskOrigin(){
    if(!taskOrigin)return;const previous=taskOrigin;setScope(previous.scope);setSelected(previous.selected);setPanel(previous.panel);setActiveRef(previous.activeRef);setTaskArrival(previous.arrival?{...previous.arrival,nonce:0}:null);setTaskOrigin(null);
    requestAnimationFrame(()=>{window.scrollTo({top:previous.scroll,behavior:'instant'});if(previous.element?.isConnected)previous.element.focus({preventScroll:true});else pageHeading.current?.focus({preventScroll:true});});
  }
  useEffect(()=>{if(taskJump&&lastTaskJump.current!==taskJump){lastTaskJump.current=taskJump;pick(taskJump.id,'work',null,taskJump.scope);}});
  function update(patch) {
    if (failSave) { setSaveError('Error simulado: el cambio no se ha aplicado. Desactiva el fallo en «Qué está simulado» y vuelve a intentarlo.'); return; }
    setData(previous => changeTask(previous, scope, selected, patch)); setSaveError(''); setToast('Cambio guardado en B.06 · no acredita cumplimiento.');
  }
  function selectFilter(next) { setFilter(next); setQuery(''); setOwner('Todos'); if (!['overview', 'tasks'].includes(section)) setSection('tasks'); }
  function openProfile() { setDraftProfile(structuredClone(data.profile)); setProfileError(''); setModal('profile'); }
  function saveProfile(e) { e.preventDefault(); if (!draftProfile.activities.length || !draftProfile.legalName.trim()) { setProfileError('Indica una denominación y al menos una actividad.'); return; } setData(previous => ({ ...previous, profile: draftProfile })); setModal(null); setToast('Perfil declarado actualizado. Las referencias del ejemplo no se recalculan.'); }
  function openDocument(id, section = null) { setReader({ id, section }); setModal('sample'); }
  function openCaseTask(id) { pick(id); }
  function archiveTask(archived) {
    if (failSave) { setSaveError('Error simulado: no se ha cambiado el archivo.'); return; }
    setData(previous => setTaskArchived(previous, scope, selected, archived));
    setSaveError(''); setModal(null);
    setToast(archived ? 'Tarea archivada. Disponible en «Histórico de tareas».' : 'Tarea restaurada al panel. Sigue terminada; no se ha reabierto.');
    if (!archived) { setSection('tasks'); setFilter('all'); setQuery(''); setOwner('Todos'); }
  }
  function openHistoryReport() { setReportMode('all'); setExportError(''); setModal('history-report'); }
  function downloadHistoryReport() {
    try {
      const report = buildHistoryReport(data, scope, { filters: historyFilters, view: historyView, mode: reportMode });
      const url = URL.createObjectURL(new Blob([report.html], { type: 'text/html;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = report.filename;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setExportError(''); setToast('Descarga solicitada: informe HTML local, legible e imprimible.');
    } catch { setExportError('No se ha podido preparar la descarga. No se ha modificado ninguna tarea.'); }
  }
  function saveHelp(index, complete = false) {
    const next = tourProgress(index, complete);
    setHelpProgress(next);
    try { localStorage.setItem(HELP_KEY, JSON.stringify(next)); setHelpError(''); }
    catch { setHelpError('El recorrido funciona, pero no se puede conservar su progreso al cerrar el navegador.'); }
  }
  function showTourStep(index) {
    setSection(TOUR_STEPS[index].section); setFilter('all'); setQuery(''); setOwner('Todos');
    setPanel('work'); setActiveRef(null); setTourIndex(index); saveHelp(index);
  }
  function startTour(index = 0) {
    tourReturn.current = { section, selected, filter, owner, query, panel, activeRef, scope, sortOrder, historyView, historyFilters, scroll: window.scrollY };
    setHelpReturnIndex(null);
    setModal(null); showTourStep(index);
  }
  function stopTour(complete = false) {
    if (tourIndex === null) return;
    saveHelp(tourIndex, complete); setTourIndex(null);
    const previous = tourReturn.current;
    if (previous) {
      setScope(previous.scope); setSection(previous.section); setSelected(previous.selected);
      setFilter(previous.filter); setOwner(previous.owner); setQuery(previous.query);
      setPanel(previous.panel); setActiveRef(previous.activeRef);
      setSortOrder(previous.sortOrder); setHistoryView(previous.historyView); setHistoryFilters(previous.historyFilters);
      requestAnimationFrame(() => { window.scrollTo({top:previous.scroll, behavior:'instant'}); helpButton.current?.focus({preventScroll:true}); });
    }
  }
  function openHelp(article = null) { stopTour(); setHelpArticle(article); setModal('help'); }
  function openTourArticle(article) {
    setHelpReturnIndex(tourIndex); setTourIndex(null); setHelpArticle(article); setModal('help');
  }
  function returnToTour() {
    const index = helpReturnIndex; setModal(null); setHelpReturnIndex(null);
    if (index !== null) showTourStep(index);
  }
  function closeModal() { if (modal === 'help' && helpReturnIndex !== null) returnToTour(); else setModal(null); }
  function visitFromHelp(destination) {
    setModal(null);
    if (destination === 'profile') { openProfile(); return; }
    if (destination === 'diagnostic') { setModal('diagnostic'); return; }
    navigate(destination === 'scope' ? 'overview' : destination);
    requestAnimationFrame(() => {
      if (destination === 'scope') document.querySelector('[data-guide="scope"] select')?.focus();
      else pageHeading.current?.scrollIntoView({block:'start', behavior:'instant'});
    });
  }
  const icons = ['grid', 'tasks', 'file', 'book', 'clock'];
  const refButton = (t, id) => <button key={id} className="desk-ref" title={`${REFERENCES[id].title}. Abrir fundamento de ${t.code}`} aria-label={`Ver fundamento ${REFERENCES[id].framework} ${REFERENCES[id].label} de ${t.code}`} onClick={() => pick(t.id, 'basis', id)}>{REFERENCES[id].framework === 'RGPD' ? 'RGPD' : REFERENCES[id].framework === 'NIST CSF 2.0' ? 'CSF 2.0' : 'Contrato'} <b>{REFERENCES[id].label}</b>{(id === 'transferencias' || (scope === 'medida' && REFERENCES[id].framework === 'RGPD')) && <span className="desk-ref-pending">Por confirmar</span>}<Glyph type="arrow" /></button>;

  return <div className="app variant-B desk-v2">
    <a href="#desk-main" className="skip-link">Saltar al contenido</a>
    <div className="desk-lab"><span><b>DEMO</b> Espacio de trabajo · Linde Studio</span><button onClick={() => setModal('guide')}>Cómo probar</button><button onClick={() => setModal('reset')}>Reiniciar demo</button></div>
    <header className="desk-top"><a className="desk-brand" href="#desk-main"><span className="brand-mark" aria-hidden="true"/>NormativaCheck</a><span className="desk-top-label">Espacio de trabajo</span><button className="desk-top-help" ref={helpButton} onClick={() => openHelp()}><span aria-hidden="true">?</span>Ayuda</button><div className="desk-org"><button data-guide="profile" onClick={openProfile} aria-label="Abrir perfil organizativo y legal"><span className="desk-avatar">LS</span><span>{data.profile.legalName.replace(' · empresa ficticia', '')}<small>Perfil organizativo y legal</small></span><Glyph type="down" /></button></div></header>
    {storageError && <div className="desk-warning" role="alert">{storageError}</div>}
    <div className="desk-shell">
      <aside className="desk-nav"><p className="desk-overline">Gestión del trabajo</p><nav aria-label="Secciones del espacio">{Object.entries(SECTIONS).map(([id, [name]], i) => <button key={id} aria-current={section === id ? 'page' : undefined} onClick={() => navigate(id)}><Glyph type={icons[i]} /><span>{name}</span>{id === 'tasks' && <small>{counts.total - counts.done}</small>}</button>)}</nav><div className="desk-scope-note"><span className="desk-overline">Alcance actual</span><strong>{SCOPES[scope].name}</strong><p>{scope === 'saas' ? 'Producto propio: Linde lo desarrolla, aloja y opera.' : 'Servicio propio: desarrollo y mantenimiento para terceros.'}</p><span>Solo se evalúa la actividad de Linde.</span></div><button className="desk-help" onClick={() => setModal('limits')}>Qué está simulado <Glyph type="arrow" /></button></aside>
      <main id="desk-main" className="desk-main">
        <header className="desk-page-header"><div><p className="desk-overline">{data.profile.legalName.replace(' · empresa ficticia', '')} / {SCOPES[scope].code}</p><h1 ref={pageHeading} tabIndex={-1}>{SECTIONS[section][0]}</h1><p>{SECTIONS[section][1]}</p><button data-guide="diagnostic" className="case-header-trigger" onClick={() => setModal('diagnostic')}>Ver diagnóstico de partida y fuentes ↗</button></div><label data-guide="scope" className="desk-scope-selector">Servicio o producto<select value={scope} onChange={e => chooseScope(e.target.value)}><option value="saas">Trama · SaaS propio</option><option value="medida">Desarrollo a medida · servicio</option></select></label></header>
        <div data-guide="metrics" className="desk-metrics" aria-label="Indicadores de trabajo del alcance">{[['active', counts.active, 'En curso', 'Trabajo iniciado', 'tasks'], ['blocked', counts.blocked, 'Bloqueadas', 'Falta una respuesta', 'alert'], ['review', counts.review, 'Por revisar', 'Comprobar el resultado', 'file'], ['overdue', counts.overdue, 'Vencidas', 'Fecha interna superada', 'clock']].map(([id, count, label, detail, icon]) => <button key={id} aria-pressed={filter === id} onClick={() => selectFilter(filter === id ? 'all' : id)}><span className={`desk-metric-icon metric-${id}`}><Glyph type={icon} /></span><span><b>{count}</b><strong>{label}</strong><small>{detail}</small></span><span className="desk-metric-arrow">↗</span></button>)}</div>
        <div className="desk-date-note"><span>{counts.done} de {counts.total} tareas terminadas · no es un porcentaje de cumplimiento</span><span>Fechas internas del escenario · 5 oct 2026</span></div>
        <div className="desk-columns">
          <section className="desk-center" aria-label={SECTIONS[section][0]}>
            {['overview', 'tasks'].includes(section) && <>
              <div className="desk-panel-heading"><h2>{priorityView ? 'Requieren atención' : filter === 'all' ? 'Tareas del panel activo' : FILTERS[filter] || filter}</h2><span>{visible.length} de {panelRows.length} en el panel</span></div>
              <div data-guide="tasks" className="desk-filters"><label className="desk-search"><span className="sr-only">Buscar tareas</span><Glyph type="search" /><input type="search" value={query} placeholder="Buscar tarea o referencia…" onChange={e => setQuery(e.target.value)} /></label><label><span className="sr-only">Filtrar por responsable</span><select value={owner} onChange={e => setOwner(e.target.value)}><option>Todos</option>{OWNERS.map(x => <option key={x}>{x}</option>)}</select></label><label><span className="sr-only">Filtrar por estado</span><select value={filter} onChange={e => setFilter(e.target.value)}>{Object.entries(FILTERS).map(([id, label]) => <option key={id} value={id}>{section === 'overview' && id === 'all' ? 'Prioridades' : label}</option>)}<option value="Terminada">Terminadas</option><option value="Pendiente">Pendientes</option></select></label></div>
              <div className="task-sort-bar"><span>{allRows.length - panelRows.length} archivadas fuera del panel · <button onClick={() => navigate('activity')}>Ver histórico</button></span><label>Ordenar por<select value={sortOrder} onChange={e => setSortOrder(e.target.value)}>{Object.entries(TASK_ORDERS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
              <div className="desk-table-wrap"><table className="desk-table"><thead><tr><th>Tarea / resultado pendiente</th><th>Estado</th><th>Responsable / fecha</th><th>Fundamento</th></tr></thead><tbody>{visible.map(t => <tr key={t.id} className={selected === t.id ? 'is-selected' : ''}><td><button className="desk-task-button" aria-pressed={selected === t.id} onClick={() => pick(t.id)}><span className="desk-task-code">{t.code} <i>{t.area}</i></span><strong>{t.title}</strong><small><Glyph type="file" />{t.evidence.length ? `${t.evidence.length} documento(s) · sin revisar` : 'Falta documentación'}</small></button></td><td><Status value={t.status} /></td><td><span className="desk-owner">{t.owner.split(' · ')[0]}</span><span className={overdue(t) ? 'desk-overdue' : 'desk-due'}>{overdue(t) && <Glyph type="clock" />}{day(t.date)}</span></td><td><div className="desk-reference-cell">{t.refs.map(id => refButton(t, id))}</div></td></tr>)}</tbody></table></div>
              {!visible.length && <div className="desk-empty"><Glyph type="search" /><h3>No hay tareas con estos filtros</h3><p>No se ha eliminado ninguna tarea ni se ha concluido que no existan obligaciones.</p><button onClick={() => { setSection('tasks'); setFilter('all'); setOwner('Todos'); setQuery(''); }}>Mostrar todas las tareas</button></div>}
              <footer className="desk-table-footer"><span>{priorityView ? 'Bloqueadas, por revisar o con fecha interna vencida.' : 'Selecciona una tarea para trabajar en el panel derecho.'}</span><button onClick={() => navigate(priorityView ? 'tasks' : 'regulations')}>{priorityView ? 'Ver todas las tareas' : 'Ver normativa del alcance'} <Glyph type="arrow" /></button></footer>
              {section === 'overview' && <CaseSummary scope={scope} onOpen={() => setModal('diagnostic')} />}
            </>}
            {section === 'documents' && <>
              <div data-guide="documents" className="desk-panel-heading"><h2>Documentos y evidencias</h2><span>{counts.documents} aportaciones simuladas</span></div><p className="desk-section-intro">Cada documento conserva su tarea y referencia de origen. Los registros simulados siguen sin revisar. Ahora puedes leer las muestras de texto preparadas para el caso, aunque no exista un archivo aportado; ambas cosas se mantienen separadas.</p>
              <div className="case-document-list">{allRows.map(t => { const sample = caseTask(scope,t.id).document; return <article key={t.id} className={`case-document-row ${selected === t.id ? 'is-selected' : ''}`}><button onClick={() => pick(t.id)}><b>{t.document}</b><small>{t.code} · {t.evidence.length ? `${t.evidence.length} registro(s) simulado(s) · sin revisar` : 'Pendiente de aportar'}</small></button><p>{t.expected}</p><p className="case-document-meta">Muestra de lectura: {sample.title}<br />{sample.id} · {sample.version} · {sample.kind}</p><div className="case-actions"><button onClick={() => openDocument(t.id)}>Leer muestra <span className="sr-only">de {t.document}</span></button><button onClick={() => pick(t.id)}>Trabajar en esta tarea <span className="sr-only">{t.code}</span></button></div></article>; })}</div>
            </>}
            {section === 'regulations' && <>
              <div className="desk-panel-heading"><h2>Referencias vinculadas a {SCOPES[scope].name}</h2><span>2 marcos + 1 compromiso</span></div>
              <div data-guide="regulations" className="desk-regulation-note"><strong>Selección del caso, no catálogo general</strong><p>La demo presupone una empresa establecida en España y el uso de datos personales en Trama. El servicio a medida conserva dudas de alcance. NIST CSF 2.0 se adopta voluntariamente en el ejemplo. No es una evaluación jurídica de una empresa real.</p></div>
              {['RGPD', 'NIST CSF 2.0', scope === 'saas' ? 'Acuerdo de servicio' : 'Contrato de desarrollo'].map(framework => {
                const ids = [...new Set(allRows.flatMap(t => t.refs))].filter(id => REFERENCES[id].framework === framework);
                return <section className="desk-framework" key={framework}><div><h3>{framework}</h3><span>{framework === 'RGPD' ? 'Preceptos seleccionados · comprobar condiciones' : framework === 'NIST CSF 2.0' ? 'Adopción voluntaria ficticia' : 'Contrato ficticio · no es una norma'}</span></div>{ids.map(id => { const ref = REFERENCES[id]; const linked = allRows.filter(t => t.refs.includes(id)); return <button key={id} onClick={() => pick(linked[0].id, 'basis', id)}><span><b>{ref.label}</b><strong>{ref.title}</strong><small>{linked.map(t => t.code).join(' · ')} · {id === 'transferencias' || (scope === 'medida' && framework === 'RGPD') ? 'Aplicabilidad pendiente' : framework === 'NIST CSF 2.0' ? 'Objetivo seleccionado' : 'Vinculado al escenario'}</small></span><Glyph type="arrow" /></button>; })}</section>;
              })}<p className="desk-note">Solo se muestran los preceptos utilizados en esta muestra. Su ausencia no demuestra que una norma no sea aplicable. La selección completa requerirá reglas y revisión.</p>
            </>}
            {section === 'activity' && <TaskHistory data={data} scope={scope} rows={allRows} selected={selected} view={historyView} onView={setHistoryView} filters={historyFilters} onFilters={setHistoryFilters} onPick={pick} onReport={openHistoryReport} />}
          </section>

          {showDetail ? <aside id="demo-task" className="desk-detail" aria-label="Detalle de la tarea seleccionada"><header data-guide="detail" ref={arrival.target} tabIndex={-1} aria-label={'Tarea: '+task.title} data-task-arrival={String(arrival.active)} data-task-id={task.id}><div>{arrival.active&&<span className="task-arrival-label" role="status">Tarea localizada</span>}<span className="desk-overline">Tarea seleccionada / {task.code}</span><h2 ref={panelHeading} tabIndex={-1}>{task.title}</h2></div><Status value={task.status} /></header>
            {taskOrigin&&<div className="desk-detail-body"><button onClick={returnToTaskOrigin}>← Volver a la vista anterior</button>{!visible.some(row=>row.id===selected)&&['overview','tasks'].includes(section)&&<p>Detalle abierto desde un enlace. Los filtros de la lista se mantienen.</p>}</div>}
            <div className="desk-detail-tabs" role="group" aria-label="Contenido del detalle"><button aria-pressed={panel === 'work'} onClick={() => setPanel('work')}>Trabajo y documentos</button><button aria-pressed={panel === 'basis'} onClick={() => setPanel('basis')}>Fundamento <span>{task.refs.length}</span></button></div>
            {panel === 'work' ? <div className="desk-detail-body">
              <section className="desk-next"><span className="desk-overline">Qué falta para avanzar</span><p>{task.gap}</p></section>
              {task.status === 'Terminada' && <section className="task-archive-action"><p>{task.archivedAt ? 'Archivada · lectura y consulta. Restaura la tarea para modificarla.' : 'Trabajo declarado terminado. Puedes retirarlo del panel sin perder su contexto.'}</p>{task.archivedAt && <small>Archivada el {historyTime(task.archivedAt)}</small>}<button className="desk-outline" onClick={() => { setSaveError(''); setModal(task.archivedAt ? 'restore-task' : 'archive-task'); }}>{task.archivedAt ? 'Restaurar al panel de tareas' : 'Archivar tarea'}</button></section>}
              <div className="desk-inline-fields"><label>Estado<select disabled={!!task.archivedAt} value={task.status} onChange={e => update({ status: e.target.value })}>{STATES.map(x => <option key={x}>{x}</option>)}</select></label><label>Responsable<select disabled={!!task.archivedAt} value={task.owner} onChange={e => update({ owner: e.target.value })}>{OWNERS.map(x => <option key={x}>{x}</option>)}</select></label><label>Fecha interna prevista<input disabled={!!task.archivedAt} type="date" value={task.date} onInput={e => update({ date: e.currentTarget.value })} onChange={e => { if (task.date !== e.target.value) update({ date: e.target.value }); }} /></label></div>
              {saveError && <p className="desk-error" role="alert">{saveError}</p>}
              <TaskContext key={`${scope}-${selected}`} scope={scope} id={selected} onTask={openCaseTask} onDocument={openDocument} />
              <section className="desk-linked-basis"><h3>Por qué está esta tarea</h3><p>{task.applicability}</p><div>{task.refs.map(id => refButton(task, id))}</div></section>
              <details className="desk-steps"><summary>Cómo abordar el trabajo</summary><ol>{task.steps.map(x => <li key={x}>{x}</li>)}</ol></details>
              <section className="desk-evidence"><div><h3>Documentación de apoyo</h3><span>{task.evidence.length}</span></div><p>{task.expected}</p>{task.evidence.length ? <ul>{task.evidence.map((e, i) => <li key={i}><Glyph type="file" /><span>{e.name}<small>Simulado · sin revisar</small></span></li>)}</ul> : <p className="desk-empty-evidence">Todavía no se ha aportado un documento a esta tarea.</p>}<button className="desk-outline" disabled={!!task.archivedAt} onClick={() => setModal('evidence')}><Glyph type="plus" />Añadir evidencia de ejemplo</button></section>
              <details className="desk-note-editor"><summary>Nota de trabajo {task.note && '· guardada'}</summary><label>Nota de la empresa<textarea disabled={!!task.archivedAt} key={`${scope}-${selected}`} defaultValue={task.note} maxLength={500} placeholder="Solo información ficticia en esta demo." onBlur={e => { if (e.target.value !== task.note) update({ note: e.target.value }); }} /></label><small>Se guarda al salir del campo. No cambia la aplicabilidad.</small></details>
              <p className="desk-boundary">Terminar la tarea no acredita cumplimiento. Las evidencias de la demo siguen sin revisar.</p>
            </div> : <div className="desk-detail-body desk-basis">
              <div className="desk-reference-tabs">{task.refs.map(id => <button key={id} aria-pressed={(activeRef || task.refs[0]) === id} onClick={() => setActiveRef(id)}>{REFERENCES[id].label}</button>)}</div>
              <span className="desk-origin">{reference.origin}</span><h3 className="desk-basis-title">{reference.framework} · {reference.label}</h3><p className="desk-reference-title">{reference.title}</p><section className="desk-norm-summary"><h4>Qué establece</h4><p>{reference.summary}</p><small>Resumen propio; consultar la fuente completa.</small></section>
              <section><h4>Por qué lo revisamos aquí</h4><p>{task.reason}</p></section>
              <section><h4>Qué debe preparar Linde</h4><p>{task.expected}</p></section>
              <ContextualBasis scope={scope} id={selected} referenceId={activeRef || task.refs[0]} />
              <button className="case-document-link" onClick={() => openDocument(selected)}>Leer muestra relacionada<small>{caseTask(scope, selected).document.id} · texto ficticio, no evidencia validada</small></button>
              <div className="desk-applicability"><strong>{activeRef === 'transferencias' ? 'Aplicabilidad pendiente' : task.applicability}</strong><p>{activeRef === 'transferencias' ? 'Hay que identificar actores, accesos y destinos antes de concluir si existe una transferencia. La respuesta del perfil no la confirma automáticamente.' : 'Vinculación definida para el escenario ficticio. Cambiar estados o aportar documentos no valida esta decisión.'}</p></div>
              {reference.url ? <a className="desk-source-link" href={reference.url} target="_blank" rel="noopener noreferrer">Consultar fuente oficial <Glyph type="external" /></a> : <p className="desk-note">No existe una fuente normativa para este contrato: es contenido ficticio de la muestra.</p>}<small className="desk-source-version">{reference.version} · referencia consultada el 05/10/2026</small>
              <div className="desk-related"><h4>Tareas relacionadas con esta referencia</h4>{allRows.filter(t => t.refs.includes(activeRef || task.refs[0])).map(t => <button key={t.id} onClick={() => pick(t.id, 'work')}><span>{t.code} · {t.title}</span><Glyph type="arrow" /></button>)}</div>
            </div>}
          </aside> : <aside className="desk-detail desk-empty"><Glyph type="tasks" /><h3>Sin tarea seleccionada</h3><p>Amplía los filtros para volver a seleccionar una tarea.</p></aside>}
        </div>
        <footer className="desk-footer"><button onClick={() => setModal('limits')}>Límites de la demo · normas reales y caso ficticio</button><button onClick={() => setModal('report')}>Revisar resumen del alcance <Glyph type="arrow" /></button></footer>
      </main>
    </div>
    {toast && <div className="desk-toast" role="status">{toast}<button className="nc-close-control" onClick={() => setToast('')} aria-label="Cerrar aviso"><CloseIcon/></button></div>}
    {modal && <DeskModal key={modal} wide={['profile','diagnostic','sample','report','help','history-report'].includes(modal)} title={{ help: 'Ayuda y guía de uso', diagnostic: 'Diagnóstico de partida', sample: 'Documento de muestra', profile: 'Perfil organizativo y legal', evidence: 'Añadir una evidencia de ejemplo', report: 'Resumen del alcance', limits: 'Qué está simulado', guide: 'B.06 · Cómo probar esta revisión', reset: 'Reiniciar la demo', 'archive-task': 'Archivar tarea terminada', 'restore-task': 'Restaurar tarea archivada', 'history-report': 'Informe cronológico de tareas' }[modal]} onClose={closeModal}>
      {modal === 'help' && <HelpCenter progress={helpProgress} storageError={helpError} initialArticle={helpArticle} onStart={startTour} onVisit={visitFromHelp} returnIndex={helpReturnIndex} onReturn={helpReturnIndex !== null ? returnToTour : null} />}
      {['archive-task','restore-task'].includes(modal) && <><p><b>{task.code} · {task.title}</b></p><p>{modal === 'archive-task' ? 'Saldrá del panel de tareas, pero seguirá en el histórico con documentos, notas y referencias. Podrás restaurarla. Archivar no revisa la evidencia ni acredita cumplimiento.' : 'Volverá al panel con el estado Terminada. Para reabrir el trabajo, cambia después el estado. El archivo anterior seguirá registrado en la cronología.'}</p>{saveError && <p className="desk-error" role="alert">{saveError}</p>}<div className="modal-actions"><button className="desk-outline" onClick={() => setModal(null)}>Cancelar</button><button className="desk-primary" onClick={() => archiveTask(modal === 'archive-task')}>{modal === 'archive-task' ? 'Confirmar archivo' : 'Confirmar restauración'}</button></div></>}
      {modal === 'history-report' && <><p>Resumen explicado de <b>{SCOPES[scope].name}</b>: situación por tarea, fundamentos, documentos, notas y cambios conservados, del más antiguo al más reciente.</p><div className="history-export-options"><label><input type="radio" name="report-selection" checked={reportMode === 'all'} onChange={() => setReportMode('all')} /><span><b>Todo el alcance</b><small>Incluye todas sus tareas, archivadas o no, y todos los cambios locales conservados. Ignora los filtros de pantalla.</small></span></label><label><input type="radio" name="report-selection" checked={reportMode === 'filtered'} onChange={() => setReportMode('filtered')} /><span><b>Solo la selección filtrada</b><small>Usa la vista {historyView === 'archive' ? 'Tareas archivadas' : 'Cronología'}, búsqueda, responsable y periodo actuales. El informe explicará los filtros utilizados.</small></span></label></div><p className="history-export-counts">Se incluirán {exportSelection.rows.length} {exportSelection.rows.length === 1 ? 'tarea' : 'tareas'} y {exportSelection.events.length} {exportSelection.events.length === 1 ? 'cambio' : 'cambios'}.</p><p className="desk-boundary">HTML descargable, con índice e impresión desde el navegador. No es un PDF generado por backend ni un informe panorámico de cumplimiento de toda la empresa. Los antecedentes editoriales se identifican por separado; las fechas y eventos antiguos desconocidos no se inventan.</p>{reportMode === 'filtered' && invalidPeriod(historyFilters) && <p className="desk-error" role="alert">Corrige el intervalo de fechas antes de descargar esta selección.</p>}{exportError && <p className="desk-error" role="alert">{exportError}</p>}<div className="modal-actions"><button className="desk-outline" onClick={() => setModal(null)}>Volver al histórico</button><button className="desk-primary" disabled={reportMode === 'filtered' && invalidPeriod(historyFilters)} onClick={downloadHistoryReport}>Descargar informe (.html)</button></div></>}
      {modal === 'diagnostic' && <DiagnosticPanel scope={scope} onDocument={openDocument} onTask={openCaseTask} />}
      {modal === 'sample' && <><SampleReader key={`${scope}-${reader.id}`} scope={scope} id={reader.id} initialSection={reader.section} onTask={openCaseTask} />{entryFocus==='document' && !entryDismissed && <EntryFocus kind="document" onDismiss={()=>setEntryDismissed(true)}/>}</>}
      {modal === 'profile' && <form onSubmit={saveProfile}><CompanyContext /><h3 className="case-profile-editor-heading">Datos declarados editables</h3><p className="desk-dialog-intro">Datos declarados de la empresa ficticia. No verifican su identidad, representación ni situación jurídica.</p><div className="desk-profile-fields"><label>Denominación<input value={draftProfile.legalName} maxLength={120} onChange={e => setDraftProfile({ ...draftProfile, legalName: e.target.value })} required /></label><label>País de establecimiento<input value={draftProfile.country} maxLength={70} onChange={e => setDraftProfile({ ...draftProfile, country: e.target.value })} /></label><label>Identificador fiscal / registral<input value={draftProfile.identifier} maxLength={100} onChange={e => setDraftProfile({ ...draftProfile, identifier: e.target.value })} /></label><label>Tamaño del equipo<input value={draftProfile.size} maxLength={50} onChange={e => setDraftProfile({ ...draftProfile, size: e.target.value })} /></label></div><fieldset><legend>Actividades combinables</legend>{ACTIVITIES.map(a => <label className="check-label" key={a}><input type="checkbox" checked={draftProfile.activities.includes(a)} onChange={e => setDraftProfile({ ...draftProfile, activities: e.target.checked ? [...draftProfile.activities, a] : draftProfile.activities.filter(x => x !== a) })} />{a}</label>)}</fieldset><details><summary>Servicios y productos de la empresa</summary><p><b>Trama:</b> desarrolla, aloja y opera un SaaS con contactos y tickets de sus usuarios empresariales.</p><p><b>Desarrollo a medida:</b> desarrolla y mantiene software en infraestructura de terceros; acceso a datos reales pendiente de concretar.</p><p>Son dos alcances propios, no expedientes de clientes. Su edición detallada queda fuera de esta iteración.</p></details><p className="desk-boundary">Editar estos datos no recalcula requisitos. La comprobación de organizaciones y permisos pertenece al trabajo de backend pendiente.</p>{profileError && <p className="desk-error" role="alert">{profileError}</p>}<div className="modal-actions"><button type="button" className="desk-outline" onClick={() => setModal(null)}>Cancelar</button><button className="desk-primary">Guardar perfil declarado</button></div></form>}
      {modal === 'evidence' && <><p>{task.code} · {task.document}</p><div className="desk-demo-file"><Glyph type="file" /><b>{task.document} · ejemplo.pdf</b><span>No se abre el selector de archivos ni se sube información real.</span></div><p>Se añadirá como evidencia simulada y sin revisar. No cambiará la aplicabilidad ni acreditará cumplimiento.</p>{saveError && <p className="desk-error" role="alert">{saveError}</p>}<div className="modal-actions"><button className="desk-outline" onClick={() => setModal(null)}>Cancelar</button><button className="desk-primary" onClick={() => { if (failSave) { setSaveError('Error simulado. No se ha añadido la evidencia.'); return; } setData(previous => simulateEvidence(previous, scope, selected)); setModal(null); setToast('Evidencia de ejemplo añadida · sin revisar.'); }}>Confirmar evidencia simulada</button></div></>}
      {modal === 'report' && <><p className="desk-overline">Linde Studio / {SCOPES[scope].name}</p><h3>{counts.done} de {counts.total} tareas terminadas</h3><p>{counts.blocked} bloqueadas · {counts.review} por revisar · {counts.documents} documentos simulados. Ninguna evidencia ha sido revisada.</p><ScopeReport scope={scope} rows={allRows} onTask={openCaseTask} /><p className="desk-boundary">Resumen operativo, no dictamen de cumplimiento. La exportación real sigue pendiente de implementación.</p><button className="desk-outline" disabled>Exportar PDF · no implementado</button></>}
      {modal === 'limits' && <><p>Empresa, datos, fechas y documentos ficticios. Las referencias a RGPD y NIST son reales; su selección para el escenario no constituye una conclusión jurídica sobre una empresa real.</p><p>Los indicadores se calculan a partir de las tareas del alcance. No hay backend, sincronización multiusuario, subida real, verificación empresarial ni PDF.</p><p>El diagnóstico y los documentos de muestra son contenido editorial fijo. El análisis IA se ha escrito de antemano; no se ha ejecutado ningún modelo. Leer una muestra no la convierte en un archivo aportado. Los cambios de tareas se conservan solo en este navegador. El histórico puede descargarse como HTML; no es una auditoría íntegra de servidor.</p><label className="check-label"><input type="checkbox" checked={failSave} onChange={e => setFailSave(e.target.checked)} />Simular un fallo al guardar en B</label></>}
      {modal === 'guide' && <><p>Espacio de trabajo es el único modelo del laboratorio. La guía es opcional y se abre desde Ayuda.</p><p>El caso se ha completado con perfil, diagnóstico, documentos legibles y notas del equipo. Abre «Ver diagnóstico de partida y fuentes» o «Leer documento de muestra» para recorrer la relación entre los datos y el trabajo.</p><ol className="desk-test-list"><li>Pulsa «Vencidas» o «Bloqueadas»: el indicador filtra las tareas reales del ejemplo.</li><li>Selecciona una tarea y cambia estado o responsable en la columna derecha. Comprueba el indicador y «Histórico de tareas».</li><li>Pulsa una referencia en la tabla. Lee el precepto, el motivo de su selección y el documento esperado sin abandonar el trabajo.</li><li>Abre «Normativa del alcance» y cambia entre Trama y desarrollo a medida para comparar las condiciones pendientes.</li></ol><p>El perfil se abre desde Linde Studio, arriba a la derecha. No ocupa una sección de la navegación operativa.</p></>}
      {modal === 'reset' && <><p>Se restaurarán las tareas, evidencias, perfil y actividad ficticios de B.06. No se borran archivos ni se modifica la aplicación real. Se conserva la copia heredada usada para migración. Este reinicio sí restaura el histórico local actual.</p><div className="modal-actions"><button className="desk-outline" onClick={() => setModal(null)}>Conservar cambios</button><button className="desk-primary" onClick={() => { setData(createWorkspace()); setBlockedStorage(false); setStorageError(''); setScope('saas'); setSelected('proveedor'); setSection('overview'); setFilter('all'); setOwner('Todos'); setQuery(''); setPanel('work'); setActiveRef(null); setFailSave(false); setSaveError(''); setModal(null); setToast('B.06 vuelve al caso inicial.'); }}>Restaurar el caso de B.06</button></div></>}
    </DeskModal>}
    {entryFocus && entryFocus!=='document' && !entryDismissed && !modal && tourIndex===null && section===initialSection && selected===initialTask && scope===initialScope && panel===initialPanel && <EntryFocus kind={entryFocus} onDismiss={()=>setEntryDismissed(true)}/>}
    {tourIndex !== null && <GuidedTour index={tourIndex} onStep={showTourStep} onExit={stopTour} onArticle={openTourArticle} storageError={helpError} />}
  </div>;
}
