import React, { useState } from 'react';
import { ApiError, queryString, resourceId } from '../api-client';
import { Field, Notice, RemoteStatus, useRemote } from './ui';
import { RecordPicker } from './NormativeControls';
import { civilDate, recordedAt } from './normative-view-model';

export const blankCheck=()=>({tipo:'comprobacion',metodo:'',realizadaEn:'',resultado:'',limitaciones:''});
export function cleanSupport(s) {
  if(s.tipo==='version_documento')return {tipo:s.tipo,documentoId:s.documentoId,versionDocumentoId:s.versionDocumentoId};
  if(s.tipo==='designacion_versionada')return {tipo:s.tipo,referencia:s.referencia};
  return {tipo:'comprobacion',metodo:s.metodo,realizadaEn:s.realizadaEn,resultado:s.resultado,limitaciones:s.limitaciones,...(s.documentoExaminado?{documentoExaminado:s.documentoExaminado}:{})};
}
export function validateSupport(s,documental=false) {
  if(!s)throw new ApiError('Selecciona un soporte exacto.',400);
  if(s.tipo==='comprobacion') {
    if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s.realizadaEn)||!Number.isFinite(Date.parse(s.realizadaEn)))throw new ApiError('Indica fecha y hora UTC completa de la comprobación.',400);
    if(['metodo','resultado','limitaciones'].some(k=>!s[k]?.trim()))throw new ApiError('Completa método, resultado y limitaciones.',400);
    if(documental && ['identificador','version','localizador','contenidoExaminado'].some(k=>!s.documentoExaminado?.[k]?.trim()))throw new ApiError('Identifica el documento externo, su versión, localizador y contenido examinado.',400);
  }
  return cleanSupport(s);
}
export function DocumentVersionPicker({api,base,value,onChange,required=true}) {
  const [documents,setDocuments]=useState([]),[before,setBefore]=useState(null);const doc=documents[0];
  const remote=useRemote(api,doc?base+'/documentos/'+resourceId(doc.id)+'/versiones'+queryString({antes:before}):null);
  return <><RecordPicker api={api} path={base+'/documentos'} kind="documentos" label="Documento PDF" selected={documents} onChange={v=>{setDocuments(v);setBefore(null);onChange(null);}}/><RemoteStatus remote={remote}/>{doc&&<Field label="Versión exacta del PDF"><select required={required} value={value?.versionDocumentoId||''} onChange={e=>{const v=remote.data.versiones.find(x=>(x.id||x.versionDocumentoId)===e.target.value);onChange(v?{tipo:'version_documento',documentoId:doc.id,versionDocumentoId:v.id||v.versionDocumentoId}:null);}}><option value="">Selecciona una versión consultada…</option>{remote.data?.versiones.map(v=><option key={v.numero} disabled={!(v.id||v.versionDocumentoId)} value={v.id||v.versionDocumentoId||''}>Versión {v.numero} · {v.nombre}</option>)}</select></Field>}{value&&<p className="norm-reference">PDF seleccionado · documento {value.documentoId} · versión {value.versionDocumentoId}. Conservamos esta referencia hasta que elijas otra.</p>}<div className="api-actions">{before&&<button type="button" onClick={()=>setBefore(null)}>PDF más recientes</button>}{remote.data?.siguiente&&<button type="button" onClick={()=>setBefore(remote.data.siguiente)}>PDF anteriores</button>}</div></>;
}
export function CheckFields({value,onChange,documental=false,required=true}) {
  const update=(key,val)=>onChange({...value,[key]:val});
  return <><Field label="Método de comprobación"><textarea required={required} maxLength={2000} value={value.metodo} onChange={e=>update('metodo',e.target.value)}/></Field><Field label="Fecha y hora de la comprobación (UTC)" hint="Formato ISO UTC: 2026-10-15T10:00:00.000Z. No puede ser futura."><input required={required} value={value.realizadaEn} onChange={e=>update('realizadaEn',e.target.value)}/></Field><Field label="Resultado observado"><textarea required={required} maxLength={2000} value={value.resultado} onChange={e=>update('resultado',e.target.value)}/></Field><Field label="Limitaciones de la comprobación"><textarea required={required} maxLength={2000} value={value.limitaciones} onChange={e=>update('limitaciones',e.target.value)}/></Field>{documental&&<fieldset><legend>Documento externo examinado</legend><Notice>No basta una afirmación oral. Identifica el documento y qué has examinado, sin copiar su contenido completo ni atribuirle autenticidad automática.</Notice>{[['identificador','Identificador del documento externo',500],['version','Versión o edición del documento externo',200],['localizador','Dónde está el documento y apartado examinado',1000],['contenidoExaminado','Qué contenido se ha examinado',2000]].map(([key,label,max])=><Field key={key} label={label}><textarea required maxLength={max} value={value.documentoExaminado?.[key]||''} onChange={e=>update('documentoExaminado',{...value.documentoExaminado,[key]:e.target.value})}/></Field>)}</fieldset>}</>;
}
export function SupportRead({support:s,openPDF}) {
  if(!s)return null;
  if(s.tipo==='version_documento')return <><p>Documento PDF · versión {s.numero}</p><p className="norm-hash">SHA-256: {s.sha256}</p>{openPDF&&<button type="button" onClick={()=>openPDF({documentoId:s.documentoId,versionDocumentoId:s.versionDocumentoId,numero:s.numero,sha256:s.sha256})}>Consultar esta versión exacta</button>}</>;
  if(s.tipo==='designacion_versionada')return <><p>Designación vinculada · versión {s.referencia.version}</p><p className="norm-hash">SHA-256: {s.referencia.sha256}</p><DesignationRead designation={s.designacion} openPDF={openPDF}/></>;
  return <><p><strong>Método:</strong> {s.metodo}</p><p>Comprobada: {recordedAt(s.realizadaEn)}</p><p>{s.resultado}</p><p><strong>Limitaciones:</strong> {s.limitaciones}</p>{s.documentoExaminado&&<dl>{[['identificador','Documento externo'],['version','Versión examinada'],['localizador','Localizador'],['contenidoExaminado','Contenido examinado']].map(([key,label])=><div key={key}><dt>{label}</dt><dd>{s.documentoExaminado[key]}</dd></div>)}</dl>}</>;
}
export function DesignationRead({designation:d,openPDF}) {
  if(!d)return null;
  return <section className="norm-designation"><h3>{d.funcionId.replaceAll('_',' ')}</h3><p>Estado: {({identificada:'Identificada',por_aclarar:'Por aclarar',en_conflicto:'En conflicto'})[d.estado]}</p><p>{d.motivoDelEstado}</p><p>Alcance v{d.alcance.version} · {d.objeto.tipo} v{d.objeto.version}</p><p>Desde {civilDate(d.periodo.desde)} · {d.periodo.hasta?'hasta '+civilDate(d.periodo.hasta)+' (final excluido)':'fin no determinado'}</p><h4>Titulares y delimitación</h4>{d.titulares.length?d.titulares.map(t=><div key={t.sujeto.id}><strong>{t.datosSujeto.nombre}</strong><p>{t.datosSujeto.procedenciaOrganizativa} · versión {t.sujeto.version}</p><p>{t.delimitacion}</p></div>):<p>No consta titular resuelto.</p>}<h4>Instrumentos de la designación</h4>{d.instrumentos.map((s,i)=><div key={i} className="norm-instrument"><SupportRead support={s} openPDF={openPDF}/></div>)}{!d.instrumentos.length&&<p>No consta instrumento.</p>}<Notice>Registrar esta función no concede permisos en la aplicación. La designación tampoco demuestra, por sí sola, el ejercicio efectivo de la función.</Notice></section>;
}
