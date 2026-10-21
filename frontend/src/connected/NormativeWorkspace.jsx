import { usePracticeRemote } from './learning-guide/Practice';
import React, { useEffect, useRef, useState } from 'react';
import { ApiError, downloadBlob, queryString, resourceId } from '../api-client';
import { confirmLeave } from './draft-state';
import { ErrorBox, Notice, Panel, JsonDetail, RemoteStatus, useRemote, when } from './ui';
import { CurrentStatus, RecordVersions } from './NormativeControls';
import { SystemEditor, RequirementEditor, ActionEditor, EvidenceEditor, ReviewEditor, OperationFactsEditor, requirementObjectPath } from './NormativeEditors';
import DPUnitEditor from './DPUnitEditor';
import { CaseEditorHost } from './DPCaseWorkspace';
import { isRightsType } from './dp-case-model';
import { isUnitType, unitPath, validateUnitContract } from './dp-unit-model';
import { canReview, isCurrent, normativePath, recordLabel, RESOURCES, RESULTS, viewProps } from './normative-api-model';
import { civilDate, sourceUrl } from './normative-view-model';
import NormativeRecordView from './NormativeRecordView';
import { SubjectEditor, DesignationEditor } from './FunctionalEditors';
import { DesignationRead, SupportRead } from './NormativeSupports';
import './normative-workspace.css';
import './ens-functional.css';
import ActionList from './ActionList';
import EnsCategorization from './EnsCategorization';
import useTaskArrival from '../product/useTaskArrival';

