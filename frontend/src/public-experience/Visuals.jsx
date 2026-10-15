/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
import React, { useEffect, useRef, useState } from 'react';
import { BUSINESS_CASES, LEGAL_CASES } from './landing-cases.js';
import { CASE_READING_MS } from './landing-model.js';
import JourneyShowcase from './JourneyShowcase.jsx';

export function useReducedMotion() {
  const [reduce,setReduce]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduce(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  return reduce;
}
function Glyph({kind='company'}) {
  const paths={company:'M4 21V8h16v13M8 8V3h8v5M8 12h2m4 0h2M8 16h2m4 0h2M10 21v-3h4v3',question:'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',document:'M5 3h9l5 5v13H5zM14 3v5h5M8 12h8M8 16h6',plan:'m3 6 2 2 3-4M12 6h9M3 13h5m4 0h9M3 20h5m4 0h9'};
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]}/></svg>;
}
// Finite, readable sequences. Offscreen/hidden pages do not advance; selection stops autoplay.
function useSequence(length,delay,reduce) {
  const ref=useRef(null);
  const [index,setIndex]=useState(0),[visible,setVisible]=useState(false),[manual,setManual]=useState(false),[hover,setHover]=useState(false),[hidden,setHidden]=useState(document.hidden);
  useEffect(()=>{const observer=new IntersectionObserver(([e])=>setVisible(e.isIntersecting),{threshold:.35});observer.observe(ref.current);const change=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',change);return()=>{observer.disconnect();document.removeEventListener('visibilitychange',change);};},[]);
  useEffect(()=>{if(!visible || hidden || reduce || manual || hover || index>=length-1)return;const timer=setTimeout(()=>setIndex(n=>Math.min(n+1,length-1)),delay);return()=>clearTimeout(timer);},[visible,hidden,reduce,manual,hover,index,length,delay]);
  return {ref,index,choose:n=>{setManual(true);setIndex(n);},pause:()=>setManual(true),bindings:{onMouseEnter:()=>setHover(true),onMouseLeave:()=>setHover(false),onFocusCapture:()=>setManual(true)}};
}
export const FLOW_STEPS=[
  {label:'Tu empresa',kind:'company',title:'Lo que haces, bien definido.'},
  {label:'Qué revisar',kind:'question',title:'Las preguntas que importan.'},
  {label:'Documentos',kind:'document',title:'Cada pieza, en su contexto.'},
  {label:'Tu plan',kind:'plan',title:'Un siguiente paso concreto.'},
];
function CaseTabs({value,onChange,label}) {
  return <div className="case-tabs" role="group" aria-label={label}>{BUSINESS_CASES.map((c,i)=><button key={c.id} type="button" aria-pressed={i===value} onClick={()=>onChange(i)}>{c.label}</button>)}</div>;
}
function PanelTop({section,title}) {
  return <header className="visual-panel-top"><span className="visual-dot"/><span>{section}</span><strong>{title}</strong><span className="visual-dots" aria-hidden="true">•••</span></header>;
}
export function FlowMap({reduce}) {
  return <JourneyShowcase reduce={reduce}/>;
}
export function PhaseVisual({phase}) {
  const [caseIndex,setCaseIndex]=useState(0),[question,setQuestion]=useState(0),[status,setStatus]=useState('En curso'),[selectedRoles,setSelectedRoles]=useState([0,1]);
  const c=BUSINESS_CASES[caseIndex];
  const change=i=>{setCaseIndex(i);setQuestion(0);setStatus('En curso');setSelectedRoles([0,1]);};
  return <div className={'phase-visual '+['profile-visual','review-visual','plan-visual'][phase]}>
    <PanelTop section={['PERFIL DE EMPRESA','REVISIÓN PARA TU ACTIVIDAD','TAREAS Y RESPONSABLES'][phase]} title="Tu empresa"/>
    <div className="visual-panel-content">
      <CaseTabs value={caseIndex} onChange={change} label={['Casos del perfil','Casos de la revisión','Casos del plan'][phase]}/>
      {phase===0 && <><p className="visual-question">¿Qué ofrece tu empresa?</p><p className="case-intro">{c.activity}</p><div className="activity-options">{c.roles.map((role,i)=><button key={role} aria-pressed={selectedRoles.includes(i)} onClick={()=>setSelectedRoles(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i])}><span>{selectedRoles.includes(i)?'✓':'+'}</span>{role}</button>)}</div><div className="profile-next"><Glyph kind="question"/><div><b>Información pendiente</b><p>{c.questions[0]}</p></div></div></>}
      {phase===1 && <><div className="review-tabs" aria-label="Cuestiones a revisar"><button aria-pressed={question===0} onClick={()=>setQuestion(0)}>La situación</button><button aria-pressed={question===1} onClick={()=>setQuestion(1)}>Qué falta saber</button></div><div className="document-preview" key={caseIndex+'-'+question}><span className="document-label">{c.ref}</span><h4>{c.questions[question]}</h4><p>{question===0?c.context:c.detail}</p><mark>{c.missing}</mark></div><div className="review-reference"><span>Documentación relacionada</span><b>{c.documents[0]}</b></div></>}
      {phase===2 && <><span className="task-category">TAREA PROPUESTA</span><h4>{c.task}</h4><div className="task-person"><span>↗</span><div><b>{c.owner}</b><small>Tu equipo</small></div><label>Estado<select aria-label="Estado de la tarea en la explicación" value={status} onChange={e=>setStatus(e.target.value)}><option>En curso</option><option>Por revisar</option></select></label></div><ul className="visual-checklist">{c.steps.map((s,i)=><li key={s} className={i===0 || (i===1 && status==='Por revisar')?'checked':''}><span>{i===0 || (i===1 && status==='Por revisar')?'✓':i+1}</span>{s}</li>)}</ul><div className="task-result">{status==='Por revisar'?'Preparado para revisión. Tu equipo debe revisar el resultado.':'Trabajo iniciado. Concreta la información y prepara la documentación.'}</div></>}
    </div>
  </div>;
}
function LegalVisual({reduce}) {
  const sequence=useSequence(LEGAL_CASES.length,CASE_READING_MS,reduce);
  const c=LEGAL_CASES[sequence.index];
  return <div className="product-visual basis-visual" ref={sequence.ref} {...sequence.bindings}>
    <PanelTop section="NORMATIVA Y REQUISITOS" title="¿Qué puede aplicarte?"/>
    <div className="visual-panel-content">
      <div className="case-tabs legal-tabs" role="group" aria-label="Casos normativos">{LEGAL_CASES.map((x,i)=><button key={x.label} aria-pressed={sequence.index===i} onClick={()=>sequence.choose(i)}>{x.label}</button>)}</div>
      <div className="legal-scene" key={sequence.index}>
        <p className="legal-condition">{c.condition}</p>
        <div className="basis-pair"><span>{c.kind}</span><strong>{c.framework}<br/><em>{c.article}</em></strong></div>
        <div className="basis-connector" aria-hidden="true">↓</div>
        <div className="basis-task"><span>LO QUE NECESITAS REVISAR</span><h4>{c.question}</h4><p>{c.detail}</p></div>
        <div className="legal-action"><Glyph kind="plan"/><span>{c.task}</span></div>
        <div className="legal-links">{c.url && <a href={c.url} target="_blank" rel="noopener noreferrer">Consultar fuente oficial ↗</a>}{c.href && <a href={c.href}>Abrir el trabajo relacionado →</a>}</div>
      </div>
    </div>
  </div>;
}
export function ProductVisual({kind,reduce}) {
  const [caseIndex,setCaseIndex]=useState(0);
  const c=BUSINESS_CASES[caseIndex];
  if(kind==='basis') return <LegalVisual reduce={reduce}/>;
  return <div className={'product-visual '+(kind==='documents'?'document-visual':'history-visual')}>
    <PanelTop section={kind==='documents'?'DOCUMENTACIÓN':'REGISTRO DE CAMBIOS'} title={kind==='documents'?'Cada documento tiene un propósito':'Qué cambió y por qué'}/>
    <div className="visual-panel-content"><CaseTabs value={caseIndex} onChange={setCaseIndex} label={kind==='documents'?'Casos de documentación':'Casos del histórico'}/>
      {kind==='documents'?<><div className="document-file"><div className="document-file-icon"><Glyph kind="document"/></div><div><strong>{c.documents[0]}</strong><p>{c.task}</p></div></div><div className="file-versions"><div><span>Versión de trabajo</span><b>0.2</b></div><div><span>Quién lo prepara</span><b>{c.owner}</b></div><div><span>Estado del documento</span><b>Borrador</b></div><div><span>Estado de revisión</span><b>Por revisar</b></div></div><div className="file-observation"><span>QUÉ NECESITAS CONCRETAR</span><p>{c.missing}</p></div></>:<><div className="history-order">Más recientes primero <span>↓</span></div><ol className="visual-timeline"><li><time>08 OCT</time><div><b>Documento preparado</b><p>{c.documents[0]}. Nueva versión pendiente de revisión.</p><span className="visual-status blue">Por revisar</span></div></li><li><time>06 OCT</time><div><b>Responsabilidad asignada</b><p>{c.owner}: {c.task.toLowerCase()}.</p></div></li><li><time>05 OCT</time><div><b>Cuestión identificada</b><p>{c.questions[0]}</p></div></li></ol></>}
    </div>
  </div>;
}
export const SCREEN_QUESTIONS = [
  {label:'Tu SaaS',context:'PRODUCTO PROPIO',question:'Tus clientes guardan datos personales en tu plataforma. ¿Qué documentación debéis revisar?',topic:'Datos · contratos · documentación',href:'#/demo/documento'},
  {label:'Tu soporte',context:'SERVICIOS A TERCEROS',question:'Tu equipo entra en sistemas de clientes. ¿Están claros los permisos y las responsabilidades?',topic:'Accesos · responsabilidades · evidencias',href:'#/demo/soporte'},
  {label:'Tus clientes',context:'REQUISITOS DEL CLIENTE',question:'Un cliente te pide pruebas de tus medidas de seguridad. ¿Qué tienes preparado y qué falta?',topic:'Requisitos · evidencias · plan de trabajo',href:'#/demo/medidas'},
  {label:'Continuidad',context:'RECUPERACIÓN DEL SERVICIO',question:'Tienes copias de seguridad. ¿Has comprobado que puedes recuperar el servicio?',topic:'Prueba · incidencias · revisión',href:'#/demo/continuidad'},
  {label:'Tus contratos',context:'COMPROMISOS DEL SERVICIO',question:'Has prometido disponibilidad y soporte. ¿Quién sigue esos compromisos?',topic:'Contrato vigente · responsables · seguimiento',href:'#/demo/contrato'},
];
export function QuestionScreen({reduce}) {
  const [selected,setSelected]=useState(0),[count,setCount]=useState(0),[seen,setSeen]=useState(false);
  const ref=useRef(null),current=SCREEN_QUESTIONS[selected];
  useEffect(()=>{const observer=new IntersectionObserver(([e])=>{if(e.isIntersecting){setSeen(true);observer.disconnect();}},{threshold:.3});observer.observe(ref.current);return()=>observer.disconnect();},[]);
  useEffect(()=>{if(reduce || !seen || count>=current.question.length)return;const timer=setTimeout(()=>setCount(n=>Math.min(n+2,current.question.length)),38);return()=>clearTimeout(timer);},[count,selected,seen,reduce,current.question]);
  return <div className="computer-visual" ref={ref}><div className="computer-screen"><div className="computer-camera" aria-hidden="true"/><div className="screen-bar"><span>CASOS DE LA DEMO</span><span>Una pregunta. Un siguiente paso.</span><span className="screen-indicator"/></div><div className="computer-content"><div className="screen-tabs" aria-label="Preguntas por actividad">{SCREEN_QUESTIONS.map((q,i)=><button key={q.label} aria-pressed={selected===i} onClick={()=>{setSelected(i);setCount(0);}}>{q.label}</button>)}</div><span className="screen-context">{current.context}</span><div className="typed-question"><span aria-hidden="true">{reduce?current.question:current.question.slice(0,count)}<i className={count>=current.question.length || reduce?'question-cursor finished':'question-cursor'}/></span><span className="visually-hidden">{current.question}</span></div><div className="screen-topic">{current.topic}</div><a href={current.href} className="screen-open">Abrir esta tarea en la demo <span aria-hidden="true">↗</span></a></div></div><div className="computer-stand" aria-hidden="true"/><div className="computer-base" aria-hidden="true"/></div>;
}
