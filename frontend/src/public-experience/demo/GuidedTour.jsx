/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
import React, { useLayoutEffect, useRef, useState } from 'react';
import { TOUR_STEPS } from './help-model';
import { tourPosition } from './tour-position';
import CloseIcon from '../CloseIcon';

function Compass() {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="13" stroke="currentColor" strokeWidth="1.15" opacity=".65"/><path d="m26.5 13.5-3.9 9.1-9.1 3.9 3.9-9.1z" fill="currentColor"/><circle cx="20" cy="20" r="2.1" fill="#294238"/><path d="M20 4v3m0 26v3M4 20h3m26 0h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}

export default function GuidedTour({index,onStep,onExit,onArticle,storageError}) {
  const step=TOUR_STEPS[index], layer=useRef(null), card=useRef(null), title=useRef(null);
  const [position,setPosition]=useState(null), [missing,setMissing]=useState(false);
  const [moving,setMoving]=useState(false);
  useLayoutEffect(()=> {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setMoving(!reduced);
    if (reduced) return;
    const timer = setTimeout(()=>setMoving(false), 1350);
    return ()=>clearTimeout(timer);
  },[index]);

  useLayoutEffect(()=> {
    const dialog=layer.current;
    const previousOverflow=document.documentElement.style.overflow;
    document.documentElement.style.overflow='hidden';
    dialog.showModal();
    return ()=> {dialog.close();document.documentElement.style.overflow=previousOverflow;};
  },[]);

  useLayoutEffect(()=> {
    const target=document.querySelector(`[data-guide="${step.target}"]`);
    let frame=0;
    setMissing(!target);
    if(target) {
      target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
      // Leave vertical room for the explanation on mobile. Scroll the page,
      // not the tour card; the original scroll position is restored on exit.
      if(window.innerWidth<760) window.scrollBy({top:target.getBoundingClientRect().top-42,behavior:'instant'});
    }
    const measure=()=> {
      if(!card.current) return;
      const viewport={width:document.documentElement.clientWidth,height:window.visualViewport?.height || window.innerHeight};
      const rect=target?.getBoundingClientRect() || {left:viewport.width/2-1,right:viewport.width/2+1,top:70,bottom:72};
      const measured=card.current.getBoundingClientRect();
      const next=tourPosition(rect,{width:measured.width,height:measured.height},viewport);
      setPosition(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
    };
    const schedule=()=> {cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
    measure();
    // Position must commit first: a heading inside a still-hidden card cannot
    // receive focus on the initial step.
    const focusFrame=requestAnimationFrame(()=>title.current?.focus({preventScroll:true}));
    const observer=new ResizeObserver(schedule);
    observer.observe(card.current);
    if(target)observer.observe(target);
    window.addEventListener('resize',schedule);
    window.addEventListener('scroll',schedule,true);
    window.visualViewport?.addEventListener('resize',schedule);
    return ()=> {cancelAnimationFrame(frame);cancelAnimationFrame(focusFrame);observer.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);window.visualViewport?.removeEventListener('resize',schedule);};
  },[index]);

  const last=index===TOUR_STEPS.length-1;
  return <dialog ref={layer} className="help-tour-layer" aria-labelledby="floating-tour-title" aria-describedby="floating-tour-text" onCancel={e=>{e.preventDefault();onExit(false);}}>
    {position && !missing && <div className="help-focus-frame" aria-hidden="true" style={{transform:`translate(${position.target.left}px, ${position.target.top}px)`,width:position.target.width,height:position.target.height}} />}
    {position && <div className="help-compass" aria-hidden="true" style={{transform:`translate(${position.marker.left}px, ${position.marker.top}px)`}}><Compass /></div>}
    <section ref={card} className="help-floating-card" data-placement={position?.side} style={{transform:`translate(${position?.left ?? 14}px, ${position?.top ?? 14}px)`,visibility:position?'visible':'hidden'}}>
      <div className="help-floating-top"><span className="help-eyebrow">Tu guía · {index+1} / {TOUR_STEPS.length}</span><button disabled={moving} className="help-floating-close nc-close-control" aria-label="Guardar progreso y salir" title="Salir y continuar después" onClick={()=>onExit(false)}><CloseIcon/></button></div>
      <div key={index} className="help-floating-copy"><h2 id="floating-tour-title" ref={title} tabIndex={-1}>{step.title}</h2><p id="floating-tour-text">{step.text}</p>{missing && <p role="status" className="help-warning">Esta zona no está visible ahora. Puedes pasar al siguiente punto o salir sin perder el progreso.</p>}<button disabled={moving} className="help-back" onClick={()=>onArticle(step.article)}>Más sobre este tema ↗</button></div>
      <div className="help-route-progress" aria-hidden="true">{TOUR_STEPS.map((s,i)=><span key={s.id} className={i===index?'current':i<index?'passed':''}/>)}</div>
      <div className="help-floating-navigation"><button className="desk-outline" disabled={index===0 || moving} onClick={()=>onStep(index-1)}>Anterior</button><button className="desk-primary" disabled={moving} onClick={()=>last?onExit(true):onStep(index+1)}>{last?'Finalizar ruta':'Siguiente'}{!last && <span aria-hidden="true"> →</span>}</button></div>
      <div className="help-floating-exit"><button disabled={moving} onClick={()=>onExit(false)}>Salir y continuar después</button>{!last && <button disabled={moving} onClick={()=>onExit(true)}>Finalizar ruta</button>}</div>
      <small className="help-floating-hint">{moving ? 'Nos desplazamos… Puedes salir en cualquier momento con Esc.' : 'Salir guarda este paso. Finalizar cierra la ruta; podrás repetirla.'}</small>
      {storageError && <p role="status" className="help-warning">{storageError}</p>}
    </section>
  </dialog>;
}
