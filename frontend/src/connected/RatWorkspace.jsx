import React, { useState } from 'react';
import { ApiError, downloadBlob, queryString, resourceId } from '../api-client';
import { confirmLeave } from './draft-state';
import { ErrorBox, JsonDetail, Notice, Panel, RemoteStatus, useRemote, when } from './ui';
import { RecordVersions } from './NormativeControls';
import { RESULTS } from './normative-api-model';
import { SupportRead } from './NormativeSupports';
import RatEditor from './RatEditor';
import { RatReview, RatAction } from './RatReview';
import { RAT_RESOURCES, RAT_LABELS, RAT_CRITERIA, ratPath } from './rat-model';

export default function RatWorkspace({ api, base, onNavigate }) {
  const remote=useRemote(api,base+'/normativa/rat/contrato');
  const [kind,setKind]=useState('registros-rat'),[id,setId]=useState(null),[creating,setCreating]=useState(false),[tick,setTick]=useState(0);
  const contract=remote.data?.contrato;
  const valid=contract?.id==='REGISTRO_RAT_E11'&&contract.version===1;
  function openSaved(next,selected=null){setKind(next);setId(selected);setCreating(false);setTick(n=>n+1);}
  function open(next,selected=null){if(!confirmLeave())return;openSaved(next,selected);}
  const saved=d=>{setCreating(false);setId(d.id);};
  return <div className="norm-workspace"><p className="api-intro">Organiza el registro por función y alcance. Conserva sus actividades, documentos, revisiones y trabajo pendiente.</p><RemoteStatus remote={remote}/>{remote.error&&<button onClick={remote.refresh}>Reintentar conexión del RAT</button>}{contract&&!valid&&<Notice tone="error">El contrato del RAT no es compatible. No se han cargado datos de demostración.</Notice>}{valid&&<><nav className="api-tabs" aria-label="Registro de actividades">{Object.entries(RAT_RESOURCES).map(([key,label])=><button key={key} aria-pressed={kind===key} onClick={()=>open(key)}>{label}</button>)}</nav>
    {creating?<><button className="api-back" onClick={()=>open('registros-rat')}>← Volver a registros</button><RatEditor api={api} base={base} contract={contract} onSaved={saved}/></>:id?<RatDetail key={kind+id+tick} api={api} base={base} kind={kind} id={id} contract={contract} onOpen={open} onSavedOpen={openSaved} onBack={()=>open(kind)}/>:<><RatList key={kind+tick} api={api} base={base} kind={kind} onOpen={selected=>open(kind,selected)}/>{kind==='registros-rat'&&remote.data.permisos?.crear===true&&<button className="api-primary" onClick={()=>setCreating(true)}>Preparar un RAT</button>}</>}
    {onNavigate&&<div className="api-actions"><button onClick={()=>onNavigate('operations')}>Aclarar tratamientos y roles</button><button onClick={()=>onNavigate('profile')}>Revisar perfil y alcance</button><button onClick={()=>onNavigate('regulations',{kind:'evidencias'})}>Documentar evidencias</button></div>}</>}</div>;
}
export function RatList({ api, base, kind, onOpen, recordId }) {
  const [before,setBefore]=useState(null),remote=useRemote(api,ratPath(base,kind)+queryString({limite:10,antes:before,requisitoId:recordId}));
  return <Panel title={RAT_RESOURCES[kind]}><RemoteStatus remote={remote}/>{remote.data?.registros?.map(d=><div className="api-row" key={d.id}><div><strong>{d.contenido.registroRAT?.nombre||d.contenido.actuacionRAT?.titulo||(d.contenido.revisionRAT?'Revisión: '+RESULTS[d.contenido.revisionRAT.conclusion]:d.id)}</strong><small>Versión {d.version} · {when(d.revision.registradoEn)}</small></div><button onClick={()=>onOpen(d.id)}>Consultar registro</button></div>)}{remote.data?.registros?.length===0&&<p>No hay registros en esta página. No implica ausencia de obligaciones.</p>}<div className="api-actions">{before&&<button onClick={()=>setBefore(null)}>Más recientes</button>}{remote.data?.paginacion?.hayMas&&<button onClick={()=>setBefore(remote.data.paginacion.siguienteAntes)}>Registros anteriores</button>}<button onClick={remote.refresh}>Actualizar listado</button></div></Panel>;
}
function RatDetail({ api, base, kind, id, contract, onOpen, onSavedOpen, onBack }) {
  const [version,setVersion]=useState(undefined),[mode,setMode]=useState('read'),[selectedRef,setSelectedRef]=useState(null);
  const remote=useRemote(api,ratPath(base,kind,id,version)),d=remote.data,current=d?.version===d?.versionActual;
  function reset(){if(confirmLeave()){setMode('read');setVersion(undefined);remote.refresh();}}
  // Only a confirmed write may bypass the leave guard. User navigation still
  // checks the unsaved draft; the saved form is unmounted by this transition.
  function saved(result){setMode('read');if(result.tipo==='revision_rat')onSavedOpen('revisiones-rat',result.id);else if(result.tipo==='actuacion_rat')onSavedOpen('actuaciones-rat',result.id);else remote.adopt(result);}
  return <><button className="api-back" onClick={onBack}>← Volver al listado</button><RemoteStatus remote={remote}/>{remote.error&&<button onClick={remote.refresh}>Reintentar registro</button>}{d&&<><header className="api-subheading"><h2>{d.contenido.registroRAT?.nombre||d.contenido.actuacionRAT?.titulo||'Revisión del RAT'}</h2><span>Versión consultada {d.version} · versión actual {d.versionActual}</span><p>{when(d.revision.registradoEn)} · {d.revision.motivo}</p></header>{!current&&<Notice tone="warning">Versión histórica: no se reescribe ni se restaura al consultarla. El estado actual se muestra por separado.</Notice>}
    <div className="api-actions">{mode==='read'&&current&&d.permisos?.actualizar===true&&<button onClick={()=>setMode('edit')}>Editar este registro</button>}{kind==='registros-rat'&&current&&mode==='read'&&d.permisos?.revisar===true&&<><button onClick={()=>setMode('review')}>Registrar revisión del RAT</button><button onClick={()=>setMode('action')}>Preparar actuación del RAT</button></>}<button onClick={reset}>{mode==='read'?'Consultar versión actual':'Cerrar editor y consultar actual'}</button></div>
    {mode==='edit'?(kind==='registros-rat'?<RatEditor key={d.version} api={api} base={base} contract={contract} data={d} onSaved={saved} onRestart={remote.adopt}/>:<RatAction key={d.version} api={api} base={base} contract={contract} data={d} onSaved={saved} onRestart={remote.adopt}/>):mode==='review'?<RatReview api={api} base={base} contract={contract} record={d} onSaved={saved}/>:mode==='action'?<RatAction api={api} base={base} contract={contract} record={d} onSaved={saved}/>:<>
      <RatStatus dto={d}/><RatRead dto={d} onReference={(type,ref)=>setSelectedRef({type,ref})}/>
      {kind==='registros-rat'&&<><RatList api={api} base={base} kind="actuaciones-rat" recordId={d.id} onOpen={next=>onOpen('actuaciones-rat',next)}/><RatList api={api} base={base} kind="revisiones-rat" recordId={d.id} onOpen={next=>onOpen('revisiones-rat',next)}/></>}
      <RecordVersions api={api} path={ratPath(base,kind,id)} onSelect={v=>{setVersion(v);setSelectedRef(null);}}/><JsonDetail value={{referencia:d.referencia,revision:d.revision}} label="Identidad, huella y autor de esta versión"/>
    </>}{selectedRef&&<RatReference key={selectedRef.ref.id+selectedRef.ref.version} api={api} base={base} selection={selectedRef} onClose={()=>setSelectedRef(null)}/>}</>}</>;
}
export function RatStatus({ dto }) {
  const s=dto.estadoRAT;
  if(!s)return dto.vigencia?.requiereRevision?<Notice tone="warning">El registro vinculado ha cambiado. Revisa esta actuación; su cierre no aprueba el RAT.</Notice>:null;
  return <Notice tone={s.requiereRevision?'warning':'info'}><strong>Estado actual del RAT · versión {s.seRefiereAVersionActual}: {RESULTS[s.satisfaccionActual]||s.satisfaccionActual}</strong><p>Conclusión histórica: {s.conclusionHistorica?RESULTS[s.conclusionHistorica]:'Sin revisión registrada'}. {!s.cubrePeriodo&&s.conclusionHistorica?'El periodo examinado no cubre la consulta actual.':''}</p>{s.motivos?.length>0&&<ul>{s.motivos.map(m=><li key={m}>{m.replaceAll('_',' ')}</li>)}</ul>}<p>Estado informado por el servidor; no es una certificación ni se calcula contando tareas terminadas.</p></Notice>;
}
function FieldRead({ name, field }) {return <div><h4>{RAT_LABELS[name]||name}</h4><p>{field.estado.replaceAll('_',' ')}</p>{field.contenido&&<p>{field.contenido}</p>}{field.motivo&&<p>{field.motivo}</p>}</div>;}
function RefButtons({ refs=[], type, onReference }) {return <div className="api-actions">{refs.map(r=><button key={r.id+':'+r.version} onClick={()=>onReference(type,r)}>Consultar {type==='operaciones'?'tratamiento':type==='evidencias'?'evidencia':'RAT'} · v{r.version} · {r.id.slice(-6)}</button>)}</div>;}
function RatRead({ dto, onReference }) {
  const c=dto.contenido.registroRAT,r=dto.contenido.revisionRAT,a=dto.contenido.actuacionRAT;
  if(a)return <><p>{a.descripcion}</p><p>Estado: {a.estado.replaceAll('_',' ')} · membresía responsable: {a.responsableMembresiaId}</p><Notice>Finalizar este trabajo no modifica la conclusión del RAT.</Notice><RefButtons refs={[a.registro]} type="registros-rat" onReference={onReference}/></>;
  if(r)return <><h3>Conclusión conservada: {RESULTS[r.conclusion]}</h3><p>Periodo examinado: {r.periodoExaminado.desde} → {r.periodoExaminado.hasta}, ambos incluidos.</p><RefButtons refs={[r.registro]} type="registros-rat" onReference={onReference}/>{r.criterios.map(row=><details key={row.id}><summary>{RAT_CRITERIA[row.id]||row.id} · {RESULTS[row.resultado]}</summary><p>{row.motivo}</p><RefButtons refs={r.evidencias.filter(e=>row.evidenciaIds.includes(e.id))} type="evidencias" onReference={onReference}/></details>)}<JsonDetail value={r} label="Snapshot de la revisión y evidencias exactas"/></>;
  if(!c)return <Notice tone="error">El registro recibido no corresponde al contrato RAT.</Notice>;
  return <><p>Función: <strong>{c.funcion}</strong> · fecha de referencia: {c.fechaReferencia}</p><p>{c.entidad.nombre} · {c.entidad.contacto}</p><Notice>Integridad declarada: {c.inventarioCompleto?'declarada completa':'pendiente'}. Esta declaración no acredita cumplimiento.</Notice>{['representante','dpd','sujeto77','comunicacionDPD','disponibilidadAutoridad'].map(k=><FieldRead key={k} name={k} field={c[k]}/>)}
    <h3>Actividades registradas</h3>{c.entradas.map(e=><details key={e.id} open><summary>{e.titulo}</summary><RefButtons refs={e.operaciones} type="operaciones" onReference={onReference}/>{Object.entries(e.campos).map(([k,f])=><FieldRead key={k} name={k} field={f}/>)}{e.responsables.map(r=><section key={r.id}><h4>Por cuenta de {r.responsable.nombre}</h4><p>{r.responsable.contacto}</p>{['representante','dpd','categorias','finalidades'].map(k=><FieldRead key={k} name={k} field={r[k]}/>)}</section>)}<RefButtons refs={e.evidencias} type="evidencias" onReference={onReference}/></details>)}<RefButtons refs={c.evidencias} type="evidencias" onReference={onReference}/><h3>Comprobaciones conservadas al guardar</h3>{c.diagnostico?.incidencias?.length?<ul>{c.diagnostico.incidencias.map(i=><li key={i}>{i.replaceAll('_',' ')}</li>)}</ul>:<p>Sin incidencias señaladas en este diagnóstico. Pendiente de la revisión motivada; no es un resultado favorable.</p>}<JsonDetail value={c.diagnostico} label="Diagnóstico de esta versión: actividades, omisiones y límites"/>{c.fuentes?.map(f=><p key={f.url}><a href={f.url} target="_blank" rel="noreferrer">Fuente oficial · {f.preceptos}</a></p>)}</>;
}
function RatReference({ api, base, selection, onClose }) {
  const {type,ref}=selection;
  const path=type==='operaciones'?base+'/operaciones/'+resourceId(ref.id)+'/versiones/'+ref.version:type==='evidencias'?base+'/normativa/evidencias/'+resourceId(ref.id)+'/versiones/'+ref.version:ratPath(base,type,ref.id,ref.version);
  const remote=useRemote(api,path),[error,setError]=useState(null);
  const received=type==='operaciones'?remote.data?.revision?.sha256:remote.data?.referencia?.sha256;
  const match=received===ref.sha256;
  async function openPDF(file){try{const blob=await api.download(base+'/documentos/'+resourceId(file.documentoId)+'/versiones/'+file.numero+'/archivo');const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());if([...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')!==file.sha256)throw new ApiError('La huella del archivo no coincide con la evidencia.',503);downloadBlob(blob,'evidencia-rat-v'+file.numero+'.pdf');}catch(e){setError(e);}}
  return <Panel title="Referencia exacta conservada" action={<button onClick={onClose}>Cerrar referencia y volver al RAT</button>}><RemoteStatus remote={remote}/><ErrorBox error={error}/>{remote.data&&!match&&<Notice tone="error">La huella recibida no coincide con la referencia guardada. No se presenta como evidencia válida.</Notice>}{remote.data&&match&&<><p>Versión {ref.version} · huella comprobada frente a la referencia del registro.</p>{type==='evidencias'&&remote.data.contenido?.evidencia&&<SupportRead support={remote.data.contenido.evidencia.soporte} openPDF={openPDF}/>}<JsonDetail value={remote.data} label="Consultar contenido de esta versión exacta"/></>}</Panel>;
}
