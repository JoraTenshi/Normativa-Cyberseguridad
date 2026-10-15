import React, { useEffect, useRef, useState } from 'react';
import { queryString, resourceId } from '../api-client';
import { Panel, Field, Notice, Empty, Facts, ErrorBox, RemoteStatus, useRemote, useWriter, WriteStatus, JsonDetail, when, useDirty } from './ui';
import { confirmLeave } from './draft-state';
import { FUNCTIONS, answerDraft, parseAnswer, contextWrite, conflictingKeys, rebaseEdits, newActivity, materializationBody, activityIds } from './profile-model';
import './profile.css';
import ProfileOperations, { ProposedOperations } from './ProfileOperations';
import { verifyOperationLinks } from './profile-operations-model';
import ScopeRefresh from './ScopeRefresh';

export default function CompanyProfile({ api, base }) {
  const context = useRemote(api, base + '/contexto');
  const absent = context.error?.code === 'CONTEXTO_NO_INICIADO';
  return <div className="company-profile">
    <p className="api-intro">Primero describimos la empresa y sus actividades. Después revisamos cómo organizar el trabajo. Una respuesta declarada no acredita cumplimiento.</p>
    {!absent && <RemoteStatus remote={context}/>}
    {absent && <StartProfile api={api} base={base} onSaved={context.refresh}/>}
    {context.data && <LoadedProfile key={context.data.contexto.version} api={api} base={base} context={context.data} refresh={context.refresh}/>}
  </div>;
}

function StartProfile({ api, base, onSaved }) {
  const [reason, setReason] = useState('');
  const writer = useWriter(api, onSaved);
  useDirty(!!reason || writer.busy || writer.uncertain);
  return <Panel title="Preparar el perfil de esta organización">
    <p>Esta organización todavía no tiene un contexto guardado. Al iniciarlo se crea su primera revisión, sin respuestas asumidas, espacios ni tareas. Después aparecerán las preguntas.</p>
    <form onSubmit={e => { e.preventDefault(); if (reason.trim()) writer.run('POST', base + '/contexto', { hechos: [], motivo: reason.trim() }); }}>
      <fieldset disabled={writer.busy || writer.uncertain || writer.error?.status === 409}>
        <Field label="Motivo de apertura"><input required maxLength={300} value={reason} onChange={e => setReason(e.target.value)}/></Field>
        <button className="api-primary">Iniciar perfil</button>
      </fieldset>
    </form><WriteStatus writer={writer}/>
    {writer.error?.status === 409 && <Notice tone="warning">Otra persona puede haber iniciado el contexto. No se repetirá el alta con una clave distinta.<button onClick={() => { if (confirmLeave()) onSaved(); }}>Consultar contexto actual</button></Notice>}
  </Panel>;
}

function LoadedProfile({ api, base, context, refresh }) {
  const proposal = useRemote(api, base + '/contexto/propuestas');
  const [tab, setTab] = useState('empresa');
  const data = proposal.data;
  const compatible = data?.versionContrato === 1 && data.contextoVersion === context.contexto.version;
  const activities = data?.perfil?.actividades || [];
  const tabs = [['empresa', '1 · Empresa y actividades'], ...activities.map(a => ['activity:' + a.id, a.hechos.find(h => h.campo === 'nombre' && h.estado === 'conocido')?.valor || a.id]), ['propuestas', '2 · Revisar propuestas'], ['alcances', '3 · Alcances guardados']];
  function select(next) { if (next !== tab && confirmLeave()) setTab(next); }
  return <><div className="api-actions"><span className="api-tag">Contexto · revisión {context.contexto.version}</span><span>Guardado {when(context.revision.registradoEn)}</span><button onClick={() => { if (confirmLeave()) refresh(); }}>Consultar perfil actual</button></div>
    <RemoteStatus remote={proposal}/>
    {data && !compatible && <Notice tone="warning">El contrato no es compatible o el contexto cambió entre consultas. No se permite guardar con una propuesta desactualizada. Consulta el perfil actual.</Notice>}
    {proposal.error && <button onClick={proposal.refresh}>Reintentar lectura del perfil</button>}
    {compatible && <><nav className="api-tabs" aria-label="Pasos del perfil">{tabs.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => select(id)}>{label}</button>)}</nav>
      {['empresa', ...activities.map(a => 'activity:' + a.id)].includes(tab) && <ProfileEditor key={tab} api={api} base={base} context={context} proposal={data} group={tab === 'empresa' ? 'empresa' : tab.slice(9)} onSaved={refresh}/>}
      {tab === 'propuestas' && <ProposalReview api={api} base={base} proposal={data} onRefresh={refresh} onScopes={() => setTab('alcances')}/>}
      {tab === 'alcances' && <ScopeList api={api} base={base}/>}
    </>}
  </>;
}

