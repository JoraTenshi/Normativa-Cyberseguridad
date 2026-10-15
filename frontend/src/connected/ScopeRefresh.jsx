import React, { useState } from 'react';
import { Field, Notice, ErrorBox, RemoteStatus, useRemote, useWriter, WriteStatus, useDirty, JsonDetail } from './ui';
import { ProposedOperations } from './ProfileOperations';

const fail = message => { throw new Error(message); };
const sameIds = (a,b) => a.length === b.length && [...a].sort().every((id,i)=>id === [...b].sort()[i]);
export function scopeRefreshPlan(scope, current, proposal, base) {
  const org=base.split('/').pop();
  if (!scope || !current || scope.id !== current.id || scope.organizacionId !== org || current.organizacionId !== org) fail('No se puede confirmar la identidad de este alcance.');
  if (!Number.isSafeInteger(scope.versionActual) || scope.versionActual<1 || !/^[a-f0-9]{64}$/.test(scope.revision?.sha256) || scope.revision.numero !== scope.versionActual || current.revision.numero !== current.versionActual || current.versionActual !== scope.versionActual || current.revision.sha256 !== scope.revision.sha256) fail('El alcance tiene otra revisión. Cierra esta comparación y consulta la revisión actual antes de continuar.');
  if (proposal?.versionContrato !== 1 || !Number.isSafeInteger(proposal.contextoVersion) || proposal.contextoVersion<1 || !/^[a-f0-9]{64}$/.test(proposal.propuestaHuella)) fail('No se dispone de una propuesta actual compatible.');
  if (current.vigencia?.motivos?.some(m=>m.startsWith('subespacio_modificado:'))) fail('Ha cambiado un servicio o producto vinculado. Este ajuste no sustituye sus vínculos: necesita una revisión de la definición del alcance.');
  const stored=scope.contenido.alcance;
  const {nombre,actividadIds,subespacios,sistemas,informacion,limites,exclusiones,dependencias}=stored;
  if (!nombre || !Array.isArray(actividadIds) || !actividadIds.length || !Array.isArray(subespacios) || !subespacios.length || ![sistemas,informacion,exclusiones,dependencias].every(Array.isArray) || typeof limites !== 'string') fail('La definición guardada está incompleta. No se reemplazará por valores vacíos.');
  const spaces=actividadIds.map(id=>proposal.espacios?.find(s=>s.actividadId===id));
  if (spaces.some(s=>!s || !Array.isArray(s.operaciones))) fail('Alguna actividad ya no está en el perfil. Revisa la definición del alcance antes de actualizar sus referencias.');
  const previous=scope.contenido.origen.operaciones;
  const ids=[...new Set(spaces.flatMap(s=>s.operaciones))];
  if (!Array.isArray(previous) || !sameIds(previous.map(o=>o.id),ids)) fail('Han cambiado las operaciones incluidas. Esta actualización no añade ni retira operaciones: revisa primero la definición del alcance.');
  const next=ids.map(id=>proposal.operaciones?.find(o=>o.id===id));
  if (next.some(o=>!o || !/^[a-f0-9]{24}$/.test(o.id) || !Number.isSafeInteger(o.version) || o.version<1 || !/^[a-f0-9]{64}$/.test(o.sha256))) fail('No se pueden comprobar las referencias actuales de las operaciones.');
  // Only accepted definition fields are sent. No defaults, new membership, or old calculated results.
  return {datos:JSON.parse(JSON.stringify({nombre,actividadIds,subespacios,sistemas,informacion,limites,exclusiones,dependencias})),previous,next,
    actividades:spaces.map(s=>s.nombre || s.actividadId),version:scope.versionActual,contextoVersion:proposal.contextoVersion,propuestaHuella:proposal.propuestaHuella};
}
export function scopeRefreshBody(plan, reason, confirmed) {
  if (!confirmed || !reason.trim() || reason.trim().length>300) fail('Revisa las referencias y explica el motivo antes de confirmar.');
  const {version,contextoVersion,propuestaHuella,datos}=plan;
  return {version,contextoVersion,propuestaHuella,datos,motivo:reason.trim()};
}
export default function ScopeRefresh({api,base,path,scope,onSaved}) {
  const current=useRemote(api,path), proposal=useRemote(api,base+'/contexto/propuestas');
  const [reason,setReason]=useState(''), [confirmed,setConfirmed]=useState(false), [issue,setIssue]=useState(null);
  const writer=useWriter(api,onSaved);
  useDirty(!!reason || confirmed || writer.busy || writer.uncertain);
  let plan,error;
  if (current.data && proposal.data && !current.loading && !proposal.loading && !current.error && !proposal.error) {
    try {plan=scopeRefreshPlan(scope,current.data,proposal.data,base);} catch(e) {error=e;}
  }
  const locked=writer.busy || writer.uncertain || !!writer.error || !plan;
  return <section aria-label="Comparar referencias del alcance">
    <h3>Actualizar las referencias de este alcance</h3>
    <Notice>Se crea una nueva revisión del mismo alcance. Conservamos su nombre, actividades, servicios, sistemas, información, límites, exclusiones y dependencias. No se reescriben decisiones ni revisiones normativas anteriores.</Notice>
    <RemoteStatus remote={current}/><RemoteStatus remote={proposal}/><ErrorBox error={error}/>
    {plan && <><p>Contexto de empresa: revisión {scope.contenido.origen.contextoVersion} → {plan.contextoVersion}.</p>
      <p>Actividades incluidas, sin cambios: {plan.actividades.join(' · ')}.</p>
      <p>Servicios y productos vinculados: se conservan los mismos {plan.datos.subespacios.length} vínculos y sus versiones. No se añade ni sustituye ninguno.</p>
      <ul>{plan.datos.subespacios.map(s=><li key={s.id}>Referencia {s.id} · versión {s.version} → {s.version}</li>)}</ul>
      <h4>Referencias guardadas</h4><ProposedOperations api={api} base={base} ids={plan.previous.map(o=>o.id)} references={plan.previous}/>
      <h4>Referencias que se guardarán</h4><ProposedOperations api={api} base={base} ids={plan.next.map(o=>o.id)} references={plan.next}/>
      <JsonDetail value={plan.datos} label="Definición que se conserva sin cambios"/>
      <p>Después vuelve al requisito y actualiza su contextualización. Este guardado no acredita cumplimiento.</p></>}
    <form onSubmit={e=>{e.preventDefault();if(locked)return;try{setIssue(null);writer.run('PATCH',path,scopeRefreshBody(plan,reason,confirmed));}catch(e){setIssue(e);}}}>
      <fieldset disabled={locked}><Field label="Motivo de la actualización del alcance"><input maxLength={300} required value={reason} onChange={e=>setReason(e.target.value)}/></Field>
        <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>He revisado las referencias y quiero guardar una nueva revisión del mismo alcance.</label>
        <button className="api-primary" disabled={!confirmed || !reason.trim()}>Guardar nueva revisión del alcance</button>
      </fieldset>
    </form><ErrorBox error={issue}/><WriteStatus writer={writer}/>
    {writer.error?.status===409 && <Notice tone="warning">El borrador se conserva. No se fuerza una revisión nueva con las referencias anteriores.<button onClick={()=>{writer.clear();setConfirmed(false);current.refresh();proposal.refresh();}}>Volver a consultar las referencias</button></Notice>}
  </section>;
}
