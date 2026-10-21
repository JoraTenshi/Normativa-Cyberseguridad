import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createApi, queryString } from '../api-client';
import { confirmLeave } from './draft-state';
import { ErrorBox, useDirty, useWriter, WriteStatus, when } from './ui';
import { EnrollmentDecision, EnrollmentStatus, EnrollmentSummary } from './EnrollmentViews';
import { capabilitiesPath, emptyRequest, ownRequestsPath, parseCapabilities, parseList, parseRequest, platformRequestsPath, requestBody, requestLabels, requestPath, requestView, requestStates } from './enrollment-model';
import './connected.css';
import './enrollment.css';
import { useLearningSurface } from './learning-guide/LearningGuide';

// Stale data stays mounted only to preserve same-account drafts, but never becomes
// actionable while a new identity/generation/path is being checked.
export function useEnrollmentRead(api, path, epoch, active, parse = value => value) {
  const [tick, setTick] = useState(0), [state, setState] = useState({ data: null, key: null, error: null });
  const key = `${epoch}:${path}:${tick}:${active}`;
  useEffect(() => {
    let live = true;
    if (active && path) api.get(path).then(data => parse(data)).then(data => live && setState({ data, key, error: null }), error => live && setState(old => ({ ...old, key, error })));
    return () => { live = false; };
    // Parsing is fixed by the path/mode at each call site.
  }, [api, path, key, active]);
  const ready = active && state.key === key && !state.error;
  return { data: state.data, ready, loading: active && state.key !== key, error: state.key === key ? state.error : null, refresh: () => setTick(value => value + 1) };
}

export function EnrollmentAccessLink() {
  const api = useMemo(() => createApi(), []), auth = useAuth(), route = useNavigate();
  const caps = useEnrollmentRead(api, capabilitiesPath, `${auth.user?.id}:${auth.generation}`, auth.phase === 'authenticated', parseCapabilities);
  return <>{caps.ready && (caps.data.gestionarAltas === true || caps.data.requiereMfa === true) && <button onClick={() => { if (confirmLeave()) route('/administracion/altas'); }}>Revisar altas</button>}</>;
}

function useEnrollmentWriter(api, admin, onSaved) {
  // Validate before the generic writer clears its immutable retry job. A 2xx
  // with an invalid DTO is still an unknown result, not a successful UI update.
  const checkedApi = useMemo(() => ({ write: async job => parseRequest((await api.write(job))?.solicitud, admin) }), [api, admin]);
  return useWriter(checkedApi, onSaved);
}

export default function EnrollmentPortal({ admin = false }) {
  const auth = useAuth();
  return auth.user ? <EnrollmentAccount key={`${auth.user.id}:${admin}`} auth={auth} admin={admin}/> : <p role="status">Comprobando sesión…</p>;
}

