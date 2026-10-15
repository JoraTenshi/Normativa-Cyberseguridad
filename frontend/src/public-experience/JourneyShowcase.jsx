/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
import React, { useEffect, useId, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { INTRO_TIMING, JOURNEYS, JOURNEY_STAGES, JOURNEY_START, journeyReducer } from './journey-model.js';
import { JOURNEY_NARRATIVES, journeyChecks } from './journey-narratives.js';
import { networkTiming, nodeBreath } from './journey-motion.js';
import { JourneySpine, NetworkPath, useMotionClock, useJourneyEnding } from './JourneyMotion.jsx';
import './journey.css';
import './journey-frame.css';
import './journey-return.css';

function FrameControlIcon({kind}) {
  const paths={activities:'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',replay:'M4 10a8 8 0 1 1 1 8M4 4v6h6',check:'m5 12 4 4L19 6'};
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]}/></svg>;
}

function Symbol({kind}) {
  const paths={
    cloud:'M7 18H6a4 4 0 0 1-1-8 7 7 0 0 1 13-2 5 5 0 0 1 0 10h-1M9 16l3-3 3 3m-3-3v9',
    tools:'M14 5a5 5 0 0 0-6 6l-5 5a2 2 0 0 0 3 3l5-5a5 5 0 0 0 6-6l-3 3-3-3zM16 15l5 5m-2-7 3 3',
    civic:'m2 8 10-5 10 5H2zm3 3v8m5-8v8m4-8v8m5-8v8M2 22h20M4 19h16',
    radar:'M3 3h18v14H3zM8 21h8m-4-4v4M5 11h3l2-5 4 8 2-4h3',
    code:'m7 8-4 4 4 4m10-8 4 4-4 4M14 4l-4 16',
    target:'M20 12a8 8 0 1 1-8-8m4 8a4 4 0 1 1-4-4m0 4 8-8m-2-2v4h4',
    compass:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0m-7-3-2 6-6 2 2-6z',
    database:'M20 5c0 2-16 2-16 0s16-2 16 0v14c0 3-16 3-16 0V5m0 7c0 3 16 3 16 0',
    document:'M5 2h9l5 5v15H5zM14 2v6h5M8 12h8m-8 4h6',
    inventory:'M6 4h14v17H4V6m4-4h6v4H8zM8 10h8m-8 4h8m-8 4h5',
    key:'M14 9a5 5 0 1 1-5-5 5 5 0 0 1 5 5m-2 4 8 8m-4-4 3-3m-6 0 3-3M7 7h.01',
    users:'M10 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0m-8 13v-4c0-4 10-4 10 0v4m5-16a3 3 0 0 1 0 6m-1 3c4 0 6 1 6 4v3',
    server:'M3 3h18v7H3zm0 11h18v7H3zM6 6h.01M6 17h.01M12 6h6m-6 11h6',
    alert:'m12 3 10 18H2zm0 6v5m0 3h.01',
    company:'M4 22V7h16v15M8 7V2h8v5M8 11h2m4 0h2M8 15h2m4 0h2M10 22v-3h4v3',
    layers:'m2 7 10-5 10 5-10 5zm0 5 10 5 10-5M2 17l10 5 10-5',
    package:'m3 6 9-4 9 4v13l-9 4-9-4zm0 0 9 5 9-5m-9 5v12M7 4l10 5v4',
    plan:'m2 6 2 2 4-5m4 3h10M2 14l2 2 4-5m4 3h10M3 22h4m5 0h10',
    shield:'M12 2 3 6v6c0 5 5 8 9 10 4-2 9-5 9-10V6zm-5 10 3 3 7-7',
    handshake:'m2 8 4-4 5 2 3-2 8 5-4 9-5 3-7-5zm4 1 5-3m0 0-3 5 3 2 3-3 5 5',
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]||paths.company}/></svg>;
}

function ExpandableCard({node,index=0,type,open,onToggle}) {
  const id=useId();
  return <article className={'journey-expand-card journey-'+type} data-expanded={open} style={{'--node-delay':`${index*(type==='review'?500:250)}ms`}}>
    <button className={type==='plan-expand'?'journey-plan-card':'journey-node'} aria-label={'Ver detalle: '+node.title} aria-expanded={open} aria-controls={id} onClick={onToggle}>
      <span className={type==='plan-expand'?'journey-mini-orb':'journey-node-icon'}><Symbol kind={node.icon}/></span>
      <span><strong>{node.title}</strong><small>{node.summary}</small></span>
      <svg className="journey-card-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m5 7 5 5 5-5"/></svg>
    </button>
    <div className="journey-inline-detail" id={id} aria-hidden={!open} inert={!open}><div><p>{node.text}</p></div></div>
  </article>;
}

