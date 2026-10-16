import React, {useState} from 'react';
import {Field, Notice} from './ui';
import {RecordPicker, Reason, SaveForm} from './NormativeControls';
import {exactRef, normativePath} from './normative-api-model';
import {blankHistory, categoryBody, categoryPath, designationFits, DIMENSIONS, LEVELS, newElement, selectedReference, utcInput, utcValue} from './ens-category-model';

export function EvidenceSelection({api,base,refs,onChange,label,scopeId}) {
  return <RecordPicker api={api} path={normativePath(base,'evidencias')} kind="evidencias" label={label} multiple selected={refs.map(selectedReference)} onChange={rows=>onChange(rows.map(exactRef))} accept={row=>row.contenido?.evidencia?.alcanceIds?.includes(scopeId)}/>;
}
export default function EnsCategoryEditor({api,base,system,data,onSaved,onRestart}) {
  const previous=data?.contenido.categorizacion;
  const [draft,setDraft]=useState(()=>({baseAplicabilidad:previous?.baseAplicabilidad||{tipo:'por_aclarar',motivo:'',evidencias:[]},historialTemporal:previous?.historialTemporal||blankHistory(),inventario:previous?.inventario||{completo:false,delimitacion:'',exclusiones:'',dependencias:'',elementos:[]},motivo:''}));
  const [active,setActive]=useState(null),[step,setStep]=useState('inventario');
  const [replacement,setReplacement]=useState([]);
  const effectiveSystem=replacement[0]||system;
  const inventory=draft.inventario;
  const history=draft.historialTemporal,updateHistory=patch=>setDraft(old=>({...old,historialTemporal:{...old.historialTemporal,...patch}}));
  const updateInventory=patch=>setDraft(old=>({...old,inventario:{...old.inventario,...patch}}));
  const updateElement=(id,patch)=>updateInventory({elementos:inventory.elementos.map(e=>e.id===id?{...e,...patch}:e)});
  function add(){const e=newElement();updateInventory({elementos:[...inventory.elementos,e]});setActive(e.id);}
  function remove(e){if(window.confirm(`¿Retirar «${e.nombre||'este elemento'}» del inventario que vas a guardar? Las versiones anteriores se conservarán.`)){updateInventory({elementos:inventory.elementos.filter(x=>x.id!==e.id)});setActive(null);}}
  const scopeId=replacement[0]?.contenido.alcance.id||previous?.alcance.id||system.contenido.alcance.id;
  return <SaveForm noValidate maxBodyBytes={128*1024} api={api} data={data} path={categoryPath(base,'categorizaciones-ens',data?.id)} title={data?'Actualizar el expediente de categorización':'Preparar la categorización del sistema'} submitLabel="Guardar valoraciones y consultar propuesta" onSaved={onSaved} onRestart={onRestart} body={()=>categoryBody(draft,previous,effectiveSystem,!!replacement.length)}>
    <Notice>Describe este sistema y conserva lo que aún no sabes. Guardar calcula una propuesta; no determina la categoría ni aprueba el cumplimiento.</Notice>
    {previous&&<details><summary>Revisar las versiones del sistema y su alcance antes de actualizar</summary><p>El expediente conserva sistema v{previous.sistema.version} y alcance v{previous.alcance.version}. Solo se cambiarán estas bases si seleccionas expresamente el sistema actualizado. Revisa después sus responsables y evidencias.</p><RecordPicker api={api} path={normativePath(base,'sistemas')} kind="sistemas" label="Nueva base del mismo sistema" selected={replacement} onChange={setReplacement} accept={row=>row.id===previous.sistema.id}/></details>}
    <nav className="api-tabs" aria-label="Preparación de la categorización"><button type="button" aria-pressed={step==='inventario'} onClick={()=>setStep('inventario')}>1 · Sistema e inventario</button><button type="button" aria-pressed={step==='valoraciones'} onClick={()=>setStep('valoraciones')}>2 · Valorar cada elemento</button></nav>
    <section hidden={step!=='inventario'}>
      <h3>¿Por qué estás preparando el ENS para este sistema?</h3>
      <Field label="Base declarada"><select value={draft.baseAplicabilidad.tipo} onChange={e=>setDraft({...draft,baseAplicabilidad:{...draft.baseAplicabilidad,tipo:e.target.value}})}><option value="por_aclarar">Necesito aclararlo</option><option value="legal">Obligación legal declarada</option><option value="contractual">Compromiso contractual</option><option value="voluntaria">Preparación voluntaria</option></select></Field>
      <Field label="Explica esa base y lo que falta contrastar"><textarea required maxLength={2000} value={draft.baseAplicabilidad.motivo} onChange={e=>setDraft({...draft,baseAplicabilidad:{...draft.baseAplicabilidad,motivo:e.target.value}})}/></Field>
      <EvidenceSelection api={api} base={base} scopeId={scopeId} label="Documentación de la base declarada" refs={draft.baseAplicabilidad.evidencias} onChange={evidencias=>setDraft({...draft,baseAplicabilidad:{...draft.baseAplicabilidad,evidencias}})}/>
      <Notice>Esta declaración no sustituye la decisión motivada de aplicabilidad.</Notice>
      {[['delimitacion','¿Qué información y servicios incluye este sistema?'],['exclusiones','¿Qué queda fuera y por qué?'],['dependencias','¿Qué dependencias o servicios compartidos tiene?']].map(([key,label])=><Field key={key} label={label}><textarea required maxLength={2000} value={inventory[key]} onChange={e=>updateInventory({[key]:e.target.value})}/></Field>)}
      <Field label="He identificado toda la información y los servicios del sistema"><input type="checkbox" checked={inventory.completo} onChange={e=>updateInventory({completo:e.target.checked})}/></Field>
      <p>Esta declaración se refiere al inventario, no a que todas las valoraciones estén resueltas.</p>
      <h3>¿Qué sabes del historial real de este sistema?</h3>
      <p>Registrarlo hoy no lo convierte en un sistema nuevo ni reinicia los plazos. Si solo conoces una fecha parcial, conserva el instante pendiente y explica lo que sabes.</p>
      <Field label="Conocimiento del historial"><select value={history.estado} onChange={e=>updateHistory({estado:e.target.value})}><option value="desconocido">Pendiente de conocer</option><option value="conocido">Conocido y documentado</option><option value="conflictivo">Hay datos contradictorios</option></select></Field>
      <Field label="Origen real del sistema"><select value={history.origenSistema} onChange={e=>updateHistory({origenSistema:e.target.value})}><option value="desconocido">No determinado</option><option value="nuevo">Sistema realmente nuevo</option><option value="existente">Sistema que ya existía</option></select></Field>
      {[['fechaInicio','Inicio real del sistema'],['ultimaDeterminacionEn','Última determinación'],['ultimaReevaluacionEn','Última reevaluación']].map(([key,label])=><Field key={key} label={label+' (UTC, si se conoce)'}><input type="datetime-local" step="0.001" value={utcInput(history[key])} onInput={e=>updateHistory({[key]:utcValue(e.target.value)})} onChange={e=>updateHistory({[key]:utcValue(e.target.value)})}/></Field>)}
      <Field label="Cambios significativos"><select value={history.cambiosSignificativos} onChange={e=>updateHistory({cambiosSignificativos:e.target.value})}><option value="desconocido">Pendientes de aclarar</option><option value="no">No constan cambios, tras comprobarlo</option><option value="pendientes">Existen cambios pendientes de examen</option><option value="examinados">Cambios examinados</option></select></Field>
      <Field label="Fundamento y limitaciones del historial"><textarea required maxLength={2000} value={history.motivo} onChange={e=>updateHistory({motivo:e.target.value})}/></Field>
      <EvidenceSelection api={api} base={base} scopeId={scopeId} refs={history.evidencias} label="Evidencias del historial del sistema" onChange={evidencias=>updateHistory({evidencias})}/>
    </section>
    <section className="ens-category-inventory">
      <h3>Información y servicios · {inventory.elementos.length} / 50</h3>
      <div className="api-actions">{inventory.elementos.map(e=><button key={e.id} type="button" aria-pressed={active===e.id} onClick={()=>setActive(e.id)}>{e.tipo==='servicio'?'Servicio':'Información'}: {e.nombre||'Sin nombre'}</button>)}<button type="button" disabled={inventory.elementos.length>=50} onClick={add}>Añadir información o servicio</button></div>
      {!inventory.elementos.length&&<p>Puedes guardar el inventario pendiente. No se asignará una categoría por defecto.</p>}
      {inventory.elementos.map(element=><section key={element.id} hidden={element.id!==active} className="ens-category-element" aria-label={'Elemento: '+(element.nombre||'sin nombre')}>
        <Field label="Tipo de elemento"><select value={element.tipo} onChange={e=>updateElement(element.id,{tipo:e.target.value,responsable:null})}><option value="informacion">Información</option><option value="servicio">Servicio</option></select></Field>
        <Field label="Nombre de la información o servicio"><input required maxLength={120} value={element.nombre} onChange={e=>updateElement(element.id,{nombre:e.target.value})}/></Field>
        <Field label="Describe qué contiene o qué presta"><textarea required maxLength={1000} value={element.descripcion} onChange={e=>updateElement(element.id,{descripcion:e.target.value})}/></Field>
        <RecordPicker api={api} path={normativePath(base,'designaciones')} kind="designaciones" label="Responsable de esta valoración" selected={element.responsable?[selectedReference(element.responsable)]:[]} onChange={rows=>updateElement(element.id,{responsable:rows.length?exactRef(rows[0]):null})} accept={row=>designationFits(row,effectiveSystem,element.tipo==='informacion'?'RESPONSABLE_INFORMACION':'RESPONSABLE_SERVICIO')}/>
        <p>Puede quedar pendiente. Ser administrador de la app no acredita esta función.</p>
        <Field label="Fecha y hora de la valoración (UTC, si se conoce)"><input type="datetime-local" step="0.001" value={utcInput(element.valoradoEn)} onInput={e=>updateElement(element.id,{valoradoEn:utcValue(e.target.value)})} onChange={e=>updateElement(element.id,{valoradoEn:utcValue(e.target.value)})}/></Field>
        <EvidenceSelection api={api} base={base} scopeId={scopeId} label="Evidencias de esta valoración" refs={element.evidencias} onChange={evidencias=>updateElement(element.id,{evidencias})}/>
        <Field label="Limitaciones y datos pendientes"><textarea maxLength={2000} value={element.limitaciones} onChange={e=>updateElement(element.id,{limitaciones:e.target.value})}/></Field>
        <h4>¿Qué consecuencias tendría perder cada dimensión?</h4>
        <p>Valora el perjuicio, no la probabilidad de un ataque. «No afectada» necesita explicación; no equivale a «no lo sé».</p>
        {Object.entries(DIMENSIONS).map(([key,label])=><details key={element.id+key} className="ens-dimension"><summary>{label} · {LEVELS[element.dimensiones[key].nivel]}</summary>
          <Field label={'Valoración de '+label.toLowerCase()}><select value={element.dimensiones[key].nivel} onChange={e=>updateElement(element.id,{dimensiones:{...element.dimensiones,[key]:{...element.dimensiones[key],nivel:e.target.value}}})}>{Object.entries(LEVELS).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></Field>
          <Field label={'Escenario y motivo de '+label.toLowerCase()}><textarea required maxLength={2000} value={element.dimensiones[key].motivo} onChange={e=>updateElement(element.id,{dimensiones:{...element.dimensiones,[key]:{...element.dimensiones[key],motivo:e.target.value}}})}/></Field>
          <Field label={'Criterios de impacto considerados en '+label.toLowerCase()}><textarea maxLength={2000} value={element.dimensiones[key].criteriosImpacto} onChange={e=>updateElement(element.id,{dimensiones:{...element.dimensiones,[key]:{...element.dimensiones[key],criteriosImpacto:e.target.value}}})}/></Field>
        </details>)}
        <button type="button" className="api-back" onClick={()=>remove(element)}>Retirar este elemento del inventario</button>
      </section>)}
    </section>
    <Reason value={draft.motivo} onChange={motivo=>setDraft({...draft,motivo})}/>
  </SaveForm>;
}
