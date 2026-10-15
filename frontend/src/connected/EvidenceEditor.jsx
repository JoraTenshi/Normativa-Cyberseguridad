import React, {useState} from 'react';
import {ApiError} from '../api-client';
import {Field, Notice} from './ui';
import {RecordPicker, PeriodFields, Reason, SaveForm} from './NormativeControls';
import {exactRef, normativePath, period, scopeRef} from './normative-api-model';
import {blankCheck, CheckFields, cleanSupport, DocumentVersionPicker, validateSupport} from './NormativeSupports';

export default function EvidenceEditor({api,base,packages,data,onSaved,onRestart}) {
  const c=data?.contenido,e=c?.evidencia;
  const [title,setTitle]=useState(e?.titulo||''),[type,setType]=useState(e?.tipo||''),[origin,setOrigin]=useState(e?.procedencia||''),[location,setLocation]=useState(e?.localizador||''),[dates,setDates]=useState(e?.periodo||{desde:'',hasta:''}),[scopes,setScopes]=useState(c?.alcances.map(r=>({id:r.id,nombre:'Alcance vinculado '+r.id,revision:{numero:r.version,sha256:r.sha256}}))||[]),[reason,setReason]=useState('');
  const [supportType,setSupportType]=useState(e?.soporte.tipo||'version_documento'),[pdf,setPdf]=useState(e?.soporte.tipo==='version_documento'?cleanSupport(e.soporte):null);
  const [check,setCheck]=useState(e?.soporte.tipo==='comprobacion'?cleanSupport(e.soporte):blankCheck());
  const [designations,setDesignations]=useState(e?.soporte.tipo==='designacion_versionada'?[{id:e.soporte.referencia.id,version:e.soporte.referencia.version,referencia:e.soporte.referencia,contenido:{designacion:e.soporte.designacion}}]:[]);
  const types=[...new Set(packages.flatMap(p=>p.ficha.criterios.flatMap(c=>c.tiposEvidencia)))];
  function changeType(value){setType(value);setSupportType(value==='designacion_versionada'?'designacion_versionada':'version_documento');setCheck(blankCheck());setDesignations([]);}
  function body(){
    if(!type||!scopes.length)throw new ApiError('Selecciona tipo de evidencia y alcance.',400);
    let soporte;
    if(type==='designacion_versionada'){
      if(scopes.length!==1||!designations[0]||designations[0].contenido.designacion.alcance.id!==scopes[0].id)throw new ApiError('Selecciona una designación del único alcance de esta evidencia.',400);
      soporte={tipo:'designacion_versionada',referencia:exactRef(designations[0])};
    }else{
      if(type==='version_documento'&&supportType!=='version_documento')throw new ApiError('Este tipo exige una versión documental.',400);
      const checked=cleanSupport(check);
      if(type!=='constatacion_documento')delete checked.documentoExaminado;
      soporte=validateSupport(supportType==='version_documento'?pdf:checked,type==='constatacion_documento');
    }
    return {alcances:scopes.map(scopeRef),tipo:type,titulo:title,procedencia:origin,localizador:location,periodo:period(dates.desde,dates.hasta),soporte,motivo:reason};
  }
  return <SaveForm api={api} data={data} path={normativePath(base,'evidencias',data?.id)} title={data?'Registrar otra versión de la evidencia':'Registrar una evidencia'} onSaved={onSaved} onRestart={onRestart} body={body}>
    <Notice>Registrar una evidencia no declara que sea suficiente ni auténtica. Cada revisión examina su contenido, alcance, tipo y periodo.</Notice>
    <Field label="Título de la evidencia"><input required maxLength={300} value={title} onChange={e=>setTitle(e.target.value)}/></Field>
    <Field label="Tipo de evidencia según los criterios"><select required value={type} onChange={e=>changeType(e.target.value)}><option value="">Selecciona un tipo…</option>{types.map(t=><option key={t} value={t}>{t.replaceAll('_',' ')}</option>)}</select></Field>
    <Field label="Procedencia"><textarea required maxLength={1000} value={origin} onChange={e=>setOrigin(e.target.value)}/></Field>
    <Field label="Localizador dentro de la evidencia"><input required maxLength={1000} value={location} onChange={e=>setLocation(e.target.value)}/></Field>
    <RecordPicker api={api} path={base+'/alcances'} kind="alcances" label="Alcances de la evidencia" multiple={type!=='designacion_versionada'} selected={scopes} onChange={setScopes}/>
    <PeriodFields value={dates} onChange={setDates}/>
    {type==='designacion_versionada'?<><Notice>Se conserva la referencia exacta de la designación, sus titulares y sus instrumentos. No la sustituimos por un nombre o por un PDF suelto.</Notice><RecordPicker api={api} path={normativePath(base,'designaciones')} kind="designaciones" label="Designación que documenta esta evidencia" selected={designations} onChange={setDesignations} accept={d=>scopes.length===1&&d.contenido?.designacion?.alcance.id===scopes[0].id}/></>:<><Field label="Soporte de la evidencia"><select value={supportType} onChange={e=>setSupportType(e.target.value)}><option value="version_documento">Versión exacta de un PDF disponible</option>{type!=='version_documento'&&<option value="comprobacion">{type==='constatacion_documento'?'Examen de un documento externo identificado':'Comprobación interna documentada'}</option>}</select></Field>{supportType==='version_documento'?<DocumentVersionPicker api={api} base={base} value={pdf} onChange={setPdf}/>:<CheckFields value={check} onChange={setCheck} documental={type==='constatacion_documento'}/>}</>}
    <Reason value={reason} onChange={setReason}/>
  </SaveForm>;
}