function PhaseHeading({title,explanation,headingRef,scenario}) {
  return <header className="journey-phase-heading">
    <div className="journey-phase-title-row">
      <h3 className="journey-phase-title" ref={headingRef} tabIndex={headingRef?-1:undefined}>{title}</h3>
      {scenario&&<span className="journey-activity-tag"><Symbol kind={scenario.icon}/>{scenario.label}</span>}
    </div>
    <p>{explanation}</p>
  </header>;
}

function EmergingPhase({className,label,children}) {
  return <div className="journey-phase-reveal"><section className={'journey-phase '+className} aria-label={label}>{children}</section></div>;
}

function ActivityNetwork({scenario,active}) {
  const clock=useMotionClock(active),{arrivals,cycle}=networkTiming(scenario),time=clock%cycle;
  return <div className={'journey-network network-'+scenario.id} aria-label={'Actividad: '+scenario.intro}>
    <svg className="journey-wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {scenario.edges.map(([from,to],i)=><NetworkPath key={i} a={scenario.network[from]} b={scenario.network[to]} active={active} progress={(time-arrivals[from])/(arrivals[to]-arrivals[from])}/>)}
    </svg>
    {scenario.network.map(([icon,label,x,y],i)=>{const breath=active?nodeBreath(time,arrivals[i]):0;return <div key={label} className="journey-network-node" style={{left:x+'%',top:y+'%','--node-delay':`${i*160}ms`}}><span style={{transform:`scale(${1+breath*.085})`,'--breath':`${breath*65}%`}}><Symbol kind={icon}/></span><b>{label}</b></div>;})}
  </div>;
}

