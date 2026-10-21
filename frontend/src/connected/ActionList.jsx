import { usePracticeTarget } from './learning-guide/Practice';
import React, { useState } from 'react';
import TaskTable from '../workspace/TaskTable';
import { queryString } from '../api-client';
import { Panel, RemoteStatus, useRemote, when } from './ui';
import { normativePath } from './normative-api-model';
import { DEFAULT_FILTERS } from '../workspace/taskSelectors';

// A view of C2 actuaciones, not a synthetic task API. Membership IDs are never
// treated as user IDs; only the responsible directory supplies display names.
export function actionRows(records, responsibles) {
  const names = new Map(responsibles.map(m => [m.membresiaId, m.nombre]));
  return records.filter(r => r.contenido.estado !== 'archivada').map(r => ({
    id:r.id, title:r.contenido.titulo, status:r.contenido.estado,
    owner:names.get(r.contenido.responsableMembresiaId) || 'Responsable fuera de esta página del directorio',
  }));
}
export default function ActionList({api,base,onOpen,onCreate,filter={},view,onViewChange}) {
  const [localView,setLocalView]=useState({before:null,archived:false,filters:DEFAULT_FILTERS});
  const {before,archived,filters} = view || localView;
  const changeView = patch => { const next={...(view || localView),...patch}; if(onViewChange)onViewChange(next);else setLocalView(next); };
  const setBefore=before=>changeView({before}),setArchived=archived=>changeView({archived}),setFilters=filters=>changeView({filters});
  const [memberCursor,setMemberCursor]=useState(null), [knownMembers,setKnownMembers]=useState([]);
  const remote=useRemote(api,normativePath(base,'actuaciones')+queryString({limite:20,antes:before,...filter}));
  const directory=useRemote(api,base+'/normativa/responsables'+queryString({limite:20,antes:memberCursor}));
  const members=[...new Map([...knownMembers,...(directory.data?.responsables||[])].map(m=>[m.membresiaId,m])).values()];
  const records=remote.data?.registros || [], active=actionRows(records,members), history=records.filter(r=>r.contenido.estado==='archivada');
  const practice = usePracticeTarget('task-list',base,!!remote.data&&!remote.loading&&!remote.error,archived?history.length===0:active.length===0);
  return <Panel title="Actuaciones y responsables" action={onCreate&&<button className="api-primary" onClick={onCreate}>Crear actuación</button>}>
    <p>Relaciona el trabajo con sus requisitos y conserva quién lo lleva, su estado y el motivo de cada cambio. Terminar una actuación no equivale a aprobar el requisito.</p>
    <div className="api-tabs" aria-label="Vista de actuaciones"><button aria-pressed={!archived} onClick={()=>setArchived(false)}>Activas</button><button aria-pressed={archived} onClick={()=>setArchived(true)}>Archivadas</button></div>
    <RemoteStatus remote={remote}/><RemoteStatus remote={directory}/>
    {remote.data&&!remote.loading&&!remote.error&&<div ref={practice.root} className="action-list">
      {!archived ? <><div className="action-summary" aria-label="Estados en la página cargada">{[['pendiente','Pendientes'],['en_curso','En curso'],['terminada','Terminadas']].map(([state,label])=><span key={state}><strong>{active.filter(r=>r.status===state).length}</strong>{label}</span>)}</div><TaskTable items={active} filters={filters} onFilterChange={setFilters} onSelect={onOpen} showDueDate={false} contextLabel="Actuaciones en esta página · filtros sobre los registros cargados" emptyLabel="No hay actuaciones activas en esta página."/></>
        : <>{!history.length&&<p>No hay actuaciones archivadas en esta página.</p>}{history.map(r=><article className="api-row" key={r.id}><div><strong>{r.contenido.titulo}</strong><small>Archivada · versión {r.version} · {when(r.revision.registradoEn)}</small></div><button onClick={()=>onOpen(r.id)}>Consultar actuación archivada</button></article>)}</>}
      <p className="api-intro">Se muestran hasta 20 registros. Los recuentos y filtros corresponden solo a esta página, no al total de la empresa.</p>
    </div>}
    <div className="api-actions"><button onClick={remote.refresh}>Actualizar actuaciones</button>{before&&<button onClick={()=>setBefore(null)}>Actuaciones más recientes</button>}{remote.data?.paginacion?.hayMas&&<button onClick={()=>setBefore(remote.data.paginacion.siguienteAntes)}>Actuaciones anteriores</button>}{directory.error&&<button onClick={directory.refresh}>Reintentar directorio</button>}{directory.data?.paginacion?.hayMas&&<button disabled={directory.loading} onClick={()=>{setKnownMembers(members);setMemberCursor(directory.data.paginacion.siguienteAntes);}}>Cargar más responsables del directorio</button>}</div>
  </Panel>;
}
