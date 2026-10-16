import React, { useEffect, useId, useRef, useState } from 'react';
import { cleanFact, newWrite } from '../api-client';
import { markDraft } from './draft-state';

export function useDirty(value) { const id = useId(); useEffect(() => { markDraft(id, value); return () => markDraft(id, false); }, [id, value]); }

export const when = value => value ? new Date(value).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha';
export const textValue = value => typeof value === 'boolean' ? value ? 'Sí' : 'No' : Array.isArray(value) ? value.join(', ') : String(value ?? '');
export function Notice({ children, tone = 'info' }) { return <div className={`api-notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>; }
export function ErrorBox({ error }) { return error ? <Notice tone="error"><strong>{error.status === 403 ? 'Acceso no autorizado' : error.status === 401 ? 'Sesión requerida o caducada' : 'No se ha completado la petición'}</strong><p>{error.message}</p><small>{error.code}{error.status ? ` · HTTP ${error.status}` : ''}. No se han sustituido los datos por una simulación.</small></Notice> : null; }
export function Empty({ children }) { return <div className="api-empty">{children}</div>; }
export function Field({ label, children, hint }) { return <label>{label}{children}{hint && <small>{hint}</small>}</label>; }
export function Panel({ title, children, action }) { return <section className="api-panel"><header><h2>{title}</h2>{action}</header>{children}</section>; }
export function JsonDetail({ value, label = 'Ver datos técnicos devueltos por el servidor' }) { return <details><summary>{label}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>; }
export function useRemote(api, path) {
  const [state, set] = useState({ data: null, loading: !!path, error: null });
  const [tick, update] = useState(0);
  useEffect(() => {
    let active = true;
    set({ data: null, loading: !!path, error: null });
    if (path) api.get(path).then(data => active && set({ data, loading: false, error: null }), error => active && set(previous => ({ ...previous, loading:false, error })));
    return () => { active = false; };
  }, [api, path, tick]);
  // Adopt only a response already fetched from this resource (for an explicit
  // conflict resolution). Parent metadata and editor must share that snapshot.
  return { ...state, refresh: () => update(t => t + 1), adopt: data => set({data,loading:false,error:null}) };
}
export function RemoteStatus({ remote }) { return <>{remote.loading && <p role="status">Consultando el servidor…</p>}<ErrorBox error={remote.error} /></>; }
export function useWriter(api, onSaved) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(null), [job, setJob] = useState(null);
  const lock = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function execute(next) {
    if (lock.current) return;
    lock.current = true; setJob(next); setBusy(true); setError(null);
    try { const result = await api.write(next); if (mounted.current) { setJob(null); onSaved(result); } }
    catch (e) { if (mounted.current) setError(e); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  return { busy, error, job, uncertain: !!job && !!error && (!error.status || error.status >= 500),
    run: (method, path, body) => execute(newWrite(method, path, body)),
    retry: () => job && execute(job), clear: () => { setError(null); setJob(null); } };
}
export function WriteStatus({ writer }) { return <><ErrorBox error={writer.error} />{writer.uncertain && <div className="api-actions"><button type="button" disabled={writer.busy} onClick={writer.retry}>Reintentar exactamente el mismo envío</button><small>No cambies el contenido ni crees otra operación mientras su resultado sea incierto.</small></div>}</>; }
export function Facts({ facts = [] }) { return facts.length ? <dl className="api-facts">{facts.map(f => <div key={f.clave}><dt>{f.clave.replaceAll('_', ' ')}</dt><dd>{f.estado === 'conocido' ? textValue(f.valor) : f.estado === 'desconocido' ? 'Pendiente de aclarar' : `Datos contradictorios: ${f.alternativas.map(a => textValue(a.valor)).join(' / ')}`}<small>{f.estado === 'conocido' ? 'Declarado; no revisado' : f.estado === 'conflictivo' ? 'No se elige una alternativa automáticamente' : f.motivo?.replaceAll('_', ' ')}</small></dd></div>)}</dl> : <Empty>No hay datos declarados. Esto no significa que las obligaciones no apliquen.</Empty>; }
function fieldType(f) { return Array.isArray(f.valor) ? 'lista' : typeof f.valor === 'boolean' ? 'booleano' : typeof f.valor === 'number' ? 'numero' : 'texto'; }
export function FactsEditor({ facts, onChange }) {
  const [key, setKey] = useState(''), [issue, setIssue] = useState('');
  const edit = (index, change) => onChange(facts.map((f, i) => i === index ? change(cleanFact(f)) : f));
  function add() {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(key) || ['constructor', 'prototype', '__proto__', 'toJSON'].includes(key) || facts.some(f => f.clave === key)) { setIssue('Utiliza una clave única del diccionario, sin espacios.'); return; }
    onChange([...facts, { clave: key, estado: 'desconocido', motivo: 'por_consultar' }]); setKey(''); setIssue('');
  }
  return <><Notice>Editor de datos declarados. El diccionario general de preguntas aún no está publicado. Una clave inventada aquí no crea un requisito ni una regla.</Notice>{facts.map((fact, index) => <fieldset className="api-fact-edit" key={fact.clave}><legend>{fact.clave}</legend><Field label="Situación del dato"><select value={fact.estado} onChange={e => edit(index, f => e.target.value === 'desconocido' ? { clave: f.clave, estado: 'desconocido', motivo: 'por_consultar' } : e.target.value === 'conflictivo' ? { clave: f.clave, estado: 'conflictivo', alternativas: [{ valor: true }, { valor: false }] } : { clave: f.clave, estado: 'conocido', valor: '' })}><option value="conocido">Conocido / declarado</option><option value="desconocido">No lo sé todavía</option><option value="conflictivo">Información contradictoria</option></select></Field>
    {fact.estado === 'conocido' && <div className="api-grid2"><Field label="Tipo de dato"><select value={fieldType(fact)} onChange={e => edit(index, f => ({ ...f, valor: ({ texto: '', booleano: true, numero: 0, lista: [] })[e.target.value] }))}><option value="texto">Texto</option><option value="booleano">Sí / No</option><option value="numero">Número</option><option value="lista">Lista de textos</option></select></Field><Field label="Valor declarado">{typeof fact.valor === 'boolean' ? <select value={String(fact.valor)} onChange={e => edit(index, f => ({ ...f, valor: e.target.value === 'true' }))}><option value="true">Sí</option><option value="false">No</option></select> : <input type={typeof fact.valor === 'number' ? 'number' : 'text'} maxLength={400} value={Array.isArray(fact.valor) ? fact.valor.join('; ') : fact.valor} onChange={e => edit(index, f => ({ ...f, valor: Array.isArray(f.valor) ? e.target.value.split(';').map(s => s.trim()).filter(Boolean) : typeof f.valor === 'number' ? Number(e.target.value) : e.target.value }))} />}</Field></div>}
    {fact.estado === 'desconocido' && <Field label="Motivo"><select value={fact.motivo} onChange={e => edit(index, f => ({ ...f, motivo: e.target.value }))}><option value="por_consultar">Necesito consultarlo</option><option value="no_sabe">No lo sé</option><option value="no_aportado">Aún no se ha aportado</option></select></Field>}
    {fact.estado === 'conflictivo' && <Field label="Alternativas (JSON de valores distintos)"><input defaultValue={JSON.stringify(fact.alternativas.map(a => a.valor))} onBlur={e => { try { const values = JSON.parse(e.target.value); if (!Array.isArray(values) || values.length < 2 || values.length > 5) throw Error(); edit(index, f => ({ ...f, alternativas: values.map(valor => ({ valor })) })); e.target.setCustomValidity(''); } catch { e.target.setCustomValidity('Introduce entre dos y cinco alternativas JSON válidas.'); e.target.reportValidity(); } }} /></Field>}
  </fieldset>)}<div className="api-grid2"><Field label="Añadir dato por su clave"><input value={key} maxLength={80} onChange={e => setKey(e.target.value)} placeholder="Clave del diccionario" /></Field><button type="button" onClick={add} disabled={facts.length >= 200}>Añadir dato pendiente</button></div>{issue && <Notice tone="error">{issue}</Notice>}</>;
}
export function Conflict({ writer, api, path, onResolve }) {
  const [latest, setLatest] = useState(null), [error, setError] = useState(null);
  if (![409].includes(writer.error?.status)) return null;
  return <section className="api-conflict"><h3>El borrador sigue aquí</h3><p>No se sustituirá la versión automáticamente. Consulta lo que cambió y revisa tu borrador antes de volver a guardar.</p><button type="button" onClick={async () => { try { setLatest(await api.get(path)); setError(null); } catch (e) { setError(e); } }}>Consultar versión actual para comparar</button><ErrorBox error={error} />{latest && <><div className="api-comparison"><h4>Versión actual en el servidor</h4><p>Versión {latest.contexto?.version ?? latest.versionActual ?? latest.version}</p>{(latest.operacion?.nombre || latest.nombre || latest.titulo) && <p><strong>{latest.operacion?.nombre || latest.nombre || latest.titulo}</strong></p>}{(latest.operacion?.descripcion || latest.descripcion) && <p>{latest.operacion?.descripcion || latest.descripcion}</p>}{latest.contexto && <Facts facts={latest.contexto.hechos} />}{latest.revision?.motivo && <p>Motivo registrado: {latest.revision.motivo}</p>}</div><JsonDetail value={latest} label="Detalle técnico completo de la versión actual" /><button type="button" onClick={() => { onResolve(latest); writer.clear(); setLatest(null); }}>He revisado los cambios; preparar nuevo guardado</button><small>Este botón no guarda. El siguiente envío tendrá una nueva clave y la versión revisada.</small></>}</section>;
}