export default function JourneyShowcase({reduce}) {
  const [state,dispatch]=useReducer(journeyReducer,JOURNEY_START);
  const [inView,setInView]=useState(false),[hidden,setHidden]=useState(document.hidden),[origin,setOrigin]=useState(null);
  const root=useRef(null),space=useRef(null),heading=useRef(null),completion=useRef(null),lastActivity=useRef(null),lastMode=useRef('picker');
  const [endInView,setEndInView]=useState(false);
  const scenario=JOURNEYS.find(c=>c.id===state.id),entering=['gather','bloom'].includes(state.mode),returning=['return-bloom','return-gather'].includes(state.mode),transitioning=entering||returning;
  const narrative=scenario?JOURNEY_NARRATIVES[scenario.id]:null;
  const endingActive=endInView&&!hidden&&!state.detail&&state.mode==='diagram';
  const ending=useJourneyEnding({enabled:state.stage===3&&state.mode==='diagram',active:endingActive,reduce,run:state.run});
  const flowActive=inView&&!hidden&&!reduce&&!state.detail&&state.mode==='diagram'&&['idle','reveal'].includes(ending);
  useEffect(()=>{
    setEndInView(false);
    if(!completion.current)return;
    const observer=new IntersectionObserver(([entry])=>setEndInView(entry.isIntersecting),{threshold:.7});
    observer.observe(completion.current);return()=>observer.disconnect();
  },[state.stage,state.mode,state.run]);
  useLayoutEffect(()=>{
    if(!returning||origin?.returnMeasured)return;
    const picker=space.current?.querySelector('.journey-picker');
    const orb=picker?.querySelector(`[data-activity="${state.id}"] .journey-orb`);
    if(!orb)return;
    const a=orb.getBoundingClientRect(),b=space.current.getBoundingClientRect(),pickerHeight=picker.getBoundingClientRect().height;
    setOrigin(previous=>({...previous,left:a.left-b.left,top:a.top-b.top,width:a.width,pickerHeight,returnMeasured:true,
      dx:previous.returnFrom?previous.returnFrom.x-(a.left-b.left):b.width/2-(a.left-b.left)-a.width/2,
      dy:previous.returnFrom?previous.returnFrom.y-(a.top-b.top):pickerHeight*.43-(a.top-b.top)-a.height/2}));
  },[returning,origin?.returnMeasured,state.id]);
  useEffect(()=>{
    const observer=new IntersectionObserver(([e])=>setInView(e.isIntersecting),{threshold:.2});observer.observe(root.current);
    const onVisibility=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',onVisibility);
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);};
  },[]);
  useEffect(()=>{
    if(reduce && state.id && (state.mode!=='diagram' || !state.manual)) dispatch({type:'reduce'});
  },[reduce,state.id,state.mode,state.manual]);
  useEffect(()=>{
    if((!inView&&!transitioning) || hidden || reduce || state.detail || state.mode==='picker')return;
    const delay=['gather','return-gather'].includes(state.mode)?INTRO_TIMING.gather:['bloom','return-bloom'].includes(state.mode)?INTRO_TIMING.bloom:state.stage<3&&!state.manual?(state.stage===1?INTRO_TIMING.review:INTRO_TIMING.read):null;
    if(delay===null)return;
    const timer=setTimeout(()=>dispatch({type:'tick'}),delay);return()=>clearTimeout(timer);
  },[state.mode,state.stage,state.manual,state.detail,state.run,inView,hidden,reduce,transitioning]);
  useEffect(()=>{
    if(state.mode==='diagram' && lastMode.current!=='diagram')heading.current?.focus({preventScroll:true});
    if(state.mode==='picker' && lastMode.current!=='picker')root.current?.querySelector(`[data-activity="${lastActivity.current}"]`)?.focus({preventScroll:true});
    lastMode.current=state.mode;
  },[state.mode]);
  const choose=(event,c)=>{
    const a=event.currentTarget.querySelector('.journey-orb').getBoundingClientRect(),b=space.current.getBoundingClientRect();
    setOrigin({left:a.left-b.left,top:a.top-b.top,width:a.width,height:b.height,dx:b.width/2-(a.left-b.left)-a.width/2,dy:b.height*.43-(a.top-b.top)-a.height/2});
    lastActivity.current=c.id;dispatch({type:'choose',id:c.id,reduce});
  };
  const toggleDetail=node=>dispatch(state.detail?.title===node.title?{type:'close'}:{type:'detail',node});
  const showStart=()=>root.current?.scrollIntoView({behavior:reduce?'instant':'smooth',block:'start'});
  const reset=()=>{
    if(returning||state.mode==='picker')return;
    const b=space.current.getBoundingClientRect(),travel=space.current.querySelector('.journey-travel')?.getBoundingClientRect();
    setOrigin(previous=>({...previous,height:b.height,returnMeasured:false,
      toolbarHeight:root.current.querySelector('.journey-toolbar')?.getBoundingClientRect().height||0,
      footerHeight:root.current.querySelector('.journey-footer')?.getBoundingClientRect().height||0,
      returnFrom:state.mode==='gather'&&travel?{x:travel.left-b.left,y:travel.top-b.top}:null,
      returnScale:state.mode==='gather'&&travel&&previous?.width?travel.width/previous.width:1.28}));
    dispatch({type:'back',reduce});showStart();
  };
  const replay=()=>{dispatch({type:'replay',reduce});showStart();};
  const detailButton=(node,index,type)=><ExpandableCard key={node.title} node={node} index={index} type={type} open={state.detail?.title===node.title} onToggle={()=>toggleDetail(node)}/>;
  return <section ref={root} className={'flow-map journey-shell journey-frame journey-flow mode-'+state.mode+(reduce?' journey-reduced':'')} data-tone={scenario?.tone||'sage'} data-flow-active={flowActive} data-ending={ending} data-ending-active={endingActive} aria-label="Explora cómo funciona para tu actividad" onKeyDown={e=>{if(e.key==='Escape'){if(state.detail){e.stopPropagation();dispatch({type:'close'});}else if(state.mode!=='picker')reset();}}}>
    <header className="journey-heading">
      <h2>De tu actividad a tu plan</h2>
      {state.mode!=='picker'&&<div className="journey-toolbar" inert={returning} aria-hidden={returning||undefined} style={returning?{'--return-toolbar-height':origin?.toolbarHeight+'px'}:undefined}>
        <button className="journey-replay" onClick={replay}><FrameControlIcon kind="replay"/><span>Repetir recorrido</span></button>
        <div className="journey-progress" role="progressbar" aria-label="Progreso del recorrido" aria-valuemin={1} aria-valuemax={4} aria-valuenow={state.stage+1} aria-valuetext={`Paso ${state.stage+1} de 4: ${JOURNEY_STAGES[state.stage]}`}>
          <span className="journey-progress-label">Paso <strong>{state.stage+1}</strong> de 4</span>
          <div className="journey-progress-track" aria-hidden="true">{JOURNEY_STAGES.map((step,i)=><span key={step} className={i<=state.stage?'is-reached':''}/>)}</div>
        </div>
        <button className="journey-switch" onClick={reset}><FrameControlIcon kind="activities"/><span>Cambiar de actividad</span></button>
      </div>}
    </header>
    <div className="journey-space" ref={space} style={transitioning&&origin?{height:state.mode==='return-gather'?(origin.pickerHeight||origin.height):origin.height}:undefined}>
      {state.mode!=='diagram' && <div className={'journey-picker'+(entering?' is-leaving':'')} inert={transitioning} aria-hidden={transitioning||undefined}>
        <h3>¿A qué se dedica tu empresa?</h3><p>Elige una de las siguientes actividades y descubre cómo se organizan sus requisitos, documentos y tareas.</p>
        <div className="journey-activities">{JOURNEYS.map(c=><button key={c.id} className="journey-activity" data-activity={c.id} data-return-selected={returning&&c.id===state.id||undefined} data-tone={c.tone} onClick={e=>choose(e,c)} aria-label={'Explorar '+c.label}><span className="journey-orb"><Symbol kind={c.icon}/></span><strong>{c.label}</strong>{c.subtitle&&<small>{c.subtitle}</small>}</button>)}</div>
      </div>}
      {transitioning && origin && <div className={'journey-travel travel-'+state.mode} style={{left:origin.left,top:origin.top,width:origin.width,height:origin.width,'--dx':origin.dx+'px','--dy':origin.dy+'px','--return-scale':origin.returnScale||1.28}} aria-hidden="true"><span className="journey-orb"><Symbol kind={scenario.icon}/></span><i/></div>}
      {state.mode==='gather' && <div className="journey-transform-caption" aria-live="polite"><strong>{scenario.label}</strong></div>}
      {['bloom','diagram','return-bloom'].includes(state.mode) && <div className="journey-diagram" key={state.run} inert={state.mode!=='diagram'} aria-hidden={returning||undefined}>
        <JourneySpine active={flowActive} complete={state.stage===3}/>
        <EmergingPhase className="journey-activity-phase" label="Paso 1: tu actividad">
          <PhaseHeading title="01 · TU ACTIVIDAD" explanation={narrative.explanations[0]} headingRef={heading} scenario={scenario}/>
          <ActivityNetwork scenario={scenario} active={flowActive}/>
        </EmergingPhase>
        {state.stage>=1&&<EmergingPhase className="journey-review-phase" label="Paso 2: qué necesitas revisar">
          <PhaseHeading title="02 · QUÉ NECESITAS REVISAR" explanation={narrative.explanations[1]}/>
          <div className="journey-branch journey-review-grid">{journeyChecks(scenario).map((n,i)=>detailButton(n,i,'review'))}</div>
          <span className="journey-reference">{scenario.reference}</span>
        </EmergingPhase>}
        {state.stage>=2&&<EmergingPhase className="journey-documents" label="Paso 3: documentos que reúnes">
          <PhaseHeading title="03 · DOCUMENTOS QUE REÚNES" explanation={narrative.explanations[2]}/>
          <div className="journey-branch">{scenario.documents.map((n,i)=>detailButton({...n,summary:narrative.documentNotes[i]},i,'document'))}</div>
        </EmergingPhase>}
        {state.stage>=3&&<EmergingPhase className="journey-plan-layer" label="Paso 4: plan de trabajo">
          <PhaseHeading title="04 · PLAN DE TRABAJO" explanation={narrative.explanations[3]}/>
          {detailButton({...scenario.plan,summary:'Coordina: '+scenario.plan.owner},0,'plan-expand')}
          <ol className="journey-plan-steps">{narrative.actions.map((action,i)=><li key={action.title} style={{'--node-delay':`${i*400}ms`}}><span>{i+1}</span><div><strong>{action.title}</strong><small className="journey-action-owner">{action.owner}</small><p><b>Resultado</b>{action.result}</p></div></li>)}</ol>
        </EmergingPhase>}
        {state.stage===3&&<div ref={completion} className="journey-finish" role="status"><span className="journey-completion-mark"><FrameControlIcon kind="check"/></span><strong>Recorrido completado</strong></div>}
      </div>}
    </div>
    {state.mode==='diagram'&&state.stage<3&&<footer className="journey-footer">
        <div className="journey-controls" role="group" aria-label="Controles del recorrido">
          <button onClick={()=>dispatch({type:'all'})}>Ver esquema completo</button><button className="journey-next" onClick={()=>dispatch({type:'next'})}>Siguiente fase <span aria-hidden="true">→</span></button>
        </div>
    </footer>}
  </section>;
}
