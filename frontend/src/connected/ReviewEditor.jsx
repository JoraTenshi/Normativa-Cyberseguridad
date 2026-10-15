import React, {useState} from 'react';
import {Field, Notice} from './ui';
import {RecordPicker, PeriodFields, Reason, SaveForm} from './NormativeControls';
import {canReview, evidenceEligible, normativePath, recordLabel, reviewBody, reviewConclusion, reviewCriteria, routeFacts, RESULTS} from './normative-api-model';

export const ROUTE_STATES={coincide:'Dato compatible con esta alternativa',no_coincide:'El dato no corresponde a esta alternativa',desconocido:'Dato pendiente de aclarar',en_conflicto:'Información contradictoria'};
export function RouteFacts({requirement,route}) {
  const ficha=requirement.contenido.paquete.ficha;
  const facts=routeFacts(requirement,route);
  return <section className="norm-route-facts" aria-label="Datos de la alternativa"><h3>Datos fijados en esta contextualización</h3>{!facts.length?<p>Esta alternativa no requiere hechos adicionales.</p>:facts.map(f=><div key={f.clave}><strong>{ficha.satisfaccion.hechos.find(h=>h.clave===f.clave)?.pregunta.texto||f.clave}</strong><p>{ROUTE_STATES[f.state]} · respuesta requerida: {f.valor?'sí':'no'}.</p></div>)}{facts.some(f=>f.state!=='coincide')&&<Notice tone="warning">Puedes documentar una valoración no determinada o desfavorable. Para una favorable, aclara los datos del sistema u operación y actualiza explícitamente la contextualización. Lo desconocido no es una exención.</Notice>}</section>;
}
function CriterionDetails({children}) {
  const [open,setOpen]=useState(true);
  return <details open={open} onToggle={event=>setOpen(event.currentTarget.open)}>{children}</details>;
}
const blankRows=(ficha,id)=>reviewCriteria(ficha,id).map(c=>({criterioId:c.id,resultado:'',motivo:'',evidenciaIds:[],...(ficha.schemaVersion===2?{compatibilidad:{estado:'desconocida',motivo:''}}:{})}));
export default function ReviewEditor({api,base,requirement,onSaved}) {
  const ficha=requirement.contenido.paquete.ficha,schema2=ficha.schemaVersion===2;
  const [routeId,setRouteId]=useState(''),[routeReason,setRouteReason]=useState(''),[dates,setDates]=useState({desde:'',hasta:''}),[evidence,setEvidence]=useState([]),[reason,setReason]=useState(''),[criteria,setCriteria]=useState(()=>blankRows(ficha,''));
  const expected=reviewCriteria(ficha,routeId),route=ficha.satisfaccion?.rutas.find(r=>r.id===routeId);
  const update=(id,value)=>setCriteria(rows=>rows.map(c=>c.criterioId===id?{...c,...value}:c));
  const conclusion=reviewConclusion(criteria);
  function chooseRoute(id){if(criteria.some(c=>c.resultado||c.motivo||c.evidenciaIds.length||c.compatibilidad?.motivo)&&!window.confirm('Cambiar la alternativa descarta las valoraciones de este borrador. El historial guardado no cambia. ¿Continuar?'))return;setRouteId(id);setRouteReason('');setCriteria(blankRows(ficha,id));}
  return <SaveForm api={api} path={normativePath(base,'revisiones')} title="Nueva revisión interna motivada" onSaved={onSaved} body={()=>reviewBody(requirement,evidence,criteria,dates,reason,{id:routeId,motivo:routeReason})} disabled={!canReview(requirement)||(schema2&&!route)}>
    <Notice>Revisa cada criterio y explica el juicio. No se marcan criterios favorables automáticamente. Tu identidad y la fecha de registro las fija el servidor.</Notice>
    {schema2&&<section className="norm-route-choice"><Field label="Alternativa que vas a revisar"><select required value={routeId} onChange={e=>chooseRoute(e.target.value)}><option value="">Elige según los hechos del caso…</option>{ficha.satisfaccion.rutas.map(r=><option key={r.id} value={r.id}>{r.titulo}</option>)}</select></Field>{route&&<><p>{route.explicacion}</p><Field label="Por qué revisas esta alternativa"><textarea required maxLength={2000} value={routeReason} onChange={e=>setRouteReason(e.target.value)}/></Field><RouteFacts requirement={requirement} route={route}/><p>{expected.length} criterios a valorar. Los criterios de otras alternativas no se consideran satisfechos ni no aplicables.</p></>}</section>}
    {(!schema2||route)&&<><PeriodFields value={dates} onChange={setDates}/><RecordPicker api={api} path={normativePath(base,'evidencias')} kind="evidencias" label="Evidencias que vas a examinar" multiple selected={evidence} onChange={v=>{setEvidence(v);const ids=new Set(v.map(e=>e.id));setCriteria(rows=>rows.map(c=>({...c,evidenciaIds:c.evidenciaIds.filter(id=>ids.has(id))})));}}/>
    <ol className="norm-review-criteria">{expected.map((c,index)=>{const row=criteria[index];return <li key={c.id}><CriterionDetails><summary>Criterio {index+1} · {row.resultado?RESULTS[row.resultado]:'Pendiente de valorar'}</summary><p>{c.descripcion}</p><p className="norm-reference">Tipos admitidos: {c.tiposEvidencia.map(t=>t.replaceAll('_',' ')).join(', ')}</p>
      <Field label={'Valoración del criterio '+(index+1)}><select required value={row.resultado} onChange={e=>update(c.id,{resultado:e.target.value})}><option value="">Selecciona una valoración…</option>{['favorable','desfavorable','no_determinado'].map(r=><option key={r} value={r}>{RESULTS[r]}</option>)}</select></Field>
      <Field label={'Motivo del criterio '+(index+1)}><textarea required maxLength={2000} value={row.motivo} onChange={e=>update(c.id,{motivo:e.target.value})}/></Field>
      {schema2&&<><Field label={'Compatibilidad de la evidencia del criterio '+(index+1)}><select value={row.compatibilidad.estado} onChange={e=>update(c.id,{compatibilidad:{...row.compatibilidad,estado:e.target.value}})}><option value="desconocida">Todavía no determinada</option><option value="compatible">Compatible tras el contraste</option><option value="en_conflicto">Hay contradicciones</option></select></Field><Field label={'Motivo de compatibilidad del criterio '+(index+1)}><textarea required maxLength={2000} value={row.compatibilidad.motivo} onChange={e=>update(c.id,{compatibilidad:{...row.compatibilidad,motivo:e.target.value}})}/></Field></>}
      <fieldset><legend>Evidencias examinadas en este criterio</legend>{evidence.map(ev=>{const eligible=evidenceEligible(ev,c,dates,requirement.contenido.requisito.alcance.id,requirement,row.resultado),checked=row.evidenciaIds.includes(ev.id);return <label className="norm-check" key={ev.id}><input type="checkbox" checked={checked} disabled={!eligible&&!checked} onChange={e=>update(c.id,{evidenciaIds:e.target.checked?[...row.evidenciaIds,ev.id]:row.evidenciaIds.filter(id=>id!==ev.id)})}/><span>{recordLabel(ev)} · v{ev.version}{!eligible&&<small>No coincide el tipo, alcance, objeto, periodo o vigencia; o la designación no está resuelta para un favorable.</small>}</span></label>;})}{!evidence.length&&<p>No hay evidencias seleccionadas.</p>}</fieldset></CriterionDetails></li>;})}</ol>
      <Notice>Conclusión de los juicios introducidos: <strong>{conclusion?RESULTS[conclusion]:'Completa todas las valoraciones'}</strong>. El servidor comprobará su coherencia antes de registrarla. No es una certificación.</Notice><Reason review value={reason} onChange={setReason}/></>}
  </SaveForm>;
}
