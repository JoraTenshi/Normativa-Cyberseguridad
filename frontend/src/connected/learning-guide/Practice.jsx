import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRemote } from '../ui';
import { readPractice, savePractice } from './practice-progress';

const Context = createContext(null);
export function PracticeProvider({ children }) {
  const [targets, setTargets] = useState(() => new Map()), [event, setEvent] = useState(null);
  const register = useCallback(target => {
    const key = Symbol(target.id);
    setTargets(old => new Map(old).set(key, target));
    return () => setTargets(old => { const next = new Map(old); next.delete(key); return next; });
  }, []);
  const report = useCallback((id, scope, outcome) => setEvent(old => ({id,scope,outcome,serial:(old?.serial || 0)+1})), []);
  const value = useMemo(() => ({targets,event,register,report}), [targets,event,register,report]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

// Explicit component refs and allowlisted events only; no document-wide selectors,
// field values, company IDs or business payloads enter persistent guide progress.
export function usePracticeTarget(id, scope, ready = true, empty = false) {
  const context = useContext(Context), root = useRef(null);
  const register = context?.register, report = context?.report;
  useEffect(() => {
    if (!register || !id) return undefined;
    return register({id,scope,ready,empty,root});
  }, [register,id,scope,ready,empty]);
  const observe = useCallback(outcome => { if (ready && id) report?.(id,scope,outcome); }, [report,id,scope,ready]);
  return {root,observe};
}

// Uses the existing reader: never adds a request or invokes a business writer.
// List practice requires a user gesture followed by a *new successful response*.
export function usePracticeRemote(api, path, id, scope, listKey, detail = false) {
  const remote = useRemote(api, path), armed = useRef(false), previous = useRef(null);
  const ready = !!remote.data && !remote.loading && !remote.error;
  const empty = ready && listKey ? remote.data[listKey]?.length === 0 : false;
  const target = usePracticeTarget(id,scope,ready,empty);
  useEffect(() => {
    if (!ready || previous.current === remote.data) return;
    previous.current = remote.data;
    if (detail || armed.current) { armed.current = false; target.observe(empty ? 'empty' : 'practiced'); }
  }, [ready,remote.data,detail,empty,target.observe]);
  return {...remote, practiceRef:target.root, armPractice:() => { armed.current = true; }};
}

export function journey(role) {
  return [
    {id:'company',section:'overview',title:'Reconoce tu empresa',text:'Abre «Empresa y permisos». Comprueba el nombre de la empresa activa y tu acceso. Sus servicios son parte de ese espacio, no otras cuentas.',target:'company'},
    {id:'services',section:'spaces',title:'Encuentra lo que ofrece tu empresa',text:'Cambia el filtro «Estado del subespacio» y consulta el resultado. Los servicios y productos organizan la actividad dentro de la empresa.',target:'services'},
    {id:'documents',section:'documents',title:'Localiza tu documentación',text:'Cambia «Estado del documento» entre activos y archivados. Espera la respuesta del listado: consultar no sube ni modifica archivos.',target:'documents'},
    role === 'administrador'
      ? {id:'task',section:'tasks',title:'Relaciona una tarea con su motivo',text:'Abre un registro de actuación. Busca la descripción, el responsable y los requisitos vinculados. No es necesario editar ni cerrar la tarea.',target:'task-list',detail:'task'}
      : {id:'document-detail',section:'documents',title:'Consulta el contexto de un documento',text:'Abre un documento autorizado. Observa sus metadatos y versiones. Esta práctica de consulta sustituye a la gestión de tareas, que tu rol no ofrece.',target:'documents',detail:'document-detail'},
    {id:'activity',section:'activity',title:'Sigue un cambio registrado',text:'Abre «Consultar este evento» en la cronología y lee sus datos. Es actividad registrada, no una medición del cumplimiento.',target:'activity'}
  ];
}

export function FirstSteps({active, surface, userId, reduced, onChapters}) {
  const context = useContext(Context), [saved,setSaved] = useState(null), [index,setIndex] = useState(0);
  const [notice,setNotice] = useState(''), [begun,setBegun] = useState(false);
  const [pending,setPending] = useState(false);
  const [focusRequest,setFocusRequest] = useState(0);
  const wantsFocus = useRef(false), stepTitle = useRef(null);
  const loaded = saved !== null;
  const scope = surface?.practiceScope, role = surface?.role;
  const available = surface?.kind === 'workspace' && surface.ready && ['administrador','consulta','colaborador'].includes(role);
  const steps = useMemo(() => journey(role), [role]), step = steps[index];
  const armed = useRef(false), boundary = useRef(0), prior = useRef(null);
  const sectionMatches = surface?.kind === 'workspace' && surface.ready && surface.section === step.section;
  const target = [...(context?.targets.values() || [])].find(t => t.scope === scope && t.ready && t.id === (step.detail || step.target))
    || [...(context?.targets.values() || [])].find(t => t.scope === scope && t.ready && t.id === step.target);
  const node = target?.root.current;
  const mark = useCallback((id,flag) => setSaved(old => {
    const current = old || readPractice(userId);
    const value = {version:2,lastStep:id,steps:{...current.value.steps,[id]:{...current.value.steps[id],[flag]:true}}};
    return {value,persistent:savePractice(userId,value)};
  }), [userId]);
  useEffect(() => {
    if (!active || saved) return;
    const stored = readPractice(userId);
    setSaved(stored);
    const resume = steps.findIndex(s => s.id === stored.value.lastStep);
    if (resume >= 0) setIndex(resume);
  }, [active,saved,userId,steps]);
  useEffect(() => {
    if (!active || prior.current !== scope) { armed.current = false; wantsFocus.current=false; setBegun(false); setPending(false); setNotice(''); }
    prior.current = scope;
  }, [active,scope]);
  useEffect(() => {
    if (!active || !loaded || !available) return;
    mark(step.id,'seen');
  // Only the presence of loaded progress matters; a mark must not retrigger itself.
  }, [active,available,step.id,mark,loaded]);
  useEffect(() => {
    if (!active || !begun || !sectionMatches || !node || node.closest('[hidden], [inert]')) return undefined;
    node.classList.add('learning-guide-target');
    return () => node.classList.remove('learning-guide-target');
  }, [active,begun,sectionMatches,node]);
  useEffect(() => {
    if (!active || !begun || !wantsFocus.current || !sectionMatches || !node || node.closest('[hidden], [inert]')) return;
    wantsFocus.current=false;
    node.scrollIntoView?.({behavior:reduced?'auto':'smooth',block:'center'});
    if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex','-1');
    node.focus({preventScroll:true});
  }, [active,begun,sectionMatches,node,reduced,focusRequest]);
  useEffect(() => { if (active && available && loaded) stepTitle.current?.focus({preventScroll:true}); }, [active,available,loaded,index]);
  useEffect(() => {
    if (!pending) return undefined;
    if (sectionMatches) { setPending(false); return undefined; }
    const timer = setTimeout(() => {setPending(false);armed.current=false;wantsFocus.current=false;setNotice('No hemos llegado a la sección. Tu pantalla y sus borradores siguen bajo tu control.');},8000);
    return () => clearTimeout(timer);
  }, [pending,sectionMatches]);
  useEffect(() => {
    const event = context?.event;
    if (!active || !begun || !armed.current || !sectionMatches || !event || event.serial <= boundary.current || event.scope !== scope ||
        event.id !== (step.detail || step.target) || !['practiced','empty'].includes(event.outcome)) return;
    boundary.current = event.serial;
    mark(step.id,event.outcome);
    setNotice('');
  }, [context?.event,active,begun,sectionMatches,scope,step,mark]);
  if (!active) return null;
  const flags = saved?.value.steps[step.id] || {};
  function begin() {
    if (!available) return;
    boundary.current = context?.event?.serial || 0; armed.current=true; wantsFocus.current=false; setNotice('');
    if (surface.section !== step.section && surface.navigate(step.section) !== true) {
      armed.current=false;setNotice('No se ha cambiado de sección ni descartado tu borrador.');return;
    }
    wantsFocus.current=true;setFocusRequest(value=>value+1);
    setBegun(true);setPending(surface.section !== step.section);
  }
  function next(value) { armed.current=false;wantsFocus.current=false;setBegun(false);setPending(false);setNotice('');setIndex(value); }
  return <div className="first-steps">
    <p>Cinco prácticas breves con tus permisos actuales. Avanza a tu ritmo; no necesitas crear datos.</p>
    <p className="learning-storage">{!saved ? 'Recuperando tu progreso local…' : saved.persistent ? 'Progreso separado por cuenta, solo en este navegador.' : 'Progreso solo en memoria; el almacenamiento no está disponible o no era válido.'}</p>
    <p className="learning-summary">{steps.filter(s => saved?.value.steps[s.id]?.practiced).length} de 5 prácticas observadas · {steps.filter(s => saved?.value.steps[s.id]?.empty && !saved?.value.steps[s.id]?.practiced).length} exploradas sin datos. No mide cumplimiento.</p>
    {!available ? <p role="status">Entra primero en una empresa con acceso confirmado. Si todavía no tienes acceso, utiliza «Mis solicitudes». No necesitas crear registros para aprender.</p> : <>
      <nav aria-label="Tus cinco primeros pasos"><ol className="first-step-list">{steps.map((s,i) => <li key={s.id}><button aria-current={i===index?'step':undefined} onClick={() => next(i)}><span>{i+1}</span>{s.title}</button></li>)}</ol></nav>
      <section aria-labelledby="practice-title"><p className="learning-step-count" aria-live="polite">Paso {index+1} de 5</p><h3 id="practice-title" ref={stepTitle} tabIndex={-1}>{step.title}</h3><p>{step.text}</p>
        {(flags.practiced || flags.empty) && <p className="practice-states" role="status">{flags.practiced ? 'Práctica observada en este navegador.' : 'Consulta realizada sin datos. No cuenta como lectura de un registro.'}</p>}
        <div className="learning-actions"><button className="learning-primary" onClick={begin} disabled={pending}>Ver</button></div>
        {pending && <p role="status">Abriendo la sección…</p>}
        {begun && sectionMatches && !target && <p role="status">Esperando el contenido disponible. Si aparece un error en la aplicación, reintenta allí; no lo contamos como práctica.</p>}
        {notice && <p role="status" className="learning-notice">{notice}</p>}
        <div className="learning-paging"><button disabled={index===0} onClick={() => next(index-1)}>Anterior</button><button disabled={index===4} onClick={() => next(index+1)}>Siguiente</button></div>
        {index===4 && <p>Este es el último paso. Puedes elegir otro tema en el índice de capítulos.</p>}
      </section></>}
    <a className="learning-index-link" href="#learning-chapter-index" onClick={event=>{event.preventDefault();onChapters();}}>Índice de capítulos</a>
  </div>;
}
