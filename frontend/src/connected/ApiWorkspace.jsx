import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createApi, orgPath, queryString } from '../api-client';
import { useAuth } from '../context/AuthContext';
import { ErrorBox } from './ui';
import { ContextPage, OperationsPage } from './ContextOperations';
import { SpacesPage, DocumentsPage, ActivityPage } from './Resources';
import { confirmLeave } from './draft-state';
import './connected.css';
import './dashboard.css';
import { Dashboard, Glyph } from './Dashboard';
import CompanyProfile from './CompanyProfile';
import NormativeWorkspace from './NormativeWorkspace';
import { EnrollmentAccessLink } from './EnrollmentPortal';
import { Brand } from '../product/ProductFrame';
import RatWorkspace from './RatWorkspace';
import DPUnitWorkspace from './DPUnitWorkspace';
import DPCaseWorkspace from './DPCaseWorkspace';
import { useLearningSurface } from './learning-guide/LearningGuide';
import { usePracticeTarget } from './learning-guide/Practice';
import { WORKSPACE_SECTIONS } from './learning-guide/catalog';

const sections = WORKSPACE_SECTIONS;
const icons = {overview:'grid',profile:'book',operations:'tasks',rat:'book',units:'book',rights:'book',eipd:'book',tasks:'check',documents:'file',regulations:'book',activity:'clock',spaces:'grid',context:'book'};
const accessLabels = { administrador:'permisos de administración', colaborador:'permisos de colaboración', consulta:'permisos de consulta' };
export default function ApiWorkspace() {
  const api = useMemo(() => createApi(), []);
  const { user, phase, generation, logout } = useAuth();
  const route = useNavigate();
  const [closing, setClosing] = useState(false), [closeError, setCloseError] = useState('');
  const [companies, setCompanies] = useState([]), [selected, setSelected] = useState(null);
  const [error, setError] = useState(null), [busy, setBusy] = useState(true), [next, setNext] = useState(null);
  const [retry, setRetry] = useState(0), [cursor, setCursor] = useState(null);
  const guideEntry = useLearningSurface({ id:'workspace-entry', kind:'entry', chapter:'entry', priority:2,
    ready:phase === 'authenticated' && !busy && !error && !selected });
  useEffect(() => {
    const previous = document.title;
    document.title = 'NormativaCheck · Espacio de trabajo';
    return () => { document.title = previous; };
  }, []);
  useEffect(() => {
    if (phase !== 'authenticated') return;
    let active = true;
    setBusy(true); setError(null);
    api.get('/me/organizaciones'+queryString({ despues:cursor, limite:50 })).then(data => {
      if (!active) return;
      setCompanies(data.organizaciones); setNext(data.siguiente);
      // Only a complete first page with one active membership is unambiguous.
      const soleOrganization = !cursor && !data.siguiente && data.organizaciones.length === 1 ? data.organizaciones[0] : null;
      // Reconfirm membership on the selected page before revealing the editor.
      setSelected(old => data.organizaciones.find(o => o.id === old?.id) || soleOrganization);
      setBusy(false);
    }, e => { if (active) { setError(e); setBusy(false); } });
    return () => { active = false; };
  }, [api, phase, generation, cursor, retry]);
  function enterChoice(id) {
    const organization = companies.find(o => o.id === id);
    if (!organization || busy || error || phase !== 'authenticated' || !confirmLeave()) return;
    setSelected(organization);
  }
  async function closeSession() {
    if (closing || !confirmLeave('Cerrar sesión descartará los cambios sin guardar. ¿Continuar?')) return;
    setClosing(true); setCloseError('');
    try {
      if (await logout()) route('/auth', { replace:true });
      else setCloseError('No se ha confirmado el cierre. El trabajo sigue aquí; vuelve a intentarlo.');
    } catch { setCloseError('No se ha confirmado el cierre. El trabajo sigue aquí; vuelve a intentarlo.'); }
    finally { setClosing(false); }
  }
  const refreshMemberships = () => { if (confirmLeave()) setRetry(n => n + 1); };
  const needsChoice = companies.length > 1 || !!cursor || !!next;
  const selector = needsChoice ? <details className="desk-company-picker" open={!selected || undefined}>
    <summary>{selected ? 'Cambiar de empresa' : 'Empresas a las que puedes acceder'}</summary>
    <p className="desk-choice-help">Cada empresa tiene sus propios datos y permisos. Sus servicios y actividades se eligen después, dentro de su espacio.</p>
    <div className="desk-company-cards">{companies.map(o => <article key={o.id} className="desk-company-card">
      <strong>{o.nombre}</strong><p>{accessLabels[o.rol] || 'Permisos de tu membresía'}</p>
      <button type="button" className="api-primary" disabled={busy || !!error || selected?.id === o.id} onClick={() => enterChoice(o.id)} aria-label={'Trabajar con ' + o.nombre}>{selected?.id === o.id ? 'Empresa activa' : 'Trabajar con esta empresa'}</button>
    </article>)}</div>
    <div className="desk-picker-actions"><button disabled={busy} onClick={refreshMemberships}>Actualizar organizaciones</button>
      {cursor && <button disabled={busy} onClick={() => { if (confirmLeave()) { setSelected(null); setCursor(null); } }}>Primera página</button>}
      {next && <button disabled={busy} onClick={() => { if (confirmLeave()) { setSelected(null); setCursor(next); } }}>Más organizaciones</button>}
    </div>
  </details> : selected ? <button type="button" className="desk-membership-refresh" disabled={busy} onClick={refreshMemberships}>Actualizar acceso a mi empresa</button> : null;
  return <div className="api-app desk-v2" ref={guideEntry}>
    <a className="desk-skip" href="#workspace-main">Saltar al contenido</a>
    {process.env.REACT_APP_VALIDATION_BUILD === 'true' && <div className="desk-environment"><span className="desk-live-dot"/>Entorno de validación <span>· Usa únicamente datos de prueba</span></div>}
    <header className="desk-top"><div className="desk-brand"><Brand/><span className="desk-top-label">Espacio de trabajo</span></div><div className="desk-account"><span className="desk-avatar" aria-hidden="true">{user.nombre?.slice(0,1).toUpperCase() || 'N'}</span><span>{user.nombre}</span><button onClick={() => { if (confirmLeave()) route('/solicitudes-de-alta'); }}>Mis solicitudes</button><EnrollmentAccessLink/><button onClick={() => { if (confirmLeave()) route('/historial'); }}>Evaluaciones guardadas</button><button onClick={() => { if (confirmLeave()) route('/settings'); }}>Mi cuenta</button><button onClick={closeSession} disabled={closing}>{closing ? 'Cerrando…' : 'Cerrar sesión'}</button></div></header>
    {closeError && <div className="desk-connection" role="alert">{closeError}</div>}
    {(busy || error) && <div className="desk-connection">{busy && <p role="status">Comprobando membresías…</p>}<ErrorBox error={error}/>{error && <button onClick={() => setRetry(n => n+1)}>Reintentar conexión</button>}</div>}
    {/* Keep the editor mounted during lock/recheck; never reveal it until membership is confirmed. */}
    <div hidden={busy || !!error || phase !== 'authenticated'}>
      {selected ? <Connected key={user.id+':'+selected.id+':'+selected.rol} api={api} organization={selected} selector={selector} guideReady={!busy && !error && phase === 'authenticated'}/>
        : <section className="desk-welcome" id="workspace-main" tabIndex={-1}><span className="desk-overline">TU ESPACIO DE TRABAJO</span><h1>Mi espacio de empresa</h1>{needsChoice && <p>Elige la empresa en la que vas a trabajar. Si gestionas varias, cada una mantiene su información por separado.</p>}{selector}{!busy && !error && !companies.length && <div className="desk-enrollment-start"><h2>{!cursor && !next ? 'Todavía no tienes acceso a una empresa' : 'No hay empresas en esta página'}</h2><p> Puedes presentar una solicitud o consultar su revisión. Verificar tu correo no activa el acceso: es necesaria la aprobación de la administración de NormativaCheck.</p><button onClick={() => { if (confirmLeave()) route('/solicitudes-de-alta'); }}>Solicitar espacio o consultar mi alta</button></div>}{needsChoice && <small>Solo aparecen empresas con una membresía activa confirmada por el servidor.</small>}</section>}
    </div>
  </div>;
}
function Connected({ api, organization, selector, guideReady }) {
  const base = orgPath(organization.id), [section, setSection] = useState('overview');
  const [operationId, setOperationId] = useState(null);
  const heading = React.useRef(null);
  const admin = organization.rol === 'administrador';
  const navigate = (next,id = null) => {
    if (next === section && id === null) return true;
    if (!confirmLeave()) return false;
    setOperationId(id); setSection(next); return true;
  };
  const guideContent = useLearningSurface({ id:'workspace', kind:'workspace', chapter:'entry', priority:3,
    section, scope:organization.id+':'+organization.rol, practiceScope:base, role:organization.rol, ready:guideReady,
    heading, navigate });
  const companyPractice = usePracticeTarget('company', base, guideReady);
  useEffect(() => { if (!(section === 'tasks' && operationId?.id)) heading.current?.focus({preventScroll:true}); }, [section,operationId]);
  return <div className="desk-shell"><aside className="desk-nav">
    <span className="desk-overline">GESTIÓN DEL TRABAJO</span>
    <nav aria-label="Secciones del Workspace">{Object.entries(sections).map(([id,name]) => <button key={id} aria-current={section === id ? 'page' : undefined} onClick={() => navigate(id)} disabled={['profile','context','operations','regulations','tasks','rat','units','rights','eipd'].includes(id) && !admin} title={['profile','context','operations','regulations','tasks','rat','units','rights','eipd'].includes(id) && !admin ? 'Disponible para el administrador de la organización' : undefined}><Glyph type={icons[id]}/><span>{name}</span></button>)}</nav>
    <div className="desk-scope-note"><strong>{organization.nombre}</strong><small>{admin ? 'Administrador empresarial' : 'Acceso según membresía'}</small><p>Los permisos se comprueban en el servidor en cada consulta y cambio.</p></div>
    <details className="desk-help"><summary>Cómo usar este espacio</summary><p>Describe una operación, aclara sus datos y conserva su documentación. El historial permite seguir los cambios.</p><p>Las actuaciones conservan responsables y cambios. Su cierre no sustituye la revisión del requisito.</p></details>
  </aside><section id="workspace-main" ref={guideContent} className="desk-main" aria-labelledby="workspace-title"><header className="desk-page-header"><div><details ref={companyPractice.root} className="desk-company-context" onToggle={event => {if(event.currentTarget.open)companyPractice.observe('practiced');}}><summary>Empresa y permisos</summary><p><strong>{organization.nombre}</strong> · {accessLabels[organization.rol] || 'Permisos de tu membresía'}</p><p>Este es tu espacio de empresa. Sus servicios y productos se consultan dentro; no son cuentas independientes.</p></details><span className="desk-overline">{organization.nombre}</span><h1 id="workspace-title" ref={heading} tabIndex={-1}>{sections[section]}</h1><p>{section === 'overview' ? 'Tu actividad, documentación y siguientes pasos, en un mismo lugar.' : 'Datos y cambios de tu organización, conectados al servidor.'}</p></div>{selector}</header>
    {section === 'overview' && <Dashboard api={api} base={base} admin={admin} onNavigate={navigate}/>}
    {section === 'profile' && admin && <CompanyProfile api={api} base={base}/>}
    {section === 'context' && admin && <ContextPage api={api} base={base}/>}
    {section === 'operations' && admin && <OperationsPage api={api} base={base} initialOperationId={operationId}/>}
    {section === 'rat' && admin && <RatWorkspace api={api} base={base} onNavigate={navigate}/>}
    {section === 'units' && admin && <DPUnitWorkspace api={api} base={base}/>}
    {section === 'rights' && admin && <DPCaseWorkspace api={api} base={base}/>}
    {section === 'eipd' && admin && <DPCaseWorkspace api={api} base={base} mode="eipd"/>}
    {section === 'spaces' && <SpacesPage api={api} base={base} admin={admin}/>}
    {section === 'documents' && <DocumentsPage api={api} base={base} admin={admin}/>}
    {section === 'activity' && <ActivityPage api={api} base={base}/>}
    {section === 'regulations' && admin && <NormativeWorkspace key={JSON.stringify(operationId)} api={api} base={base} onNavigate={navigate} initialKind={operationId?.kind || 'requisitos'} initialId={operationId?.id || null}/>}
    {section === 'tasks' && admin && <NormativeWorkspace key={operationId?.id || 'tasks'} api={api} base={base} onNavigate={navigate} initialKind="actuaciones" initialId={operationId?.id || null} workOnly/>}
    <footer className="desk-footer"><span>NormativaCheck · Espacio de empresa</span><span>Las cifras de actividad no acreditan cumplimiento normativo.</span></footer>
  </section></div>;
}
