import React, { useState } from 'react';
import { queryString } from '../api-client';
import { ErrorBox, Field, JsonDetail, Notice, Panel, RemoteStatus, useDirty, useRemote, useWriter, WriteStatus, when } from './ui';
import { civilDate } from './normative-view-model';
import { ReferenceSelectionContext, useReferenceGate } from './ReferenceSelection';
export { RecordPicker } from './AsyncRecordPicker';

export function PeriodFields({value,onChange,review=false}) {
  const update = key => e => onChange({...value,[key]:e.target.value});
  // Native date pickers may emit input before change; keep the visible date and draft aligned.
  return <>{review&&<Notice><strong>¿Qué periodo has examinado?</strong><p>Indica las fechas a las que se refieren los hechos y las evidencias que has revisado. La fecha final no está incluida: para examinar un solo día, indica ese día como inicio y el siguiente como final.</p><p>No es una fecha de caducidad ni el plazo para repetir la revisión. La conclusión se conservará para ese periodo; fuera de él no se extenderá automáticamente al presente o al futuro. No puedes valorar hechos futuros.</p></Notice>}<div className="api-grid2"><Field label="Periodo desde"><input type="date" required value={value.desde} onInput={update('desde')} onChange={update('desde')}/></Field><Field label="Periodo hasta (fecha final excluida)" hint="Fechas civiles de España · Europe/Madrid. No se asigna una caducidad automática."><input type="date" required value={value.hasta} onInput={update('hasta')} onChange={update('hasta')}/></Field></div></>;
}
export function Reason({value,onChange,review=false}) {return <Field label="Motivo del registro o cambio"><textarea required maxLength={review?2000:300} value={value} onChange={e=>onChange(e.target.value)}/></Field>;}
export function SaveForm({api,path,data,title,body,onSaved,onRestart,children,disabled=false,submitLabel='Guardar en el servidor',noValidate=false,maxBodyBytes=null}) {
  const writer=useWriter(api,onSaved),[issue,setIssue]=useState(null),[latest,setLatest]=useState(null),[compareError,setCompareError]=useState(null);
  const references=useReferenceGate(), blockedReferences=references.blockers();
  const [changed,setChanged]=useState(false);
  useDirty(changed || writer.busy || writer.uncertain);
  function save(e){e.preventDefault();if(disabled||writer.busy||writer.uncertain||[401,403,409].includes(writer.error?.status))return;try{const outstanding=references.blockers();if(outstanding.length)throw new Error(outstanding.join(' '));const payload=body(),request=data?{...payload,version:data.version}:payload;if(maxBodyBytes&&new Blob([JSON.stringify(request)]).size>maxBodyBytes)throw new Error('El contenido supera el límite de '+Math.floor(maxBodyBytes/1024)+' KiB. El borrador sigue aquí: resume los textos conservando los hechos y las evidencias antes de volver a guardar.');setIssue(null);writer.run(data?'PATCH':'POST',path,request);}catch(err){setIssue(err);}}
  return <Panel title={title}><ReferenceSelectionContext.Provider value={references.context}><form noValidate={noValidate} onSubmit={save} onChangeCapture={()=>setChanged(true)} onInputCapture={()=>setChanged(true)} onClickCapture={event=>{ if(event.target.closest('button[type="button"]')) setChanged(true); }}><fieldset disabled={writer.busy||writer.uncertain||[401,403].includes(writer.error?.status)}>{children}{!!blockedReferences.length&&<Notice tone="warning"><strong>Antes de guardar</strong><ul>{blockedReferences.map(message=><li key={message}>{message}</li>)}</ul></Notice>}<button className="api-primary" disabled={disabled||!!blockedReferences.length||writer.error?.status===409}>{writer.busy?'Guardando…':submitLabel}</button></fieldset></form></ReferenceSelectionContext.Provider><ErrorBox error={issue}/><WriteStatus writer={writer}/>
    {writer.error?.status===413&&<Notice tone="warning">El servidor ha rechazado el tamaño del envío. El borrador sigue aquí; resume los textos conservando los hechos y las evidencias antes de volver a guardar.</Notice>}
    {writer.error?.status===409&&<section className="api-conflict"><h3>Tu borrador sigue aquí</h3><p>La base, la versión o el estado ha cambiado. No se repetirá el envío con una versión distinta automáticamente.</p>{data&&<><button type="button" onClick={async()=>{try{setLatest(await api.get(path));setCompareError(null);}catch(e){setCompareError(e);}}}>Consultar versión actual para comparar</button><ErrorBox error={compareError}/>{latest&&<><JsonDetail value={latest} label="Comparar con los datos actuales del servidor"/><button type="button" onClick={()=>{if(window.confirm('Se descartará este borrador y se abrirá la versión consultada. ¿Continuar?'))onRestart(latest);}}>Reabrir la versión actual y descartar este borrador</button></>}</>}<p>Si el conflicto afecta al alcance u otra referencia, vuelve a consultarla y prepara un nuevo registro tras revisar los cambios.</p></section>}
  </Panel>;
}
export function RecordVersions({api,path,onSelect}) {
  const [before,setBefore]=useState(null);const remote=useRemote(api,path+'/versiones'+queryString({limite:10,antes:before}));
  return <Panel title="Versiones conservadas"><RemoteStatus remote={remote}/>{remote.data?.versiones.map(v=><div className="api-row" key={v.version}><div><strong>Versión {v.version}</strong><small>{when(v.registradoEn)} · {v.motivo}</small></div><button onClick={()=>onSelect(v.version)}>Consultar versión {v.version}</button></div>)}<div className="api-actions">{before&&<button onClick={()=>setBefore(null)}>Versiones más recientes</button>}{remote.data?.paginacion?.hayMas&&<button onClick={()=>setBefore(remote.data.paginacion.siguienteAntes)}>Versiones anteriores</button>}</div></Panel>;
}
export function CurrentStatus({dto}) {
  const state=dto.estadoRevision;
  if(!state)return null;
  const labels={favorable:'Revisión favorable',desfavorable:'Revisión desfavorable',no_determinado:'Valoración no determinada',sin_revisar:'Sin revisión',requiere_revision:'Requiere nueva revisión',fuera_del_periodo_revisado:'Fuera del periodo revisado'};
  const coverage=state.coberturaPeriodo;
  const label=dto.contenido?.revision?'Estado de esta revisión frente a las bases actuales':`Estado consultado de la versión actual ${state.seRefiereAVersionActual || dto.versionActual}`;
  const outside=coverage?.cubreFechaConsulta===false || state.avisosCobertura?.includes('fecha_consulta_fuera_del_periodo_revisado');
  return <Notice tone={state.requiereRevision?'warning':'info'}><strong>{label}: {labels[state.satisfaccionActual] || state.satisfaccionActual}</strong>
    <p><strong>Conclusión histórica: {labels[state.conclusionHistorica] || state.conclusionHistorica || 'No consta revisión'}.</strong> El resultado guardado no se modifica al cambiar la fecha de consulta.</p>
    {coverage&&<p><strong>Periodo examinado:</strong> {civilDate(coverage.periodo?.desde)} → {civilDate(coverage.periodo?.hasta)} (final excluido). Fecha civil de consulta: {civilDate(coverage.fechaCivilConsulta)} · {coverage.periodo?.zonaEvaluacion || 'zona no informada'}.</p>}
    {outside?<section aria-label="Cobertura de la consulta"><strong>La consulta queda fuera del periodo revisado.</strong><p>No significa incumplimiento ni caducidad automática. El cambio de día no exige por sí solo repetir la revisión, pero la conclusión histórica tampoco acredita una fecha que no se examinó.</p></section>:coverage?.cubreFechaConsulta===true&&<p>La consulta está dentro del periodo revisado.</p>}
    {state.requiereRevision&&<section aria-label="Motivos para revisar"><strong>Hay causas adicionales que requieren revisión.</strong><p>Consulta los motivos antes de utilizar esta conclusión como valoración actual; no se debe únicamente a quedar fuera del periodo examinado.</p>{!!state.motivos?.length&&<ul>{state.motivos.map(m=><li key={m}>{m.replaceAll('_',' ')}</li>)}</ul>}</section>}
    <p>Una revisión se limita a su periodo y objeto. No es certificación ni conformidad global, ni una garantía actual indefinida.</p></Notice>;
}
