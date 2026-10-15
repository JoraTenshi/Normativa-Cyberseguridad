import React, { useEffect, useState } from 'react';
import { queryString, resourceId } from '../api-client';
import { Empty, ErrorBox, RemoteStatus, useRemote } from './ui';
import { operationReference, operationDetail } from './profile-operations-model';
import './profile-operations.css';

function SavedOperation({ api, base, id, remove }) {
  const remote = useRemote(api, base + '/operaciones/' + resourceId(id));
  let record, issue;
  if (remote.data) { try { record = operationDetail(remote.data, base, id); } catch (e) { issue = e; } }
  return <div className="profile-operation-missing">
    <strong>{record?.nombre || 'Operación vinculada fuera del listado'}</strong>
    {record && <small>Revisión actual {record.version}. Conserva el vínculo aunque no esté en esta página.</small>}
    <RemoteStatus remote={remote}/><ErrorBox error={issue}/>
    {(remote.error || issue) && <p>No se puede consultar este vínculo. No se sustituye ni se retira automáticamente.</p>}
    <button type="button" onClick={remove}>Retirar este vínculo del borrador</button>
  </div>;
}

export default function ProfileOperations({ api, base, value, onChange, onRead }) {
  const [before, setBefore] = useState(null), [previous, setPrevious] = useState({});
  const remote = useRemote(api, base + '/operaciones' + queryString({ limite:20, antes:before }));
  const selected = value.split(';').map(s => s.trim()).filter(Boolean);
  let issue, page = [];
  if (remote.data) {
    try {
      if (!Array.isArray(remote.data.operaciones)) throw new Error('El listado de operaciones no tiene el formato esperado.');
      page = remote.data.operaciones.map(operationReference);
    } catch (e) { issue = e; }
  }
  const records = { ...previous, ...Object.fromEntries(page.map(o => [o.id,o])) };
  // Reading does not edit the fact. References are only used to detect stale choices on save.
  useEffect(() => {
    if (!remote.data || !Array.isArray(remote.data.operaciones)) return;
    try { const refs=remote.data.operaciones.map(operationReference); onRead(old => ({...old,...Object.fromEntries(refs.map(o=>[o.id,o]))})); } catch { /* Rendered above; never fall back to unchecked records. */ }
  }, [remote.data,onRead]);
  const toggle = (id, checked) => onChange([...selected.filter(v=>v!==id), ...(checked?[id]:[])].join('; '));
  return <div className="profile-operation-picker">
    <p>Selecciona las operaciones que forman parte de esta actividad. Puedes vincular una misma operación a varias actividades.</p>
    <RemoteStatus remote={remote}/><ErrorBox error={issue}/>
    {!remote.error && !issue && <fieldset disabled={remote.loading}><legend>Operaciones existentes de tu organización</legend>
      {Object.values(records).map(o => <label className="profile-operation-option" key={o.id}>
        <input type="checkbox" checked={selected.includes(o.id)} onChange={e=>toggle(o.id,e.target.checked)}/>
        <span><strong>{o.nombre}</strong><small>Revisión {o.version}{o.descripcion ? ' · '+o.descripcion : ''}</small></span>
      </label>)}
    </fieldset>}
    {!remote.loading && !remote.error && !issue && !Object.keys(records).length && <Empty>No hay operaciones creadas todavía. Guarda tus cambios, abre «Operaciones y cuestiones» y pulsa «Describir una operación». Después vuelve aquí y actualiza el listado.</Empty>}
    {selected.filter(id=>!records[id]).map(id=><SavedOperation key={id} api={api} base={base} id={id} remove={()=>toggle(id,false)}/>)}
    <div className="api-actions">
      <button type="button" disabled={remote.loading} onClick={()=>{setPrevious({});setBefore(null);remote.refresh();}}>Actualizar operaciones</button>
      {remote.data?.paginacion?.hayMas && !issue && <button type="button" disabled={remote.loading} onClick={()=>{setPrevious(records);setBefore(remote.data.paginacion.siguienteAntes);}}>Cargar más operaciones</button>}
    </div>
    <small>{selected.length} seleccionada{selected.length===1?'':'s'}. El vínculo se guarda con este bloque; el alcance solo se crea al confirmar la propuesta.</small>
  </div>;
}

export function ProposedOperations({ api, base, ids = [], references = [] }) {
  return <div className="profile-operation-summary"><strong>Operaciones incluidas en este alcance</strong>
    {!ids.length && <p>Sin operaciones vinculadas. Puedes volver a la actividad antes de confirmar.</p>}
    {ids.map(id=><ProposedOperation key={id} api={api} base={base} reference={references.find(r=>r.id===id)} id={id}/>)}
  </div>;
}
function ProposedOperation({ api, base, id, reference }) {
  const version=reference?.version;
  const remote=useRemote(api, Number.isSafeInteger(version) ? base+'/operaciones/'+resourceId(id)+'/versiones/'+version : null);
  const name=remote.data?.operacion?.nombre;
  return <div><RemoteStatus remote={remote}/><p>{name || 'Operación pendiente de lectura'} · revisión {version ?? 'no disponible'}</p>
    {reference && <details><summary>Referencia exacta de esta propuesta</summary><code>{reference.id} · v{version} · SHA-256 {reference.sha256}</code></details>}
  </div>;
}
