import React, { useContext, useId, useLayoutEffect, useRef, useState } from 'react';
import { queryString, resourceId } from '../api-client';
import { ErrorBox, Field, RemoteStatus, useRemote } from './ui';
import { recordLabel } from './normative-api-model';
import { ReferenceSelectionContext } from './ReferenceSelection';

const signature = rows => JSON.stringify(rows.map(row => [row.id, row.version, row.referencia?.sha256, row.revision?.numero, row.contexto?.version]));

// Retain selection intent independently from resolved DTOs. Never silently save a subset.
export function RecordPicker({api,path,kind,label,selected=[],onChange,multiple=false,accept=()=>true}) {
  const [before,setBefore] = useState(null);
  const [,render] = useState(0);
  const gate = useContext(ReferenceSelectionContext), pickerId = useId();
  const jobs = useRef(new Map()), mounted = useRef(false);
  const current = useRef({api,path,kind,selected,onChange,signature:signature(selected)});
  const legacy = ['alcances','operaciones','documentos'].includes(kind);
  const cursorKey = kind === 'documentos' ? 'despues' : 'antes';
  const remote = useRemote(api,path+queryString({limite:20,[cursorKey]:before,...(kind==='documentos'?{estado:'activo'}:{})}));
  const rows = remote.data?.[legacy?kind:'registros'] || [];
  const next = remote.data?.paginacion?.siguienteAntes || remote.data?.siguienteAntes || remote.data?.siguiente;
  const refresh = () => { if (mounted.current) { render(value=>value+1); gate?.notify(); } };

  useLayoutEffect(() => {
    mounted.current = true;
    const unregister = gate?.register(pickerId, () => {
      const outstanding = [...jobs.current.values()];
      return outstanding.length ? `${label}: ${outstanding.some(job=>job.error)?'hay selecciones que no se han podido consultar. Reintenta o cancela esas selecciones.':'espera a que terminen de consultarse todas las selecciones.'}` : null;
    });
    return () => { mounted.current=false; jobs.current.clear(); unregister?.(); };
  }, [gate,pickerId,label]);

  useLayoutEffect(() => {
    const previous = current.current, nextSignature = signature(selected);
    if (previous.api!==api || previous.path!==path || previous.kind!==kind || previous.signature!==nextSignature) {
      jobs.current.clear();
      setBefore(null);
      refresh();
    }
    current.current = {api,path,kind,selected,onChange,signature:nextSignature};
  });

  function commit(value) {
    current.current.selected=value;
    current.current.signature=signature(value);
    current.current.onChange(value);
  }
  function cancel(id) { jobs.current.delete(id); refresh(); }
  async function choose(id, previousLabel) {
    if (!id) return;
    if (!multiple) jobs.current.clear();
    if (jobs.current.get(id)?.pending) return;
    const job = {id,label:previousLabel || recordLabel(rows.find(row=>row.id===id) || {id}),pending:true,error:null,api,path,kind};
    jobs.current.set(id,job);
    refresh();
    const active = () => mounted.current && jobs.current.get(id)===job && current.current.api===job.api && current.current.path===job.path && current.current.kind===job.kind;
    try {
      const result = await api.get(path+'/'+resourceId(id));
      if (!active()) return;
      const dto = kind==='operaciones'?{...result,id:result.operacion.id}:result;
      if (dto.id!==id) throw new Error('La referencia recibida no corresponde a la selección.');
      const values = multiple ? [...current.current.selected.filter(row=>row.id!==id),dto] : [dto];
      commit(values);
      jobs.current.delete(id);
      refresh();
    } catch(error) {
      if (!active()) return;
      job.pending=false; job.error=error; refresh();
    }
  }
  const outstanding = [...jobs.current.values()];
  return <section className="norm-picker"><Field label={label}><select value="" disabled={remote.loading||!!remote.error} onChange={event=>choose(event.target.value)}><option value="">Selecciona un registro…</option>{rows.filter(accept).map(row=><option key={row.id} value={row.id} disabled={jobs.current.has(row.id)||(multiple&&selected.some(value=>value.id===row.id))}>{recordLabel(row)} · v{row.version || row.versionActual}</option>)}</select></Field><RemoteStatus remote={remote}/>{remote.data&&!rows.length&&<p>No hay registros en esta página.</p>}
    {!!outstanding.length&&<ul aria-label={'Selecciones pendientes de '+label.toLowerCase()}>{outstanding.map(job=><li key={job.id}><strong>{job.label}</strong>{job.pending?<p role="status">Consultando esta selección. No se guardará un conjunto incompleto.</p>:<ErrorBox error={job.error}/>}<button type="button" onClick={()=>cancel(job.id)}>Cancelar selección de {job.label}</button>{job.error&&<button type="button" onClick={()=>choose(job.id,job.label)}>Reintentar selección de {job.label}</button>}</li>)}</ul>}
    <ul className="norm-selected">{selected.map(row=><li key={row.id}><span>{recordLabel(row)} <small>Versión {row.version || row.revision?.numero || row.contexto?.version || row.versionActual} · {row.id}</small></span><button type="button" onClick={()=>{cancel(row.id);commit(current.current.selected.filter(value=>value.id!==row.id));}}>Quitar selección</button></li>)}</ul>
    <div className="api-actions">{before&&<button type="button" onClick={()=>setBefore(null)}>Primera página de {label.toLowerCase()}</button>}{next&&<button type="button" onClick={()=>setBefore(next)}>Más opciones de {label.toLowerCase()}</button>}<button type="button" onClick={remote.refresh}>Actualizar opciones</button></div></section>;
}