function EnrollmentAccount({ auth, admin }) {
  const api = useMemo(() => createApi(), []), route = useNavigate();
  const epoch = `${auth.user.id}:${auth.generation}`, authenticated = auth.phase === 'authenticated';
  const caps = useEnrollmentRead(api, capabilitiesPath, epoch, authenticated, parseCapabilities);
  const allowed = caps.ready && (!admin || (caps.data.gestionarAltas === true && caps.data.requiereMfa === false));
  const guideContent = useLearningSurface({ id:'enrollment', kind:'route', chapter:admin ? 'review' : 'requests',
    priority:2, ready:authenticated && allowed, allowed, scope:admin ? 'platform-reviewer' : undefined });
  const [cursor, setCursor] = useState(null), [filter, setFilter] = useState(''), [selected, setSelected] = useState(null), [creating, setCreating] = useState(false);
  const listPath = (admin ? platformRequestsPath : ownRequestsPath) + queryString({ limite: 20, despues: cursor, estado: admin && filter ? filter : undefined });
  const list = useEnrollmentRead(api, listPath, epoch, allowed, data => parseList(data, admin));
  const move = fn => { if (confirmLeave()) fn(); };
  const recheck = () => caps.refresh();
  const checkMemberships = () => move(() => route('/espacio-de-trabajo'));
  return <div className="api-app enrollment-app"><header className="enrollment-header"><div><span className="enrollment-kicker">NORMATIVACHECK</span><h1>{admin ? 'Revisión de solicitudes de alta' : 'Tu espacio de empresa'}</h1><p>{admin ? 'Autoridad de plataforma, separada de la administración de las empresas.' : 'Solicita el acceso y sigue su revisión, paso a paso.'}</p></div><div className="enrollment-actions"><button onClick={checkMemberships}>Volver al espacio de trabajo</button><button onClick={() => move(() => route('/settings'))}>Mi cuenta</button></div></header>
    {!caps.ready && <section className="enrollment-status"><p role="status">{caps.error ? 'No se ha podido confirmar el acceso a las solicitudes.' : 'Comprobando los permisos de tu sesión…'}</p><ErrorBox error={caps.error}/>{caps.error && <button onClick={recheck}>Reintentar conexión</button>}</section>}
    {caps.ready && admin && !caps.data.gestionarAltas && !caps.data.requiereMfa && <section className="enrollment-status" role="alert"><h2>No tienes permiso para revisar altas</h2><p>La administración de una empresa no concede autoridad para aprobar solicitudes de la plataforma.</p></section>}
    {caps.ready && admin && caps.data.requiereMfa && <section className="enrollment-status"><h2>Completa la protección de tu cuenta</h2><p>Para revisar altas necesitas el segundo factor de NormativaCheck. La verificación en dos pasos de tu correo no lo sustituye.</p><button onClick={() => move(() => route('/settings'))}>Ir a la seguridad de mi cuenta</button></section>}
    <main ref={guideContent} className="enrollment-content" hidden={!allowed}>
      {admin && allowed && caps.data.requiereAutenticacionReciente && <section className="enrollment-status"><h2>Confirma tu identidad antes de decidir</h2><p>Puedes consultar solicitudes, pero aprobar, rechazar o pedir aclaraciones exige una autenticación reciente.</p><button onClick={() => auth.machine.lock('Confirma tu identidad con la misma cuenta y el segundo factor para decidir sobre altas. El borrador permanece en esta pestaña.')}>Volver a identificarme</button></section>}
      {selected ? <><button className="api-back" onClick={() => move(() => { setSelected(null); list.refresh(); })}>← Volver a solicitudes</button><EnrollmentDetail key={selected} api={api} id={selected} admin={admin} epoch={epoch} active={allowed} capabilities={caps.ready ? caps.data : null} onCapabilities={recheck} onReauthenticate={() => auth.machine.lock('Vuelve a identificarte con la misma cuenta para continuar con la decisión. El borrador se conserva.')} onMemberships={checkMemberships}/></>
        : creating ? <><button className="api-back" onClick={() => move(() => setCreating(false))}>← Volver a solicitudes</button><EnrollmentEditor api={api} active={allowed} onSaved={row => { setCreating(false); setSelected(row.id); list.refresh(); }}/></>
          : <>
            <div className="enrollment-list-tools">{admin && <label>Estado<select value={filter} onChange={e => { setFilter(e.target.value); setCursor(null); }}><option value="">Todos los estados</option>{Object.entries(requestLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>}<button disabled={!allowed || list.loading} onClick={list.refresh}>Actualizar solicitudes</button></div>
            {list.loading && <p role="status">Consultando solicitudes…</p>}<ErrorBox error={list.error}/>
            {list.ready && !list.data.solicitudes.length && (admin ? <section className="enrollment-status"><h2>No hay solicitudes en esta vista</h2><p>Prueba otro filtro o actualiza la lista.</p></section> : <EnrollmentStatus state="none" canRequest onRequest={() => setCreating(true)} canRefresh onRefresh={list.refresh}/>)}
            {list.ready && list.data.solicitudes.map(row => <section className="enrollment-list-card" key={row.id}><div><span className={`enrollment-state-badge state-${row.estado}`}>{requestLabels[row.estado]}</span><h2>{row.datos.razonSocial}</h2><p>Versión {row.version} · {when(row.actualizadaEn)}</p>{admin && <p>Solicitante: {row.solicitante.nombre}</p>}</div><button onClick={() => setSelected(row.id)}>Consultar solicitud</button></section>)}
            {list.ready && !admin && list.data.solicitudes.length > 0 && !list.data.solicitudes.some(row => ['pendiente_revision','aclaracion_requerida'].includes(row.estado)) && <button onClick={() => setCreating(true)}>Presentar otra solicitud</button>}
            <div className="enrollment-actions">{cursor && <button onClick={() => setCursor(null)}>Primeras solicitudes</button>}{list.ready && list.data.siguiente && <button onClick={() => setCursor(list.data.siguiente)}>Más solicitudes</button>}</div>
          </>}
    </main>
  </div>;
}

function EnrollmentHistory({ events = [], admin }) {
  return <section className="enrollment-summary"><h2>Historial de esta solicitud</h2><ol className="enrollment-history">{events.map(event => <li key={event.version}><strong>Versión {event.version} · {event.accion.replaceAll('_',' ')}</strong><time>{when(event.fecha)}</time><p>{event.actorTipo === 'plataforma' ? 'Administración de la plataforma' : 'Solicitante'}</p>{event.motivoPublico && <p>{event.motivoPublico}</p>}{event.datos && <details><summary>Datos declarados en esta versión</summary><dl>{Object.entries({ 'Empresa': event.datos.razonSocial, 'NIF': event.datos.nif, 'Función': event.datos.funcionProfesional, 'Justificación': event.datos.justificacion }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>}{admin && event.notaInterna && <div className="enrollment-internal"><strong>Nota interna</strong><p>{event.notaInterna}</p></div>}</li>)}</ol></section>;
}

function EnrollmentDetail({ api, id, admin, epoch, active, capabilities, onCapabilities, onReauthenticate, onMemberships }) {
  const path = requestPath(admin, id), detail = useEnrollmentRead(api, path, epoch, active, data => parseRequest(data?.solicitud, admin));
  const [editing, setEditing] = useState(false), [decisionDone, setDecisionDone] = useState(false), [notice, setNotice] = useState('');
  const row = detail.data, ready = active && detail.ready;
  const finish = () => { setEditing(false); setDecisionDone(true); setNotice('El servidor ha registrado el cambio. Estamos consultando el estado actualizado.'); detail.refresh(); };
  return <>{detail.loading && <p role="status">Consultando el detalle…</p>}<ErrorBox error={detail.error}/>{detail.error && <button onClick={detail.refresh}>Volver a consultar el detalle</button>}{notice && <p role="status">{notice}</p>}
    <div hidden={!ready}>{row && <>
      <EnrollmentStatus state={requestStates[row.estado]} publicReason={[...(row.historial || [])].reverse().find(event => event.motivoPublico)?.motivoPublico} canRefresh onRefresh={detail.refresh} canCorrect={!admin && ['pendiente_revision','aclaracion_requerida'].includes(row.estado)} onCorrect={() => setEditing(true)} canCheckMemberships={!admin && row.estado === 'aprobada'} onCheckMemberships={onMemberships}/>
      <EnrollmentSummary request={requestView(row)}/>
      {!admin && !editing && row.estado === 'pendiente_revision' && <button onClick={() => setEditing(true)}>Corregir datos de mi solicitud</button>}
      {editing && !admin && <EnrollmentEditor key={id} api={api} initial={row} current={row} active={ready} onSaved={finish} onReload={detail.refresh}/>}
      {admin && !decisionDone && <EnrollmentReview key={id} api={api} row={row} active={ready} capabilities={capabilities} onSaved={finish} onReload={detail.refresh} onCapabilities={onCapabilities} onReauthenticate={onReauthenticate}/>}
      <EnrollmentHistory events={row.historial} admin={admin}/>
    </>}</div>
  </>;
}

function EnrollmentWriterFeedback({ writer, api, path, admin = false, onAcceptCurrent, onReauthenticate, onCapabilities }) {
  const [latest, setLatest] = useState(null), [error, setError] = useState(null);
  return <><WriteStatus writer={writer}/>{writer.error?.status === 409 && <section className="enrollment-warning"><h3>El borrador se conserva</h3><p>El estado o la versión han cambiado. No se reenviará automáticamente con una versión distinta.</p>{path && <><button type="button" onClick={async () => { try { setLatest(parseRequest((await api.get(path)).solicitud, admin)); setError(null); } catch (e) { setError(e); } }}>Consultar la versión actual</button><ErrorBox error={error}/>{latest && <><EnrollmentSummary request={requestView(latest)}/><p>Estado actual: {requestLabels[latest.estado]}</p><button type="button" onClick={() => { onAcceptCurrent(latest); writer.clear(); setLatest(null); }}>He comparado los datos; preparar otro envío</button></>}</>}</section>}
    {writer.error?.code === 'REAUTENTICACION_REQUERIDA' && <section className="enrollment-warning"><p>La decisión no se ha confirmado. Identifícate de nuevo con la misma cuenta; conserva esta pestaña para mantener el motivo.</p><button type="button" onClick={onReauthenticate}>Confirmar mi identidad</button><button type="button" onClick={() => { onCapabilities(); writer.clear(); }}>Ya me he identificado; comprobar permisos</button></section>}
    {writer.error?.status === 401 && <section className="enrollment-warning"><p>El envío fue rechazado por la sesión. Recupera el acceso con la misma cuenta antes de continuar; tu borrador se conserva.</p><button type="button" onClick={() => { onCapabilities?.(); writer.clear(); }}>Ya he recuperado mi sesión; preparar nuevo envío</button></section>}
    {writer.error?.code === 'MFA_REQUERIDO' && <p role="alert">La cuenta necesita el segundo factor de NormativaCheck. No se puede decidir esta alta.</p>}
  </>;
}

function EnrollmentEditor({ api, initial = null, current = initial, active, onSaved, onReload }) {
  const [base, setBase] = useState(initial), [draft, setDraft] = useState(initial?.datos || emptyRequest), [confirmed, setConfirmed] = useState(false), [issue, setIssue] = useState(null);
  const path = base ? requestPath(false, base.id) : ownRequestsPath;
  const writer = useEnrollmentWriter(api, false, onSaved);
  const editable = !base || ['pendiente_revision','aclaracion_requerida'].includes(base.estado);
  const blocked = !active || !editable || writer.busy || writer.uncertain || [401,403,409].includes(writer.error?.status) || (base && current && base.version < current.version);
  useDirty(JSON.stringify(draft) !== JSON.stringify(initial?.datos || emptyRequest) || confirmed);
  const change = key => event => { setDraft(old => ({ ...old, [key]: event.target.value })); setConfirmed(false); };
  function submit(event) { event.preventDefault(); if (blocked || !confirmed) return; try { const datos = requestBody(draft); setIssue(null); writer.run(base ? 'PUT' : 'POST', path, base ? { version: base.version, datos } : datos); } catch (e) { setIssue(e); } }
  return <section className="enrollment-decision"><h2>{base ? 'Revisar datos declarados' : 'Solicitar un espacio de empresa'}</h2><p>Esta solicitud no concede acceso ni incorpora tu cuenta a una empresa existente por coincidir su NIF.</p>
    <form onSubmit={submit} aria-label="Solicitud de espacio de empresa"><fieldset disabled={blocked}>
      <label>Razón social<input required maxLength={200} value={draft.razonSocial} onChange={change('razonSocial')}/></label>
      <label>País<select value={draft.pais} onChange={change('pais')}><option value="ES">España</option></select></label>
      <label>NIF declarado<input required maxLength={9} pattern="[A-Za-z0-9]{9}" value={draft.nif} onChange={change('nif')}/></label>
      <p className="enrollment-field-hint">Nueve letras o números. El formato no demuestra existencia ni representación.</p>
      <label>Tu función en la empresa<input required maxLength={120} value={draft.funcionProfesional} onChange={change('funcionProfesional')}/></label>
      <label>Por qué solicitas administrar este espacio<textarea required maxLength={1000} rows={4} value={draft.justificacion} onChange={change('justificacion')}/></label>
      <label className="enrollment-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/><span>He revisado los datos. Entiendo que la solicitud necesita aprobación expresa y que verificar mi correo no activa el espacio.</span></label>
      <button className="enrollment-primary" disabled={blocked || !confirmed}>{writer.busy ? 'Enviando…' : base ? 'Enviar datos para nueva revisión' : 'Enviar solicitud'}</button>
    </fieldset></form><ErrorBox error={issue}/>
    {base && current && base.version < current.version && <section className="enrollment-warning"><p>Existe una versión más reciente. Tu borrador no se ha sustituido.</p><button onClick={() => { setBase(current); setConfirmed(false); writer.clear(); }}>He revisado la versión mostrada; conservar mi borrador</button></section>}
    {!editable && <p role="status">Esta solicitud está cerrada y ya no admite cambios.</p>}
    <EnrollmentWriterFeedback writer={writer} api={api} path={base ? path : null} onAcceptCurrent={row => { setBase(row); setConfirmed(false); onReload?.(); }}/>
  </section>;
}

function EnrollmentReview({ api, row, active, capabilities, onSaved, onReload, onCapabilities, onReauthenticate }) {
  const [base, setBase] = useState(row), path = requestPath(true, row.id);
  const writer = useEnrollmentWriter(api, true, onSaved);
  const recent = capabilities?.requiereAutenticacionReciente === false;
  const blocked = !active || !recent || writer.busy || writer.uncertain || [401,403,409].includes(writer.error?.status) || row.version > base.version;
  return <><EnrollmentDecision request={requestView(base)} authorityConfirmed={capabilities?.gestionarAltas === true && capabilities?.requiereMfa === false} canDecide={row.puedeDecidir === true && base.puedeDecidir === true} blocked={blocked} onDecide={body => { if (blocked || !row.puedeDecidir || !base.puedeDecidir) return; return writer.run('POST', path + '/decision', body); }}/>
    {row.version > base.version && <section className="enrollment-warning"><p>La solicitud ha cambiado. Revisa los datos de la versión {row.version} antes de preparar otra decisión.</p><button onClick={() => { setBase(row); writer.clear(); }}>He revisado la versión actual</button></section>}
    <EnrollmentWriterFeedback writer={writer} api={api} path={path} admin onAcceptCurrent={latest => { setBase(latest); onReload(); }} onReauthenticate={onReauthenticate} onCapabilities={onCapabilities}/>
  </>;
}
