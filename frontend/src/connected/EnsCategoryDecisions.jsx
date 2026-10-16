import React, {useState} from 'react';
import {ApiError, queryString} from '../api-client';
import {Field, JsonDetail, Notice, Panel, RemoteStatus, useRemote, when} from './ui';
import {RecordPicker, Reason, SaveForm} from './NormativeControls';
import {exactRef, normativePath, RESULTS} from './normative-api-model';
import {categoryPath, designationFits, reference, REVIEW_CRITERIA, text, utcInput, utcValue} from './ens-category-model';
import {EvidenceSelection} from './EnsCategoryEditor';
import EnsExactEvidence from './EnsExactEvidence';

export function InstantField({label,value,onChange,required=true}) {
  const update = e => onChange(utcValue(e.target.value));
  return <Field label={label+' (UTC)'}><input required={required} type="datetime-local" step="0.001" value={utcInput(value)} onInput={update} onChange={update}/></Field>;
}
export function DeterminationEditor({api,base,system,categorization,onSaved}) {
  const [responsible,setResponsible]=useState([]),[evidence,setEvidence]=useState([]),[date,setDate]=useState(null),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false);
  const c=categorization.contenido.categorizacion;
  function body(){
    if(!confirmed||!responsible[0]||!date||!evidence.length||c.propuesta.estado!=='PROPUESTA_CALCULADA'||c.carenciasDocumentales?.length)throw new ApiError('Confirma la determinación real, su responsable, fecha y evidencias. La propuesta y su documentación deben estar completas.',400);
    return {categorizacion:exactRef(categorization),categoria:c.propuesta.categoriaPropuesta,responsable:exactRef(responsible[0]),determinadaEn:date,evidencias:evidence.map(reference),motivo:text(reason)};
  }
  return <SaveForm maxBodyBytes={128*1024} api={api} path={categoryPath(base,'determinaciones-ens')} title="Registrar una determinación del responsable de seguridad" body={body} onSaved={onSaved} submitLabel="Registrar determinación documentada">
    <Notice>Registra una decisión que ya se haya tomado y documentado. El cálculo de la app no sustituye al responsable competente.</Notice>
    <p>Categoría propuesta por el servidor: <strong>{c.propuesta.categoriaPropuesta}</strong> · expediente v{categorization.version}.</p>
    <RecordPicker api={api} path={normativePath(base,'designaciones')} kind="designaciones" label="Designación del responsable de seguridad" selected={responsible} onChange={setResponsible} accept={row=>designationFits(row,system,'RESPONSABLE_SEGURIDAD')}/>
    <InstantField label="Fecha y hora real de la determinación" value={date} onChange={setDate}/>
    <EvidenceSelection api={api} base={base} scopeId={c.alcance.id} refs={evidence} onChange={setEvidence} label="Evidencias de la determinación"/>
    <Field label="He contrastado que la determinación documentada coincide con esta categoría y versión"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/></Field>
    <Reason value={reason} onChange={setReason}/>
  </SaveForm>;
}
export function reviewBody(category,draft) {
  if(!text(draft.motivo)||text(draft.motivo).length>300)throw new ApiError('Indica el motivo de la revisión (hasta 300 caracteres).',400);
  if(!draft.desdeEn||!draft.hastaEn||!draft.examinadaEn||draft.desdeEn>draft.hastaEn||draft.hastaEn>draft.examinadaEn)throw new ApiError('Indica el intervalo examinado y cuándo lo examinaste, en orden temporal. No inventes precisión para fechas desconocidas.',400);
  if(!draft.tipoRevision||!draft.modalidadTemporal||!['actual','historica'].includes(draft.finalidadRevision))throw new ApiError('Indica el tipo, la finalidad y el fundamento temporal de esta revisión.',400);
  if(draft.criteria.length!==5||new Set(draft.criteria.map(c=>c.id)).size!==5||draft.criteria.some(c=>!Object.hasOwn(REVIEW_CRITERIA,c.id)||!['favorable','desfavorable','no_determinado'].includes(c.resultado)||!text(c.motivo)||text(c.motivo).length>2000))throw new ApiError('Valora y motiva los cinco criterios; no se presupone una conclusión favorable.',400);
  for(const c of draft.criteria)if(c.evidenciaIds.some(id=>!draft.evidence.some(e=>e.id===id))||(c.resultado==='favorable'&&!c.evidenciaIds.length))throw new ApiError('Vincula evidencias consultadas a cada criterio favorable.',400);
  const conclusion=draft.criteria.some(c=>c.resultado==='desfavorable')?'desfavorable':draft.criteria.some(c=>c.resultado==='no_determinado')?'no_determinado':'favorable';
  if(conclusion==='favorable'&&!draft.determination[0])throw new ApiError('La revisión favorable necesita una determinación documentada de esta versión.',400);
  return {categorizacion:exactRef(category),determinacion:draft.determination[0]?exactRef(draft.determination[0]):null,evidencias:draft.evidence.map(reference),criterios:draft.criteria.map(c=>({...c,motivo:text(c.motivo)})),conclusion,periodoExaminado:{desdeEn:draft.desdeEn,hastaEn:draft.hastaEn,zonaEvaluacion:'UTC'},examinadaEn:draft.examinadaEn,tipoRevision:draft.tipoRevision,revisionAnterior:draft.previous[0]?exactRef(draft.previous[0]):null,modalidadTemporal:draft.modalidadTemporal,finalidadRevision:draft.finalidadRevision,motivo:text(draft.motivo)};
}
export function CategoryReviewEditor({api,base,categorization,onSaved}) {
  const [draft,setDraft]=useState({determination:[],evidence:[],previous:[],desdeEn:null,hastaEn:null,examinadaEn:null,tipoRevision:'',modalidadTemporal:'',finalidadRevision:'',motivo:'',criteria:Object.keys(REVIEW_CRITERIA).map(id=>({id,resultado:'',motivo:'',evidenciaIds:[]}))});
  const update=patch=>setDraft(old=>({...old,...patch})), c=categorization.contenido.categorizacion;
  const changeCriterion=(id,patch)=>update({criteria:draft.criteria.map(row=>row.id===id?{...row,...patch}:row)});
  return <SaveForm noValidate maxBodyBytes={128*1024} api={api} path={categoryPath(base,'revisiones-categorizacion-ens')} title="Revisar la categorización" body={()=>reviewBody(categorization,draft)} onSaved={onSaved} submitLabel="Registrar revisión motivada">
    <Notice>La conclusión se limita al intervalo examinado. No acredita de forma continua el tiempo posterior ni certifica el sistema.</Notice>
    <RecordPicker api={api} path={categoryPath(base,'determinaciones-ens')} kind="determinaciones-ens" label="Determinación examinada" selected={draft.determination} onChange={determination=>update({determination})} accept={row=>row.contenido?.determinacion?.categorizacion?.id===categorization.id&&row.contenido.determinacion.categorizacion.version===categorization.version}/>
    <InstantField label="Inicio del intervalo examinado" value={draft.desdeEn} onChange={desdeEn=>update({desdeEn})}/>
    <InstantField label="Final del intervalo examinado" value={draft.hastaEn} onChange={hastaEn=>update({hastaEn})}/>
    <p>Para una comprobación puntual, indica el mismo instante de inicio y final. No selecciones el día siguiente como cobertura futura.</p>
    <InstantField label="Cuándo realizaste el examen" value={draft.examinadaEn} onChange={examinadaEn=>update({examinadaEn})}/>
    <Field label="Finalidad de esta revisión"><select value={draft.finalidadRevision} onChange={e=>update({finalidadRevision:e.target.value})}><option value="">Selecciona…</option><option value="actual">Seguimiento actual sobre las bases vigentes</option><option value="historica">Documentar exclusivamente una situación histórica</option></select></Field>
    <p>El estado de seguimiento puede mantenerse mientras sus fundamentos sigan vigentes. No constituye prueba continua de lo ocurrido después del examen.</p>
    <Field label="Tipo de revisión"><select value={draft.tipoRevision} onChange={e=>update({tipoRevision:e.target.value})}><option value="">Selecciona…</option><option value="inicial">Inicial</option><option value="anual">Anual</option><option value="cambio_significativo">Por cambio significativo</option><option value="otra">Otra, con motivo</option></select></Field>
    <Field label="Qué has constatado sobre la reevaluación"><select value={draft.modalidadTemporal} onChange={e=>update({modalidadTemporal:e.target.value})}><option value="">Selecciona…</option><option value="inicial_sin_reevaluacion_vencida">Sistema nuevo: sin reevaluación vencida ni cambio pendiente, contrastado</option><option value="determinacion_previa_sin_reevaluacion_vencida">Sistema existente: determinación previa documentada, sin reevaluación vencida</option><option value="reevaluacion_documentada">Reevaluación real documentada</option><option value="no_determinada">No se ha podido determinar</option></select></Field>
    <Notice>El alta en la app no reinicia la anualidad. Un historial desconocido no permite afirmar que no hay una reevaluación pendiente.</Notice>
    <RecordPicker api={api} path={categoryPath(base,'revisiones-categorizacion-ens')} kind="revisiones-categorizacion-ens" label="Revisión anterior, si existe" selected={draft.previous} onChange={previous=>update({previous})} accept={row=>row.contenido?.revisionCategorizacion?.categorizacion?.id===categorization.id}/>
    <EvidenceSelection api={api} base={base} scopeId={c.alcance.id} refs={draft.evidence} label="Evidencias examinadas" onChange={evidence=>update({evidence,criteria:draft.criteria.map(row=>({...row,evidenciaIds:row.evidenciaIds.filter(id=>evidence.some(e=>e.id===id))}))})}/>
    {draft.criteria.map((row,i)=><details key={row.id} className="ens-dimension" open><summary>{i+1}. {REVIEW_CRITERIA[row.id]}</summary>
      <Field label={'Valoración del criterio '+(i+1)}><select value={row.resultado} onChange={e=>changeCriterion(row.id,{resultado:e.target.value})}><option value="">Sin valorar</option><option value="favorable">Favorable</option><option value="desfavorable">Desfavorable</option><option value="no_determinado">No determinado</option></select></Field>
      <Field label={'Motivo del criterio '+(i+1)}><textarea maxLength={2000} value={row.motivo} onChange={e=>changeCriterion(row.id,{motivo:e.target.value})}/></Field>
      <fieldset><legend>Evidencias que sustentan este criterio</legend>{draft.evidence.map((e,j)=><Field key={e.id} label={'Evidencia '+(j+1)+' · '+e.id+' · v'+e.version}><input type="checkbox" checked={row.evidenciaIds.includes(e.id)} onChange={event=>changeCriterion(row.id,{evidenciaIds:event.target.checked?[...row.evidenciaIds,e.id]:row.evidenciaIds.filter(id=>id!==e.id)})}/></Field>)}</fieldset>
    </details>)}
    <Reason value={draft.motivo} onChange={motivo=>update({motivo})}/>
  </SaveForm>;
}
function DecisionDetail({api,base,kind,id}) {
  const remote=useRemote(api,categoryPath(base,kind,id));
  const dto=remote.data,content=dto?.contenido,review=content?.revisionCategorizacion,d=content?.determinacion;
  return <><RemoteStatus remote={remote}/>{remote.error&&<button onClick={remote.refresh}>Reintentar constancia</button>}{dto&&<section className="ens-dimension"><h4>{review?'Revisión conservada':'Determinación conservada'}</h4><p>Registro: {when(dto.revision.registradoEn)} · {dto.revision.motivo}</p>{d&&<><p>Categoría determinada: {d.categoria}</p><p>Actuación real: {when(d.determinadaEn)}</p><p>Expediente examinado: versión {d.categorizacion.version}</p><EnsExactEvidence api={api} base={base} refs={d.evidencias}/></>}{review&&<><p>Conclusión histórica: {RESULTS[review.conclusion]}</p><p>Intervalo examinado UTC: {review.periodoExaminado.desdeEn} → {review.periodoExaminado.hastaEn}</p><p>Examen real: {when(review.examinadaEn)} · modalidad {review.modalidadTemporal.replaceAll('_',' ')}</p>{review.criterios.map(row=><div key={row.id}><h4>{REVIEW_CRITERIA[row.id]} · {RESULTS[row.resultado]}</h4><p>{row.motivo}</p><EnsExactEvidence api={api} base={base} refs={review.evidencias.filter(e=>row.evidenciaIds.includes(e.id))}/></div>)}</>}<JsonDetail value={content} label="Referencias y evidencia exacta de esta constancia"/></section>}</>;
}
export function CategoryDecisionHistory({api,base,categoryId,kind,title}) {
  const [before,setBefore]=useState(null),[selected,setSelected]=useState(null);
  const remote=useRemote(api,categoryPath(base,kind)+queryString({categorizacionId:categoryId,limite:20,antes:before}));
  return <Panel title={title}><RemoteStatus remote={remote}/>{remote.error&&<button onClick={remote.refresh}>Reintentar historial</button>}{remote.data?.registros.map(dto=><div className="api-row" key={dto.id}><p>{when(dto.revision.registradoEn)} · {dto.revision.motivo}</p><button onClick={()=>setSelected(dto.id)}>Consultar constancia</button></div>)}{remote.data?.registros.length===0&&<p>No hay constancias en esta página.</p>}{before&&<button onClick={()=>setBefore(null)}>Constancias más recientes</button>}{remote.data?.paginacion.hayMas&&<button onClick={()=>setBefore(remote.data.paginacion.siguienteAntes)}>Constancias anteriores</button>}{selected&&<DecisionDetail key={selected} api={api} base={base} kind={kind} id={selected}/>}</Panel>;
}