export default function NormativeWorkspace({api,base,onNavigate,initialKind='requisitos',initialId=null,workOnly=false}) {
  const catalogue=useRemote(api,base+'/normativa/catalogo');
  const [kind,setKind]=useState(initialKind),[selected,setSelected]=useState(initialId),[creating,setCreating]=useState(false),[tick,setTick]=useState(0);
  const [origins,setOrigins]=useState([]),[actionViews,setActionViews]=useState({});
  const lists={actionViews,onActionView:(key,value)=>setActionViews(old=>({...old,[key]:value}))};
  const heading=useRef(null);
  function open(next,id=null){if(!confirmLeave())return;if(workOnly&&next!=='actuaciones'){onNavigate?.('regulations',{kind:next,id});return;}setOrigins(old=>id?[...old,{kind,selected}]:[]);setKind(next);setSelected(id);setCreating(false);setTick(n=>n+1);}
  function back(){if(!confirmLeave())return;const previous=origins[origins.length-1];setOrigins(old=>old.slice(0,-1));setKind(previous?.kind||kind);setSelected(previous?.selected||null);setCreating(false);setTick(n=>n+1);}
  useEffect(()=>{if(kind!=='actuaciones'||!selected)heading.current?.focus({preventScroll:true});},[kind,selected,creating]);
  const packages=catalogue.data?.paquetes||[];
  return <div className="norm-workspace"><p className="api-intro" ref={heading} tabIndex={-1}>Vincula requisitos concretos a un sistema u operación de tu alcance. Organiza las actuaciones, conserva la evidencia exacta y registra una revisión motivada.</p><Notice>La cobertura disponible es la que declara cada ficha: no cubre todas las obligaciones de la empresa. Los criterios no se cuentan como requisitos distintos y no se calcula un porcentaje de cumplimiento.</Notice>
    <RemoteStatus remote={catalogue}/>{catalogue.error&&<button onClick={catalogue.refresh}>Reintentar catálogo</button>}
    {catalogue.data&&<>{!workOnly&&<nav className="api-tabs" aria-label="Gestión normativa"><button aria-pressed={kind==='catalogo'} onClick={()=>open('catalogo')}>Catálogo y fuentes</button>{Object.entries(RESOURCES).map(([id,label])=><button key={id} aria-pressed={id===kind} onClick={()=>open(id)}>{label}</button>)}</nav>}
      {kind==='catalogo'?<Catalogue packages={packages} aviso={catalogue.data.aviso} onCreate={()=>{if(confirmLeave()){setKind('requisitos');setCreating(true);}}} allowed={catalogue.data.permisos?.contextualizar===true}/>:
      creating?<><button className="api-back" onClick={()=>open(kind)}>← Volver al listado</button><EditorHost api={api} base={base} kind={kind} packages={packages} onSaved={dto=>{setCreating(false);setSelected(dto.id);setTick(n=>n+1);}}/></>:
      selected?<RecordDetail key={kind+selected+tick} api={api} base={base} kind={kind} id={selected} packages={packages} onOpen={open} onBack={back} backToOrigin={!!origins[origins.length-1]?.selected} onNavigate={onNavigate} {...lists}/>:
      <RecordList key={kind+tick} api={api} base={base} kind={kind} onOpen={id=>open(kind,id)} onCreate={()=>{if(confirmLeave())setCreating(true);}} {...lists}/>}
    </>}
  </div>;
}
function Catalogue({packages,aviso,onCreate,allowed}) {return <><p>{aviso}</p>{!packages.length&&<Notice>No hay fichas publicadas en esta consulta. Esto no demuestra ausencia de obligaciones.</Notice>}{packages.map(p=><Panel key={p.ficha.id} title={p.ficha.titulo}><p>{p.ficha.explicacion}</p><p className="norm-reference">Ficha v{p.ficha.version} · regla v{p.regla.version} · {p.ficha.criterios.length} criterios de un único requisito</p><ul>{p.ficha.limites.map(l=><li key={l}>{l}</li>)}</ul><ul>{p.ficha.fuentes.map(s=><li key={s.id}>{s.titulo} · {s.localizador}{sourceUrl(s.url)&&<> · <a href={sourceUrl(s.url)} target="_blank" rel="noreferrer">Fuente oficial</a></>}</li>)}</ul><p>{p.aviso}</p><details><summary>Contenido y trazabilidad completos de la ficha</summary><NormativeRecordView ficha={p.ficha}/></details></Panel>)}{allowed&&packages.length>0&&<button className="api-primary" onClick={onCreate}>Contextualizar un requisito</button>}</>;}
function RecordList({api,base,kind,onOpen,onCreate,filter={},actionViews={},onActionView}) {
  const [before,setBefore]=useState(null);const remote=useRemote(api,normativePath(base,kind)+queryString({limite:20,antes:before,...filter}));
  if(kind==='actuaciones') return <ActionList api={api} base={base} onOpen={onOpen} onCreate={onCreate} filter={filter} view={actionViews[JSON.stringify(filter)]} onViewChange={onActionView?(value)=>onActionView(JSON.stringify(filter),value):undefined}/>;
  return <Panel title={RESOURCES[kind]} action={kind!=='revisiones'&&onCreate&&<button className="api-primary" onClick={onCreate}>{({requisitos:'Contextualizar requisito',sistemas:'Describir sistema',actuaciones:'Crear actuación',evidencias:'Registrar evidencia','sujetos-funcionales':'Registrar persona o unidad',designaciones:'Documentar designación'})[kind]}</button>}><RemoteStatus remote={remote}/>{remote.data?.registros.length===0&&<p>No hay registros en esta página. No se deduce ningún resultado de cumplimiento.</p>}{remote.data?.registros.map(r=><div className="api-row norm-record-row" key={r.id}><div><strong>{recordLabel(r)}</strong><small>Versión {r.version} · {when(r.revision.registradoEn)}</small>{r.contenido?.estado&&<span className="api-tag">{r.contenido.estado.replaceAll('_',' ')}</span>}{r.contenido?.requisito&&<p>{({sistema:'Sistema',operacion:'Operación',finalidad_tratamiento:'Finalidad de tratamiento',flujo_transferencia:'Flujo de transferencia',unidad_informativa:'Información de privacidad',solicitud_derechos:'Solicitud de derechos',pretension_derecho:'Petición de derechos'})[r.contenido.objeto.tipo]||r.contenido.objeto.tipo.replaceAll('_',' ')} · {r.contenido.objeto.id}</p>}{r.estadoRevision&&<p>{RESULTS[r.estadoRevision.satisfaccionActual]||r.estadoRevision.satisfaccionActual}</p>}</div><button onClick={()=>onOpen(r.id)}>Abrir registro</button></div>)}<div className="api-actions"><button onClick={remote.refresh}>Actualizar registros</button>{before&&<button onClick={()=>setBefore(null)}>Registros más recientes</button>}{remote.data?.paginacion?.hayMas&&<button onClick={()=>setBefore(remote.data.paginacion.siguienteAntes)}>Registros anteriores</button>}</div></Panel>;
}
function RecordDetail({api,base,kind,id,packages,onOpen,onBack,onNavigate,backToOrigin,actionViews,onActionView}) {
  const [categorization,setCategorization]=useState(false);
  const [version,setVersion]=useState(undefined),[edit,setEdit]=useState(false),[review,setReview]=useState(false),[facts,setFacts]=useState(false),[downloadError,setDownloadError]=useState(null);
  const path=normativePath(base,kind,id),remote=usePracticeRemote(api,normativePath(base,kind,id,version),kind==='actuaciones'?'task':null,base,null,true),dto=remote.data;
  const arrival=useTaskArrival(id,kind==='actuaciones',!!dto&&!remote.loading&&!remote.error&&dto.id===id);
  async function openPDF(ref){try{setDownloadError(null);const blob=await api.download(base+'/documentos/'+resourceId(ref.documentoId)+'/versiones/'+ref.numero+'/archivo');const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==ref.sha256)throw new ApiError('El archivo recibido no coincide con la huella de esta evidencia. No se descargará.',503);downloadBlob(blob,'evidencia-version-'+ref.numero+'.pdf');}catch(e){setDownloadError(e);}}
  function saved(){setEdit(false);setReview(false);setFacts(false);setVersion(undefined);remote.refresh();}
  if(categorization&&dto&&kind==='sistemas')return <EnsCategorization api={api} base={base} system={dto} onBack={()=>setCategorization(false)}/>;
  return <><button className="api-back" onClick={onBack}>{backToOrigin?'← Volver al origen':'← Volver a '+RESOURCES[kind].toLowerCase()}</button><RemoteStatus remote={remote}/><ErrorBox error={downloadError}/>{remote.error&&<><p>No se ha podido abrir el destino solicitado. Puede que ya no esté disponible o que no tengas acceso. No se ha seleccionado otra tarea.</p><button onClick={remote.refresh}>Reintentar registro</button></>}{dto&&<><header className="api-subheading" ref={arrival.target} tabIndex={-1} aria-label={kind==='actuaciones'?'Tarea: '+recordLabel(dto):undefined} data-task-arrival={kind==='actuaciones'?String(arrival.active):undefined} data-task-id={kind==='actuaciones'?id:undefined}>{arrival.active&&<span className="task-arrival-label" role="status">Tarea localizada</span>}<h2>{recordLabel(dto)}</h2><span className="api-tag">Versión consultada {dto.version} · versión actual {dto.versionActual}</span><p>{when(dto.revision.registradoEn)} · {dto.revision.motivo}</p></header>{!isCurrent(dto)&&<Notice tone="warning">Estás leyendo una instantánea histórica, no un recálculo ni una restauración. Los avisos sobre la versión actual aparecen separados.</Notice>}
    <div className="api-actions">{dto.permisos?.actualizar===true&&isCurrent(dto)&&!edit&&!review&&!facts&&<button onClick={()=>setEdit(true)}>{kind==='requisitos'?'Actualizar contextualización':'Editar este registro'}</button>}{kind==='requisitos'&&!edit&&!review&&!facts&&<><button className="api-primary" disabled={!canReview(dto)} onClick={()=>setReview(true)}>Registrar revisión interna</button>{isCurrent(dto)&&dto.permisos?.actualizar===true&&<button onClick={()=>setFacts(true)}>Aclarar datos del requisito</button>}</>}<button onClick={()=>{if(confirmLeave()){setEdit(false);setReview(false);setFacts(false);setVersion(undefined);remote.refresh();}}}>Consultar versión actual</button>{(edit||review||facts)&&<button onClick={()=>{if(confirmLeave()){setEdit(false);setReview(false);setFacts(false);}}}>Cerrar editor</button>}</div>
    {edit?<EditorHost key={dto.version} api={api} base={base} kind={kind} data={dto} packages={packages} onSaved={saved} onRestarted={remote.adopt}/>:
    review?<ReviewEditor api={api} base={base} requirement={dto} onSaved={saved}/>:
    facts?<RequirementQuestionHost api={api} base={base} requirement={dto} onSaved={saved}/>:
    <><CurrentStatus dto={dto}/>{dto.vigencia?.requiereRevision&&<Notice tone="warning">Las bases de este registro necesitan revisión: {dto.vigencia.motivos.join(', ')}.</Notice>}
      {kind==='requisitos'?<><p className="norm-reference">Alcance {dto.contenido.requisito.alcance.id} · v{dto.contenido.requisito.alcance.version} · {dto.contenido.objeto.tipo} {dto.contenido.objeto.id} · v{dto.contenido.objeto.version}</p>{!canReview(dto)&&<Notice>La revisión necesita permiso administrativo, versión actual y fundamentos evaluables y actualizados. Consulta los estados y las cuestiones pendientes; el servidor vuelve a validar cada envío.</Notice>}<NormativeRecordView {...viewProps(dto)} onOpenDocumentVersion={openPDF}/><details><summary>Motivos y datos de la decisión reproducible</summary><JsonDetail value={dto.contenido.requisito.resultado} label="Consultar decisión y snapshot"/></details><RecordList api={api} base={base} kind="actuaciones" filter={{requisitoId:id}} onOpen={r=>onOpen('actuaciones',r)} actionViews={actionViews} onActionView={onActionView}/><RecordList api={api} base={base} kind="revisiones" filter={{requisitoId:id}} onOpen={r=>onOpen('revisiones',r)}/></>:
      kind==='revisiones'?<ReviewRead api={api} base={base} dto={dto} openPDF={openPDF}/>:
      kind==='evidencias'?<EvidenceRead dto={dto} openPDF={openPDF}/>:
      kind==='designaciones'?<DesignationRead designation={dto.contenido.designacion} openPDF={openPDF}/>:
      kind==='sujetos-funcionales'?<><h3>{dto.contenido.sujeto.tipo==='persona'?'Persona':'Unidad organizativa'}</h3><p>{dto.contenido.sujeto.procedenciaOrganizativa}</p><p>{dto.contenido.sujeto.membresiaId?'Cuenta vinculada: '+dto.contenido.sujeto.membresiaId:'Sin cuenta vinculada'}</p><Notice>Este registro no concede permisos ni prueba, por sí solo, una designación o el ejercicio de una función.</Notice></>:
      kind==='actuaciones'?<div ref={remote.practiceRef}><p>{dto.contenido.descripcion}</p><p>Estado: {dto.contenido.estado.replaceAll('_',' ')} · responsable {dto.contenido.responsableMembresiaId}</p><Notice>Esta actuación no modifica la satisfacción de los requisitos.</Notice><h3>Requisitos vinculados</h3>{dto.contenido.relaciones.map(r=><div className="api-row" key={r.requisitoId}><p>Requisito {r.requisitoId} · v{r.versionRequisito}</p><button onClick={()=>onOpen('requisitos',r.requisitoId)}>Abrir requisito actual</button></div>)}</div>:
      <><p>{dto.contenido.descripcion}</p><p>Alcance {dto.contenido.alcance.id} · v{dto.contenido.alcance.version}</p><JsonDetail value={dto.contenido.hechos} label="Datos declarados de este sistema"/>{kind==='sistemas'&&<button className="api-primary" onClick={()=>setCategorization(true)}>Consultar categorización ENS del sistema</button>}</>}
      <RecordVersions api={api} path={path} onSelect={setVersion}/><JsonDetail value={{referencia:dto.referencia,revision:dto.revision,permisos:dto.permisos,horaServidor:dto.horaServidor}} label="Identidad, versión, huella y autor del registro"/>
    </>}
  </>}{onNavigate&&<div className="api-actions"><button onClick={()=>onNavigate('profile')}>Ir a Perfil y alcance</button><button onClick={()=>onNavigate('documents')}>Ir a Documentación</button></div>}</>;
}
function ReviewRead({api,base,dto,openPDF}) {
  const review=dto.contenido.revision,req=useRemote(api,normativePath(base,'requisitos',review.requisito.id,review.requisito.version));
  return <><Notice>Revisión interna conservada: <strong>{RESULTS[review.conclusion]}</strong>. Periodo {civilDate(review.periodo.desde)} → {civilDate(review.periodo.hasta)} (final excluido).<p>Revisor: {review.revisor.usuarioId} · membresía {review.revisor.membresiaId} · {when(review.fechaRevision)}.</p></Notice><RemoteStatus remote={req}/>{req.data&&<NormativeRecordView {...viewProps(req.data,dto)} revisionStatus={null} onOpenDocumentVersion={openPDF}/>}</>;
}
function EvidenceRead({dto,openPDF}) {const e=dto.contenido.evidencia;return <Panel title="Evidencia consultada"><p>{e.procedencia}</p><p>Localizador: {e.localizador}</p><p>Tipo: {e.tipo.replaceAll('_',' ')} · alcance: {e.alcanceIds.join(', ')}</p><p>Periodo {civilDate(e.periodo.desde)} → {civilDate(e.periodo.hasta)} (final excluido)</p><SupportRead support={e.soporte} openPDF={openPDF}/></Panel>;}
function EditorHost({api,base,kind,data,packages,onSaved,onRestarted}) {
  const [current,setCurrent]=useState(data),[generation,setGeneration]=useState(0),[refs,setRefs]=useState(null),[error,setError]=useState(null);
  // Resolving old relation versions preserves them until the user explicitly chooses a newer requirement.
  useEffect(()=>{let active=true;setRefs(null);setError(null);if(kind==='actuaciones'&&current){Promise.all(current.contenido.relaciones.map(r=>api.get(normativePath(base,'requisitos',r.requisitoId,r.versionRequisito)))).then(rows=>active&&setRefs(rows),e=>active&&setError(e));}else setRefs([]);return()=>{active=false;};},[api,base,kind,current]);
  const [membersBefore,setMembersBefore]=useState(null),[members,setMembers]=useState([]);
  const responsibles=useRemote(api,['actuaciones','sujetos-funcionales'].includes(kind)?base+'/normativa/responsables'+queryString({limite:20,antes:membersBefore}):null);
  useEffect(()=>{if(responsibles.data)setMembers(old=>[...new Map([...old,...responsibles.data.responsables.map(m=>({...m,id:m.membresiaId}))].map(m=>[m.id,m])).values()]);},[responsibles.data]);
  function restart(dto){setCurrent(dto);setGeneration(n=>n+1);onRestarted?.(dto);}
  const props={api,base,packages,data:current,onSaved,onRestart:restart};
  if(error)return <ErrorBox error={error}/>;
  if(['actuaciones','sujetos-funcionales'].includes(kind)&&(!refs||(!members.length&&responsibles.loading)||responsibles.error))return <><RemoteStatus remote={responsibles}/>{responsibles.error&&<button onClick={responsibles.refresh}>Reintentar responsables</button>}{!refs&&<p>Consultando las versiones de los requisitos vinculados…</p>}</>;
  return <div key={generation}>{kind==='sistemas'?<SystemEditor {...props}/>:kind==='requisitos'?<RequirementEditor {...props}/>:kind==='actuaciones'?<><ActionEditor {...props} initialRequirements={refs} responsibles={members}/>{responsibles.data?.paginacion?.hayMas&&<button onClick={()=>setMembersBefore(responsibles.data.paginacion.siguienteAntes)}>Cargar más responsables</button>}</>:kind==='evidencias'?<EvidenceEditor {...props}/>:kind==='designaciones'?<DesignationEditor {...props}/>:kind==='sujetos-funcionales'?<><SubjectEditor {...props} responsibles={members}/>{responsibles.data?.paginacion?.hayMas&&<button onClick={()=>setMembersBefore(responsibles.data.paginacion.siguienteAntes)}>Cargar más cuentas existentes</button>}</>:null}</div>;
}
function RequirementQuestionHost({api,base,requirement,onSaved}) {
  const c=requirement.contenido,type=c.objeto.tipo;
  const path=requirementObjectPath(base,type,c.objeto.id),remote=useRemote(api,path);
  const [revision,setRevision]=useState(null),[updated,setUpdated]=useState(false);
  const obj=revision||remote.data,fields=[...new Map([...c.paquete.regla.hechos,...(c.paquete.ficha.satisfaccion?.hechos||[])].map(f=>[f.clave,f])).values()];
  if(updated)return <Notice tone="warning"><strong>Datos guardados. El requisito conserva su contextualización anterior.</strong><p>Vuelve al requisito, consulta sus avisos y pulsa «Actualizar contextualización». Revisa las nuevas bases antes de registrar otra revisión.</p><button onClick={onSaved}>Volver al requisito y revisar sus bases</button></Notice>;
  if(!path)return <Notice>Este objeto requiere su itinerario específico. No se editará como si fuera una operación.</Notice>;
  return <><RemoteStatus remote={remote}/>{remote.error&&<button onClick={remote.refresh}>Reintentar datos del objeto</button>}{obj&&(isRightsType(type)?<CaseEditorHost key={obj.version} api={api} base={base} type={type} data={obj} onSaved={()=>setUpdated(true)} onRestart={setRevision}/>:isUnitType(type)?<UnitQuestionEditor key={obj.version} api={api} base={base} data={obj} onSaved={()=>setUpdated(true)} onRestart={setRevision}/>:type==='sistema'?<SystemEditor key={obj.version} api={api} base={base} data={obj} packages={[c.paquete]} questionFields={fields} onSaved={()=>setUpdated(true)} onRestart={setRevision}/>:<OperationFactsEditor key={obj.contexto.version} api={api} base={base} operation={obj} fields={fields} onSaved={()=>setUpdated(true)} onRestart={setRevision}/>)}</>;
}
function UnitQuestionEditor(props){
  const remote=useRemote(props.api,unitPath(props.base)+'/contrato');
  let contract=null,issue=null;if(remote.data){try{contract=validateUnitContract(remote.data.contrato);}catch(e){issue=e;}}
  return <><RemoteStatus remote={remote}/>{issue&&<Notice tone="error">{issue.message}</Notice>}{remote.error&&<button onClick={remote.refresh}>Reintentar contrato de unidades</button>}{contract&&remote.data.permisos?.actualizar===true&&<DPUnitEditor {...props} contract={contract}/>}</>;
}
