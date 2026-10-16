import React, {useState} from 'react';
import {queryString} from '../api-client';
import {confirmLeave} from './draft-state';
import {JsonDetail, Notice, Panel, RemoteStatus, useRemote, when} from './ui';
import {RecordVersions} from './NormativeControls';
import {isCurrent, RESULTS} from './normative-api-model';
import {categoryPath, DIMENSIONS, LEVELS} from './ens-category-model';
import EnsCategoryEditor from './EnsCategoryEditor';
import {CategoryDecisionHistory, CategoryReviewEditor, DeterminationEditor} from './EnsCategoryDecisions';
import './ens-categorization.css';

const categoryName = value => ({BASICA:'Básica',MEDIA:'Media',ALTA:'Alta'})[value]||'Sin categoría propuesta';
const friendly = value => String(value).replaceAll('_',' ').toLowerCase();
export function CategoryProposal({value,elements=[]}) {
  if(!value)return <Notice tone="warning">El servidor no ha devuelto una propuesta. No se calculará otra en esta pantalla.</Notice>;
  return <section className="ens-proposal" aria-label="Propuesta del servidor"><h3>{value.estado==='PROPUESTA_CALCULADA'?'Propuesta calculada':value.estado==='INCOMPLETO'?'Valoración incompleta':'Sin nivel determinado'}</h3>
    <p className="ens-category-result">{value.estado==='PROPUESTA_CALCULADA'?categoryName(value.categoriaPropuesta):'No hay una propuesta completa'}</p>
    {value.estado==='INCOMPLETO'&&value.categoriaMinimaConocida&&<p>Mínimo conocido: <strong>{categoryName(value.categoriaMinimaConocida)}</strong>. No resuelve las carencias del expediente.</p>}
    <dl className="ens-vector">{Object.entries(DIMENSIONS).map(([key,label])=>{const d=value.dimensiones?.[key];return <div key={key}><dt>{label}</dt><dd>{d?.estado==='INCOMPLETA'?'Pendiente':d?.estado==='NO_AFECTADA'?'No afectada':LEVELS[d?.nivelCalculado]||'Sin dato'}</dd>{d?.estado==='INCOMPLETA'&&d.minimoConocido&&<small>Mínimo conocido: {LEVELS[d.minimoConocido]}</small>}</div>;})}</dl>
    {!!value.carencias?.length&&<><h4>Qué falta aclarar</h4><ul>{value.carencias.map((c,i)=><li key={i}>{friendly(c.tipo)}{c.elemento?' · '+(elements.find(e=>e.id===c.elemento)?.nombre||c.elemento):''}{c.dimension?' · '+DIMENSIONS[c.dimension]:''}</li>)}</ul></>}
    <p>Esta propuesta no es una determinación del responsable de seguridad, una revisión favorable ni una certificación.</p>
  </section>;
}
export function CategoryRead({dto}) {
  const c=dto.contenido.categorizacion,state=dto.estadoCategorizacion;
  return <><CategoryProposal value={c.propuesta} elements={c.inventario.elementos}/>
    {!!c.carenciasDocumentales?.length&&<Notice tone="warning"><strong>La documentación de la valoración está incompleta.</strong><ul>{c.carenciasDocumentales.map((gap,i)=><li key={i}>{friendly(gap.tipo)} · {c.inventario.elementos.find(e=>e.id===gap.elemento)?.nombre||gap.elemento}</li>)}</ul><p>Un cálculo completo no sustituye estas atribuciones y evidencias.</p></Notice>}
    {state&&<Notice><strong>Estado derivado de la versión actual {state.seRefiereAVersionActual}: {RESULTS[state.satisfaccionActual]||friendly(state.satisfaccionActual)}</strong><p>Este estado no sustituye el contenido de la versión consultada. Es seguimiento de las bases registradas, no prueba continua ni certificación.</p>{state.revision&&<p>Finalidad de la última revisión: {state.revision.finalidadRevision==='actual'?'seguimiento actual':'histórica'}. Conclusión conservada: {RESULTS[state.revision.conclusion]}.</p>}{state.avisos?.map((a,i)=><p key={i}>{friendly(a)}</p>)}</Notice>}
    {dto.vigencia?.requiereRevision&&<Notice tone="warning">Hay bases que revisar: {dto.vigencia.motivos.map(friendly).join(' · ')}.</Notice>}
    <h3>Historial del sistema declarado</h3><p>{friendly(c.historialTemporal.estado)} · origen {friendly(c.historialTemporal.origenSistema)}</p><p>{c.historialTemporal.motivo}</p><p>Inicio real: {when(c.historialTemporal.fechaInicio)} · última determinación: {when(c.historialTemporal.ultimaDeterminacionEn)} · última reevaluación: {when(c.historialTemporal.ultimaReevaluacionEn)}.</p><p>Cambios significativos: {friendly(c.historialTemporal.cambiosSignificativos)}. El alta en la aplicación no reinicia los plazos.</p>
    <h3>Inventario conservado en esta versión</h3><p>{c.inventario.delimitacion}</p><p>Exclusiones: {c.inventario.exclusiones}</p><p>Dependencias: {c.inventario.dependencias}</p><p>{c.inventario.completo?'Inventario declarado completo; no es una comprobación de completitud material.':'Inventario pendiente de completar.'}</p>
    {c.inventario.elementos.map(e=><details key={e.id} className="ens-dimension"><summary>{e.nombre} · {e.tipo==='servicio'?'Servicio':'Información'} · versión {e.version}</summary><p>{e.descripcion}</p><p>{e.limitaciones}</p><p>Valorado: {when(e.valoradoEn)} · {e.responsable?'Designación vinculada v'+e.responsable.version:'Responsable pendiente'}</p><dl>{Object.entries(DIMENSIONS).map(([key,label])=><div key={key}><dt>{label}: {LEVELS[e.dimensiones[key].nivel]}</dt><dd>{e.dimensiones[key].motivo}<p>{e.dimensiones[key].criteriosImpacto}</p></dd></div>)}</dl><JsonDetail value={{responsable:e.responsable,evidencias:e.evidencias}} label="Referencias exactas de esta valoración"/></details>)}
    <JsonDetail value={c} label="Trazabilidad completa del expediente consultado"/>
  </>;
}
function CategoryDetail({api,base,system,id,permissions,onBack}) {
  const [version,setVersion]=useState(),[edit,setEdit]=useState(false),[decision,setDecision]=useState(null),[restart,setRestart]=useState(null),[generation,setGeneration]=useState(0);
  const path=categoryPath(base,'categorizaciones-ens',id),remote=useRemote(api,categoryPath(base,'categorizaciones-ens',id,version));
  const dto=remote.data;
  const canEdit=permissions.actualizar===true&&dto?.permisos?.actualizar===true&&isCurrent(dto);
  const canDetermine=dto?.contenido.categorizacion.propuesta.estado==='PROPUESTA_CALCULADA'&&!dto?.contenido.categorizacion.carenciasDocumentales?.length&&dto?.vigencia?.requiereRevision!==true;
  function changeView(fn){if(confirmLeave()){setEdit(false);setDecision(null);setRestart(null);fn();}}
  function saved(){setEdit(false);setDecision(null);setRestart(null);setVersion(undefined);setGeneration(n=>n+1);remote.refresh();}
  return <><button className="api-back" onClick={()=>changeView(onBack)}>← Expedientes del sistema</button><RemoteStatus remote={remote}/>{remote.error&&<button onClick={remote.refresh}>Reintentar expediente</button>}{dto&&<>
    <header className="api-subheading"><h2>Categorización de {system.contenido.nombre}</h2><p>Versión consultada {dto.version} · versión actual {dto.versionActual}</p><p>Registrada: {when(dto.revision.registradoEn)} · {dto.revision.motivo}</p></header>
    {!isCurrent(dto)&&<Notice tone="warning">Estás consultando una versión histórica. No se recalcula ni se restaura al abrirla.</Notice>}
    <div className="api-actions">{!edit&&!decision&&<>{canEdit&&<button onClick={()=>setEdit(true)}>Actualizar inventario y valoraciones</button>}{isCurrent(dto)&&permissions.determinar===true&&dto.permisos?.determinar===true&&<button disabled={!canDetermine} onClick={()=>setDecision('determinar')}>Registrar determinación</button>}{isCurrent(dto)&&permissions.revisar===true&&dto.permisos?.revisar===true&&<button onClick={()=>setDecision('revisar')}>Revisar categorización</button>}</>}{(edit||decision)&&<button onClick={()=>changeView(()=>{})}>Cerrar editor</button>}<button onClick={()=>changeView(()=>{setVersion(undefined);remote.refresh();})}>Consultar expediente actual</button></div>
{edit?<EnsCategoryEditor key={generation} api={api} base={base} system={system} data={restart||dto} onRestart={latest=>{remote.adopt(latest);setRestart(latest);setGeneration(n=>n+1);}} onSaved={saved}/>:decision==='determinar'?<DeterminationEditor api={api} base={base} system={system} categorization={dto} onSaved={saved}/>:decision==='revisar'?<CategoryReviewEditor api={api} base={base} categorization={dto} onSaved={saved}/>:<><CategoryRead dto={dto}/><RecordVersions api={api} path={path} onSelect={setVersion}/><CategoryDecisionHistory key={'d'+generation} api={api} base={base} categoryId={dto.id} kind="determinaciones-ens" title="Determinaciones documentadas"/><CategoryDecisionHistory key={'r'+generation} api={api} base={base} categoryId={dto.id} kind="revisiones-categorizacion-ens" title="Revisiones conservadas"/></>}
  </>}</>;
}
function CategoryList({api,base,system,permissions,onOpen}) {
  const [before,setBefore]=useState(null),[create,setCreate]=useState(false);
  const remote=useRemote(api,categoryPath(base)+queryString({sistemaId:system.id,limite:20,antes:before}));
  if(create)return <><button onClick={()=>{if(confirmLeave())setCreate(false);}}>← Volver a los expedientes</button><EnsCategoryEditor api={api} base={base} system={system} onSaved={dto=>{setCreate(false);onOpen(dto.id);}}/></>;
  return <Panel title="Expedientes de categorización" action={permissions.crear===true&&isCurrent(system)&&remote.data?.registros.length===0&&!before&&!remote.data.paginacion.hayMas&&<button className="api-primary" onClick={()=>setCreate(true)}>Preparar categorización ENS</button>}>
    <RemoteStatus remote={remote}/>{remote.error&&<button onClick={remote.refresh}>Reintentar expedientes</button>}
    {remote.data?.registros.length===0&&<p>No hay expedientes en esta página. Esto no significa que el sistema esté categorizado.</p>}
    {remote.data?.registros.map(dto=><div className="api-row" key={dto.id}><div><strong>Expediente · versión {dto.version}</strong><p>{dto.revision.motivo}</p><small>{when(dto.revision.registradoEn)}</small></div><button onClick={()=>onOpen(dto.id)}>Consultar categorización</button></div>)}
    <div className="api-actions">{before&&<button onClick={()=>setBefore(null)}>Expedientes más recientes</button>}{remote.data?.paginacion.hayMas&&<button onClick={()=>setBefore(remote.data.paginacion.siguienteAntes)}>Expedientes anteriores</button>}</div>
  </Panel>;
}
export default function EnsCategorization({api,base,system,onBack}) {
  const meta=useRemote(api,base+'/normativa/categorizacion-ens/contrato'),[selected,setSelected]=useState(null);
  return <section className="ens-categorization"><button className="api-back" onClick={()=>{if(confirmLeave())onBack();}}>← Volver al sistema</button><h2>Categorización ENS · {system.contenido.nombre}</h2><p>Describe la información y los servicios, valora su impacto y conserva la base de cada decisión.</p>
    <p><a href="https://www.boe.es/buscar/act.php?id=BOE-A-2022-7191" target="_blank" rel="noreferrer">Consultar el ENS en el BOE</a> · artículos 40 y 41 y anexo I. La referencia no supone certificación ni incorpora las guías CCN pendientes de permiso.</p>
    <RemoteStatus remote={meta}/>{meta.error&&<button onClick={meta.refresh}>Reintentar permisos y contrato</button>}
    {meta.data?.permisos.consultar===true&&(selected?<CategoryDetail key={selected} api={api} base={base} system={system} id={selected} permissions={meta.data.permisos} onBack={()=>setSelected(null)}/>:<CategoryList api={api} base={base} system={system} permissions={meta.data.permisos} onOpen={setSelected}/>)}
  </section>;
}