function Answer({ question, draft, onChange, api, base, onOperationsRead }) {
  const state = draft.state;
  const update = change => onChange({ ...draft, ...change });
  return <section className="profile-question">
    <h3>{question.texto}</h3>
    <Field label="Estado de la respuesta"><select aria-label={'Estado: ' + question.texto} value={state} onChange={e => update({ state: e.target.value, raw: '' })}>
      <option value="desconocido">Pendiente / no lo sé todavía</option><option value="conocido">Puedo declararlo</option>
      {draft.original?.estado === 'conflictivo' && <option value="conflictivo">Conservar información contradictoria</option>}
    </select></Field>
    {state === 'desconocido' && <Field label="Por qué está pendiente"><select value={draft.reason} onChange={e => update({ reason: e.target.value })}><option value="no_aportado">Aún no se ha aportado</option><option value="por_consultar">Necesito consultarlo</option><option value="no_sabe">No lo sé</option></select></Field>}
    {state === 'conflictivo' && <><Notice tone="warning">No se selecciona una alternativa automáticamente. Puedes conservar la discrepancia, marcarla como pendiente o declarar un valor tras aclararla.</Notice><Facts facts={[draft.original]}/></>}
    {state === 'conocido' && question.tipo === 'funciones' && <fieldset><legend>Funciones declaradas</legend><div className="profile-checks">{FUNCTIONS.map(f => <label key={f}><input type="checkbox" checked={draft.raw.split(';').map(s => s.trim()).includes(f)} onChange={e => { const values = draft.raw.split(';').map(s => s.trim()).filter(Boolean).filter(v => v !== f); update({ raw: [...values, ...(e.target.checked ? [f] : [])].join('; ') }); }}/>{f}</label>)}</div></fieldset>}
    {state === 'conocido' && question.tipo === 'ids' && <ProfileOperations api={api} base={base} value={draft.raw} onRead={onOperationsRead} onChange={raw=>update({raw})}/>}
    {state === 'conocido' && !['funciones','ids'].includes(question.tipo) && <Field label="Respuesta declarada">
      {question.tipo === 'booleano' || question.tipo === 'tipo' ? <select aria-label={question.texto} required value={draft.raw} onChange={e => update({ raw: e.target.value })}>
        <option value="">Selecciona una respuesta</option>{(question.tipo === 'booleano' ? [['true', 'Sí'], ['false', 'No']] : [['servicio', 'Servicio'], ['producto', 'Producto']]).map(([v,t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      : <input aria-label={question.texto} type={question.tipo === 'numero' ? 'number' : 'text'} min={0} max={1000000} step={1} maxLength={['lista', 'ids'].includes(question.tipo) ? 2100 : 120} value={draft.raw} onChange={e => update({ raw: e.target.value })}/>}
    </Field>}
    {question.tipo === 'lista' && <small>Separa los elementos con punto y coma. En clientes se pregunta por tipos de cliente, no por nombres ni datos personales.</small>}
  </section>;
}

function ProfileEditor({ api, base, context, proposal, group, onSaved }) {
  const mounted=useRef(true), saving=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const questions = proposal.perfil.preguntas.filter(q => q.grupo === group && q.clave !== 'perfil_actividades');
  const [baseline, setBaseline] = useState(context.contexto.hechos);
  const [version, setVersion] = useState(context.contexto.version);
  const [drafts, setDrafts] = useState({}), [extra, setExtra] = useState({});
  const [reason, setReason] = useState(''), [issue, setIssue] = useState('');
  const [latest, setLatest] = useState(null), [choices, setChoices] = useState({});
  const [name, setName] = useState(''), [type, setType] = useState('');
  const [operationRefs,setOperationRefs] = useState({}), [checking,setChecking] = useState(false);
  const writer = useWriter(api, onSaved);
  const locked = checking || writer.busy || writer.uncertain;
  useDirty(!!reason || !!name || !!type || Object.keys(drafts).length > 0 || Object.keys(extra).length > 0 || locked);
  const edited = () => [...Object.entries(drafts).map(([key,d]) => parseAnswer(questions.find(q => q.clave === key), d)), ...Object.values(extra)];
  const currentFacts = [...baseline.filter(f => !extra[f.clave]), ...Object.values(extra)];
  const ids = activityIds(currentFacts);
  async function save(e) {
    e.preventDefault(); if (locked || saving.current) return;
    saving.current=true;
    try {
      if (name || type) throw new Error('Añade la actividad al borrador o vacía sus campos antes de guardar el bloque.');
      const body = contextWrite(version, baseline, edited(), reason);
      setChecking(true);setIssue('');
      await verifyOperationLinks(api,base,body.cambios,{...Object.fromEntries((proposal.operaciones||[]).map(r=>[r.id,r])),...operationRefs});
      if (!mounted.current) return;
      await writer.run('PATCH', base + '/contexto', body);
    } catch(e) { if(mounted.current)setIssue(e.message); } finally { saving.current=false;if(mounted.current)setChecking(false); }
  }
  function addActivity() {
    try { const changes = newActivity(currentFacts, ids, name, type); setExtra(old => ({ ...old, ...Object.fromEntries(changes.map(f => [f.clave, f])) })); setName(''); setType(''); setIssue(''); } catch(e) { setIssue(e.message); }
  }
  async function compare() {
    try { edited(); setLatest(await api.get(base + '/contexto')); setChoices({}); setIssue(''); } catch(e) { setIssue(e.message); }
  }
  function rebase() {
    try {
      const changes = rebaseEdits(baseline, edited(), latest.contexto.hechos, choices);
      // Keep only intentional changes against the newly reviewed baseline.
      setExtra(Object.fromEntries(changes.map(f => [f.clave, f]))); setDrafts({});
      setBaseline(latest.contexto.hechos); setVersion(latest.contexto.version); setLatest(null); writer.clear(); setIssue('Cambios preparados sobre la revisión consultada. Revisa las respuestas antes de guardar; todavía no se ha enviado nada.');
    } catch(e) { setIssue(e.message); }
  }
  const conflictKeys = latest ? conflictingKeys(baseline, edited(), latest.contexto.hechos) : [];
  const baselineMap = Object.fromEntries(baseline.map(f => [f.clave, f]));
  return <Panel title={group === 'empresa' ? 'Describir la empresa y sus actividades' : 'Concretar esta actividad'}>
    <Notice>Guarda cada bloque con su motivo. Las preguntas condicionales se actualizarán después de guardar, sin borrar respuestas previas. No confundimos «no lo sé» con «no».</Notice>
    <form onSubmit={save}><fieldset disabled={locked}>
      {group === 'empresa' && <section className="profile-activities"><h3>Servicios y productos</h3><p>Un nombre identifica la actividad; el código interno se conserva aunque cambies ese nombre.</p>
        {ids.length === 0 && <Empty>No hay actividades declaradas todavía.</Empty>}
        {ids.map(id => <div className="api-row" key={id}><span>{currentFacts.find(f => f.clave === `actividad_${id}_nombre` && f.estado === 'conocido')?.valor || id}</span><button type="button" onClick={() => { if (window.confirm('¿Retirar esta actividad del perfil? No se borrarán sus datos anteriores, espacios ni alcances guardados.')) setExtra(old => ({ ...old, perfil_actividades: { clave: 'perfil_actividades', estado: 'conocido', valor: ids.filter(v => v !== id) } })); }}>Retirar del perfil</button></div>)}
        <div className="api-grid2"><Field label="Nombre de la nueva actividad"><input maxLength={120} value={name} onChange={e => setName(e.target.value)}/></Field><Field label="Tipo de nueva actividad"><select value={type} onChange={e => setType(e.target.value)}><option value="">Sin decidir</option><option value="servicio">Servicio</option><option value="producto">Producto</option></select></Field></div>
        <button type="button" disabled={ids.length >= 8 || baselineMap.perfil_actividades?.estado === 'conflictivo'} onClick={addActivity}>Añadir actividad al borrador</button>
        <p><small>Hasta ocho actividades. Guarda este bloque para acceder a las preguntas de cada una. Una lista de actividades contradictoria debe aclararse en el contexto avanzado antes de añadir otras.</small></p>
      </section>}
      {questions.map(q => { const fact = extra[q.clave] || baselineMap[q.clave] || q.respuesta; return <Answer key={q.clave} api={api} base={base} onOperationsRead={setOperationRefs} question={q} draft={drafts[q.clave] || answerDraft({ ...q, respuesta: fact })} onChange={value => { setDrafts(old => ({ ...old, [q.clave]: value })); setExtra(old => { const copy = { ...old }; delete copy[q.clave]; return copy; }); setLatest(null); }} />; })}
      <Field label="Motivo de esta revisión"><input required maxLength={300} value={reason} onChange={e => setReason(e.target.value)}/></Field>
      <button className="api-primary" disabled={writer.error?.status === 409}>{checking ? 'Comprobando operaciones…' : writer.busy ? 'Guardando…' : 'Guardar este bloque'}</button>
    </fieldset></form>
    {issue && <Notice tone="warning">{issue}</Notice>}<WriteStatus writer={writer}/>
    {writer.error?.status === 409 && <section className="api-conflict"><h3>El borrador sigue aquí</h3><p>No se sustituye la revisión de otra persona. Consulta sus cambios y elige qué conservar en los datos modificados por ambos.</p>
      <button onClick={compare}>Comparar con la revisión actual</button>
      {latest && <><h4>Servidor · revisión {latest.contexto.version}</h4><Facts facts={latest.contexto.hechos}/>
        {conflictKeys.map(k => <div key={k}><h4>{questions.find(q => q.clave === k)?.texto || k}</h4><strong>Mi cambio</strong><Facts facts={edited().filter(f => f.clave === k)}/><Field label="Qué conservar"><select aria-label={'Resolver ' + k} value={choices[k] || ''} onChange={e => setChoices(old => ({ ...old, [k]: e.target.value }))}><option value="">Elige antes de continuar</option><option value="server">Conservar el dato del servidor</option><option value="mine">Conservar mi cambio</option></select></Field></div>)}
        <button onClick={rebase}>Preparar cambios sobre esta revisión</button><small>Este paso no guarda. Los datos que no editaste se conservan como están en el servidor.</small>
      </>}
    </section>}
  </Panel>;
}

export function Candidates({ data }) {
  return <><Notice tone="warning">Marcos candidatos, no obligaciones confirmadas. La aplicabilidad está pendiente y la satisfacción no está evaluada. No hay porcentaje ni certificación.</Notice>
    {(data.candidatos || []).map(c => <details className="profile-candidate" key={c.id}><summary><strong>{c.familia}</strong> · Por determinar</summary><p>{c.razon}</p><p>Cobertura: {c.cobertura === 'borrador_parcial' ? 'borrador parcial, pendiente de revisión jurídica' : 'fuera de la cobertura evaluable de este bloque'}.</p>
      {c.fundamentos?.length > 0 && <p>Indicios declarados: {c.fundamentos.map(f => ({ legal: 'posible fundamento legal', contractual: 'contrato por comprobar', adopcion_voluntaria: 'adopción voluntaria' })[f.tipo] || f.tipo).join(' · ')}.</p>}
      {c.siguientesPreguntas?.length > 0 && <ul>{c.siguientesPreguntas.map((q,i) => <li key={q.clave + i}>{q.texto}</li>)}</ul>}
      <Facts facts={c.hechos || []}/><JsonDetail value={c.localizadores} label="Referencias y localizadores (no textos normativos)"/>
    </details>)}
    {!!data.contradicciones?.length && <Panel title="Discrepancias que hay que aclarar"><p>El contexto general no reemplaza los datos específicos de una operación.</p>{data.contradicciones.map((c,i) => <JsonDetail key={i} value={c} label={'Revisar discrepancia: ' + c.campo}/>)}</Panel>}
  </>;
}

function ProposalReview({ api, base, proposal, onRefresh, onScopes }) {
  const [selection, setSelection] = useState({}), [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [receipt, setReceipt] = useState(null), [issue, setIssue] = useState('');
  const [cursor, setCursor] = useState(null), [knownSpaces, setKnownSpaces] = useState({});
  const spaces = useRemote(api, base + '/subespacios' + queryString({ estado: 'activo', limite: 50, despues: cursor }));
  const writer = useWriter(api, result => { setReceipt(result); setReason(''); setConfirmed(false); });
  const locked = writer.busy || writer.uncertain || !!receipt || writer.error?.status === 409;
  useDirty(!receipt && (!!reason || confirmed || Object.keys(selection).length > 0 || writer.busy || writer.uncertain));
  const available = Object.values({ ...knownSpaces, ...Object.fromEntries((spaces.data?.subespacios || []).map(s => [s.id, s])) });
  function submit(e) {
    e.preventDefault(); try { const body = materializationBody(proposal, selection, reason, confirmed); setIssue(''); writer.run('POST', base + '/contexto/materializaciones', body); } catch(e) { setIssue(e.message); }
  }
  return <><Panel title="Revisar antes de crear espacios y alcances">
    <p>Propuesta basada en la revisión {proposal.contextoVersion}. No se crea nada al abrir esta pantalla.</p>
    <p>La confirmación crea un alcance preliminar por actividad y permite crear su espacio o reutilizar uno activo. No genera tareas, documentos, PDS ni decisiones jurídicas. Los alcances parten sin sistemas, información o límites detallados: habrá que concretarlos después.</p>
    <RemoteStatus remote={spaces}/>{spaces.error && <button onClick={spaces.refresh}>Reintentar espacios</button>}
    {spaces.data?.siguiente && <button disabled={writer.busy || writer.uncertain} onClick={() => { setKnownSpaces(Object.fromEntries(available.map(s => [s.id, s]))); setCursor(spaces.data.siguiente); }}>Cargar más espacios existentes</button>}
    <form onSubmit={submit}><fieldset disabled={locked}>
      {proposal.espacios.map(s => <section className="profile-space" key={s.actividadId}><h3>{s.nombre}</h3><p>Alcance preliminar propuesto: {proposal.alcances.find(a => a.clave === s.actividadId)?.nombre}</p>
        <ProposedOperations api={api} base={base} ids={s.operaciones} references={proposal.operaciones}/>
        <Field label={'Espacio para ' + s.nombre}><select value={selection[s.actividadId]?.id || ''} onChange={e => { setSelection(old => ({ ...old, [s.actividadId]: available.find(x => x.id === e.target.value) || null })); setConfirmed(false); }}><option value="">Crear un espacio nuevo ({s.tipo || 'tipo pendiente'})</option>{available.map(x => <option key={x.id} value={x.id}>{x.nombre} · {x.tipo}</option>)}</select></Field>
        {!s.tipo && !selection[s.actividadId] && <p>Antes de crear el espacio, declara si esta actividad es un servicio o un producto.</p>}
      </section>)}
      {!proposal.espacios.length && <Empty>Añade y guarda las actividades en el primer paso para obtener propuestas.</Empty>}
      <Field label="Motivo de la confirmación"><input required maxLength={300} value={reason} onChange={e => setReason(e.target.value)}/></Field>
      <label className="profile-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>He revisado los espacios nuevos o reutilizados y acepto crear estos alcances preliminares.</label>
      <button className="api-primary" disabled={!confirmed || !proposal.espacios.length || spaces.loading || !!spaces.error}>Confirmar organización del trabajo</button>
    </fieldset></form>{issue && <Notice tone="warning">{issue}</Notice>}<WriteStatus writer={writer}/>
    {receipt && <Notice>{receipt.repetida ? 'El servidor ha recuperado el recibo del envío anterior; no ha duplicado esta operación.' : 'Organización del trabajo guardada.'} {receipt.espacios.length} vínculos a espacios y {receipt.alcances.length} alcances. Este recibo no acredita que sigan vigentes.<button onClick={onScopes}>Consultar alcances guardados</button></Notice>}
    {writer.error?.status === 409 && <Notice tone="warning">La propuesta o algún recurso cambió, o esta propuesta ya fue confirmada. No se enviará otra clave para forzar el guardado.<button onClick={() => { if (confirmLeave()) onRefresh(); }}>Consultar perfil y propuesta actuales</button><button onClick={() => { if (confirmLeave()) onScopes(); }}>Consultar alcances existentes</button></Notice>}
  </Panel><Panel title="Por qué aparecen estos marcos"><Candidates data={proposal}/></Panel></>;
}

function ScopeList({ api, base }) {
  const [before, setBefore] = useState(null), [selected, setSelected] = useState(null);
  const remote = useRemote(api, base + '/alcances' + queryString({ limite: 20, antes: before }));
  if (selected) return <ScopeDetail api={api} path={base + '/alcances/' + resourceId(selected)} onBack={() => setSelected(null)}/>;
  return <Panel title="Alcances guardados"><p>Son instantáneas preliminares del trabajo confirmado. Abre cada una para comprobar su revisión y si necesita actualizarse.</p><RemoteStatus remote={remote}/>
    {remote.data?.alcances.length === 0 && <Empty>Todavía no hay alcances confirmados. Consulta las propuestas del paso anterior.</Empty>}
    {remote.data?.alcances.map(a => <div className="api-row" key={a.id}><div><strong>{a.nombre}</strong><small>Revisión {a.versionActual} · Preliminar</small></div><button onClick={() => setSelected(a.id)}>Consultar alcance</button></div>)}
    <div className="api-actions"><button onClick={remote.refresh}>Actualizar alcances</button>{before && <button onClick={() => setBefore(null)}>Más recientes</button>}{remote.data?.siguienteAntes && <button onClick={() => setBefore(remote.data.siguienteAntes)}>Alcances anteriores</button>}</div>
  </Panel>;
}

function ScopeDetail({ api, path, onBack }) {
  const [number, setNumber] = useState(null), [before, setBefore] = useState(null);
  const [updating,setUpdating] = useState(false);
  const remote = useRemote(api, path + (number ? '/versiones/' + number : ''));
  const versions = useRemote(api, path + '/versiones' + queryString({ limite: 20, antes: before }));
  const data = remote.data;
  const base=path.slice(0,path.lastIndexOf('/alcances/'));
  const consult=number=>{if(confirmLeave()){setUpdating(false);setNumber(number);remote.refresh();}};
  return <><button onClick={()=>{if(confirmLeave())onBack();}}>Volver a alcances</button><RemoteStatus remote={remote}/>
    {data && <><Panel title={data.contenido.alcance.nombre}>
      <p>Revisión consultada: {data.revision.numero}. Revisión actual al consultar: {data.versionActual}. {when(data.revision.registradoEn)}.</p>
      <Notice tone={data.vigencia.necesitaRevision ? 'warning' : 'info'}>{data.vigencia.necesitaRevision ? 'Hay cambios posteriores: esta instantánea necesita revisión, no se ha recalculado ni sobrescrito.' : 'No se detectan cambios respecto a sus referencias al consultar. Esto no valida el cumplimiento.'}</Notice>
      {data.vigencia.motivos.length > 0 && <ul>{data.vigencia.motivos.map(m => <li key={m}>{m.replaceAll('_', ' ')}</li>)}</ul>}
      <p>Motivo: {data.revision.motivo}</p><p>Contexto de origen: revisión {data.contenido.origen.contextoVersion}.</p>
      <ProposedOperations api={api} base={path.slice(0,path.lastIndexOf('/alcances/'))} ids={(data.contenido.origen.operaciones||[]).map(o=>o.id)} references={data.contenido.origen.operaciones}/>
      <JsonDetail value={data.contenido.alcance} label="Consultar el alcance, vínculos, límites y exclusiones"/>
      <p>Puedes actualizar las referencias del mismo alcance sin cambiar su definición. Los límites, sistemas y exclusiones se conservan; su edición no se realiza desde esta pantalla.</p>
      {!updating && data.revision.numero===data.versionActual && data.vigencia.necesitaRevision && <button onClick={()=>setUpdating(true)}>Revisar actualización del alcance</button>}
      <button onClick={() => consult(null)}>Consultar revisión actual</button>
      {updating && <ScopeRefresh api={api} base={base} path={path} scope={data} onSaved={()=>{setUpdating(false);setNumber(null);remote.refresh();versions.refresh();}}/>}
    </Panel><Candidates data={data.contenido}/></>}
    <Panel title="Revisiones del alcance"><RemoteStatus remote={versions}/>{versions.data?.versiones.map(v => <div className="api-row" key={v.numero}><span>Revisión {v.numero} · {when(v.registradoEn)} · {v.motivo}</span><button onClick={() => consult(v.numero)}>Consultar revisión {v.numero}</button></div>)}<div className="api-actions">{before && <button onClick={() => setBefore(null)}>Revisiones recientes</button>}{versions.data?.siguienteAntes && <button onClick={() => setBefore(versions.data.siguienteAntes)}>Revisiones anteriores</button>}</div></Panel>
  </>;
}
