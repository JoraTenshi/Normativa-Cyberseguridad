import React, { useState } from 'react';
import { ApiError, cleanFact, resourceId } from '../api-client';
import { Field, Notice, RemoteStatus, useRemote } from './ui';
import { RecordPicker, Reason, SaveForm } from './NormativeControls';
import { answerFact, exactRef, normativePath, publicFacts, recordLabel, scopeRef } from './normative-api-model';

const scopeSelection=ref=>({id:ref.id,nombre:'Alcance vinculado '+ref.id,revision:{numero:ref.version,sha256:ref.sha256}});
function requireScope(scopes) {if(!scopes.length)throw new ApiError('Selecciona al menos un alcance.',400);return scopes.map(scopeRef);}
function scopeReady(s){return !!s && s.vigencia?.necesitaRevision !== true;}
export function FactQuestions({fields,facts,onChange}) {
  const groups=[...new Set(fields.map(f=>f.pregunta.grupo))];
  return <>{groups.map(group=><details className="norm-question-group" key={group} open><summary>{group}</summary>{fields.filter(f=>f.pregunta.grupo===group).map(f=>{const fact=facts.find(v=>v.clave===f.clave);const value=fact?.estado==='conocido'?(fact.valor?'yes':'no'):fact?.estado==='conflictivo'?'conflict':'unknown';return <div className="api-question" key={f.clave}><Field label={f.pregunta.texto}><select value={value} onChange={e=>onChange(answerFact(facts,f.clave,e.target.value))}><option value="unknown">No lo sé todavía</option><option value="yes">Sí, según los datos disponibles</option><option value="no">No, según los datos disponibles</option><option value="conflict">Hay información contradictoria</option></select></Field><p className="api-why">{f.pregunta.motivo}</p></div>;})}</details>)}</>;
}
export function SystemEditor({api,base,packages,data,onSaved,onRestart,questionFields}) {
  const c=data?.contenido;const [name,setName]=useState(c?.nombre||''),[description,setDescription]=useState(c?.descripcion||''),[scopes,setScopes]=useState(c?[scopeSelection(c.alcance)]:[]),[facts,setFacts]=useState(publicFacts(c?.hechos)),[reason,setReason]=useState('');
  const fields=questionFields||[...new Map(packages.filter(p=>p.regla.tiposObjeto.includes('sistema')).flatMap(p=>p.regla.hechos).map(f=>[f.clave,f])).values()];
  return <SaveForm api={api} data={data} path={normativePath(base,'sistemas',data?.id)} title={data?'Editar el sistema delimitado':'Describir un sistema'} onSaved={onSaved} onRestart={onRestart} disabled={!scopeReady(scopes[0])} body={()=>({nombre:name,descripcion:description,alcance:requireScope(scopes)[0],hechos:publicFacts(facts),motivo:reason})}>
    <Notice>Responde por este sistema, no por toda la empresa. Lo desconocido se conserva como pendiente. Los datos no se heredan de otros sistemas.</Notice><Field label="Nombre del sistema"><input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="Qué incluye el sistema"><textarea required maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></Field><RecordPicker api={api} kind="alcances" path={base+'/alcances'} label="Alcance del sistema" selected={scopes} onChange={setScopes}/>{scopes[0]?.vigencia?.necesitaRevision&&<Notice tone="warning">Este alcance necesita revisión en Perfil y alcance antes de guardar.</Notice>}<FactQuestions fields={fields} facts={facts} onChange={setFacts}/><Reason value={reason} onChange={setReason}/>
  </SaveForm>;
}
export function RequirementEditor({api,base,packages,data,onSaved,onRestart}) {
  const c=data?.contenido, old=c?.requisito;
  const [packageId,setPackageId]=useState(old?.ficha.id||''),[scopes,setScopes]=useState([]),[objects,setObjects]=useState([]),[reason,setReason]=useState('');
  const pack=packages.find(p=>p.ficha.id===packageId),type=pack?.regla.tiposObjeto[0];
  const currentScope=useRemote(api,old?base+'/alcances/'+resourceId(old.alcance.id):null);
  const currentObject=useRemote(api,c?(c.objeto.tipo==='sistema'?normativePath(base,'sistemas',c.objeto.id):base+'/operaciones/'+resourceId(c.objeto.id)):null);
  const scope=data?currentScope.data:scopes[0],obj=data?currentObject.data:objects[0];
  const objectsPath=type==='sistema'?normativePath(base,'sistemas'):base+'/operaciones';
  function body(){if(!pack||!scope||!obj)throw new ApiError('Selecciona ficha, alcance y objeto.',400);return {alcance:scopeRef(scope),objeto:{tipo:type,id:obj.id||obj.operacion.id,version:type==='sistema'?obj.version:obj.contexto.version},ficha:{id:pack.ficha.id,version:pack.ficha.version},motivo:reason};}
  return <SaveForm api={api} path={normativePath(base,'requisitos',data?.id)} data={data} title={data?'Actualizar la contextualización':'Vincular un requisito a tu actividad'} onSaved={onSaved} onRestart={onRestart} body={body} disabled={!pack||!scopeReady(scope)||!obj}>
    <Field label="Ficha publicada"><select required disabled={!!data} value={packageId} onChange={e=>{setPackageId(e.target.value);setObjects([]);}}><option value="">Selecciona un requisito concreto…</option>{packages.map(p=><option key={p.ficha.id} value={p.ficha.id}>{p.ficha.titulo} · v{p.ficha.version}</option>)}</select></Field>{pack&&<p>{pack.ficha.explicacion}</p>}
    {data?<><RemoteStatus remote={currentScope}/><RemoteStatus remote={currentObject}/><Notice>Se conservará la identidad del expediente. Al guardar, el servidor calculará una nueva versión con la ficha y las bases consultadas; no modificará el resultado anterior.</Notice><p>Alcance: v{old.alcance.version} → v{scope?.revision.numero||'pendiente'} · {scope?.contenido.alcance.nombre}</p><p>{c.objeto.tipo}: v{c.objeto.version} → v{obj?.version||obj?.contexto?.version||'pendiente'} · {obj&&recordLabel(obj)}</p></>:
      <><RecordPicker api={api} path={base+'/alcances'} kind="alcances" label="Alcance" selected={scopes} onChange={v=>{setScopes(v);setObjects([]);}}/>{scope&&pack&&<RecordPicker key={scope.id+type} api={api} path={objectsPath} kind={type==='sistema'?'sistemas':'operaciones'} label={type==='sistema'?'Sistema del alcance':'Operación del alcance'} selected={objects} onChange={setObjects} accept={r=>type==='sistema'?r.contenido?.alcance?.id===scope.id:scope.contenido.origen.operaciones.some(o=>o.id===r.id)}/>}</>}
    {scope?.vigencia?.necesitaRevision&&<Notice tone="warning">El alcance está desactualizado respecto de su contexto u operaciones. Revísalo antes de contextualizar.</Notice>}<Reason value={reason} onChange={setReason}/>
  </SaveForm>;
}
export function ActionEditor({api,base,data,initialRequirements=[],responsibles,onSaved,onRestart}) {
  const c=data?.contenido;const [title,setTitle]=useState(c?.titulo||''),[description,setDescription]=useState(c?.descripcion||''),[state,setState]=useState(c?.estado||'pendiente'),[requirements,setRequirements]=useState(initialRequirements),[responsible,setResponsible]=useState(c?.responsableMembresiaId||''),[reason,setReason]=useState('');
  return <SaveForm api={api} path={normativePath(base,'actuaciones',data?.id)} data={data} title={data?'Editar actuación':'Organizar una actuación compartida'} onSaved={onSaved} onRestart={onRestart} disabled={!requirements.length||!responsible} body={()=>({titulo:title,descripcion:description,estado:state,requisitos:requirements.map(exactRef),responsableMembresiaId:responsible,motivo:reason})}>
    <Notice>Puede atender varios requisitos. Marcarla como terminada o archivarla no aprueba ninguno de ellos. La responsabilidad no concede permisos de edición.</Notice><Field label="Actuación"><input required maxLength={300} value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="Trabajo que se va a realizar"><textarea required maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)}/></Field><div className="api-grid2"><Field label="Estado de la actuación"><select value={state} onChange={e=>setState(e.target.value)}><option value="pendiente">Pendiente</option><option value="en_curso">En curso</option><option value="terminada">Terminada</option>{['terminada','archivada'].includes(c?.estado)&&<option value="archivada">Archivada</option>}</select></Field><Field label="Responsable"><select required value={responsible} onChange={e=>setResponsible(e.target.value)}><option value="">Selecciona una membresía activa…</option>{responsibles.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}{responsible&&!responsibles.some(m=>m.id===responsible)&&<option value={responsible} disabled>Responsable anterior no disponible · selecciona otro</option>}</select></Field></div><RecordPicker api={api} path={normativePath(base,'requisitos')} kind="requisitos" label="Requisitos relacionados" multiple selected={requirements} onChange={setRequirements}/><Reason value={reason} onChange={setReason}/>
  </SaveForm>;
}
export { default as EvidenceEditor } from './EvidenceEditor';
export { default as ReviewEditor } from './ReviewEditor';
export function OperationFactsEditor({api,base,operation,fields,onSaved,onRestart}) {
  const [facts,setFacts]=useState(publicFacts(operation.contexto.hechos)),[reason,setReason]=useState('');
  const changed=facts.filter(f=>JSON.stringify(f)!==JSON.stringify(operation.contexto.hechos.map(cleanFact).find(x=>x.clave===f.clave)));
  return <SaveForm api={api} path={base+'/operaciones/'+resourceId(operation.operacion.id)} data={{...operation,version:operation.contexto.version}} title={'Aclarar datos de '+operation.operacion.nombre} onSaved={onSaved} onRestart={onRestart} disabled={!changed.length} body={()=>({cambios:changed,motivo:reason})}><Notice>Actualizar la operación puede exigir revisar el alcance y contextualizar de nuevo el requisito. No se cambia automáticamente la decisión anterior.</Notice><FactQuestions fields={fields} facts={facts} onChange={setFacts}/><Reason value={reason} onChange={setReason}/></SaveForm>;
}
