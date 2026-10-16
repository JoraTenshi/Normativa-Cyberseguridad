import React, {useState} from 'react';
import {ApiError, downloadBlob, resourceId} from '../api-client';
import {ErrorBox, RemoteStatus, useRemote} from './ui';
import {normativePath} from './normative-api-model';
import {SupportRead} from './NormativeSupports';

function ExactEvidence({api,base,reference}) {
  const remote=useRemote(api,normativePath(base,'evidencias',reference.id,reference.version));
  const [downloadError,setDownloadError]=useState(null),dto=remote.data;
  const matches=dto?.referencia?.id===reference.id&&dto.referencia.version===reference.version&&dto.referencia.sha256===reference.sha256;
  async function openPDF(file){
    try {
      setDownloadError(null);
      const blob=await api.download(base+'/documentos/'+resourceId(file.documentoId)+'/versiones/'+file.numero+'/archivo');
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');
      if(hash!==file.sha256)throw new ApiError('El PDF no coincide con la versión de la evidencia. No se descargará.',503);
      downloadBlob(blob,'evidencia-ens-version-'+file.numero+'.pdf');
    } catch(e){setDownloadError(e);}
  }
  return <section className="ens-dimension"><RemoteStatus remote={remote}/>{remote.error&&<button onClick={remote.refresh}>Reintentar evidencia exacta</button>}{dto&&!matches&&<ErrorBox error={new ApiError('La referencia recibida no coincide con la evidencia conservada.',503)}/>}{dto&&matches&&<><h4>{dto.contenido.evidencia.titulo} · v{reference.version}</h4><p>{dto.contenido.evidencia.procedencia}</p><p>Localizador: {dto.contenido.evidencia.localizador}</p><SupportRead support={dto.contenido.evidencia.soporte} openPDF={openPDF}/></>}<ErrorBox error={downloadError}/></section>;
}
export default function EnsExactEvidence({api,base,refs=[]}) {
  const [selected,setSelected]=useState(null);
  return <><div className="api-actions">{refs.map((ref,index)=><button key={ref.id+':'+ref.version} onClick={()=>setSelected(ref)}>Consultar evidencia {index+1} · versión {ref.version}</button>)}</div>{selected&&<ExactEvidence key={selected.id+':'+selected.version} api={api} base={base} reference={selected}/>}</>;
}
