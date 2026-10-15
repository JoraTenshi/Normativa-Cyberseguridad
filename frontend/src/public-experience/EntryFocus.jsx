/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
import React, { useEffect, useRef, useState } from 'react';
import { tourPosition } from './demo/tour-position.js';
import { anchorBehavior } from './landing-model.js';
import CloseIcon from './CloseIcon';

export const ENTRY_CUES = {
  basis:{selector:'.desk-reference-tabs',title:'Esta es la referencia de la tarea',text:'Aquí tienes el precepto seleccionado. Debajo puedes leer qué establece, por qué se revisa y qué trabajo está relacionado.'},
  work:{selector:'.desk-inline-fields',title:'Aquí organizas el siguiente paso',text:'Estos controles cambian el estado, la persona responsable y la fecha. La documentación y el contexto están justo debajo.'},
  document:{selector:'.case-reader-index',title:'Estás dentro del documento',text:'Usa estos apartados para ir al contenido concreto. Después puedes volver directamente a su tarea.'},
};

export default function EntryFocus({kind,onDismiss}) {
  const cue=ENTRY_CUES[kind],card=useRef(null),heading=useRef(null);
  const [position,setPosition]=useState(null);
  useEffect(()=>{
    let target,observer,frame=0,focusFrame=0;
    const previous=document.activeElement;
    const measure=()=>{
      if(!target?.isConnected || !card.current)return;
      const r=target.getBoundingClientRect(),height=window.visualViewport?.height||innerHeight;
      // Keep the cue attached to visible content, including after a resize or manual scroll.
      if(r.bottom<=0 || r.top>=height){setPosition(null);return;}
      const size=card.current.getBoundingClientRect();
      setPosition(tourPosition(r,size,{width:document.documentElement.clientWidth,height}));
    };
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
    const dismiss=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onDismiss();}};
    const timer=setTimeout(()=>{
      target=document.querySelector(cue.selector);
      if(!target){onDismiss();return;}
      target.classList.add('entry-highlight');
      target.setAttribute('data-entry-highlight',kind);
      target.scrollIntoView({behavior:anchorBehavior(window.matchMedia('(prefers-reduced-motion: reduce)').matches),block:'center',inline:'nearest'});
      observer=new ResizeObserver(schedule);observer.observe(target);if(card.current)observer.observe(card.current);
      window.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
      document.addEventListener('keydown',dismiss,true);schedule();
      focusFrame=requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));
    },700);
    return()=>{clearTimeout(timer);cancelAnimationFrame(frame);cancelAnimationFrame(focusFrame);observer?.disconnect();target?.classList.remove('entry-highlight');target?.removeAttribute('data-entry-highlight');window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);document.removeEventListener('keydown',dismiss,true);if(previous?.isConnected)previous.focus?.({preventScroll:true});};
  },[kind]);
  return <section ref={card} className="entry-cue" aria-label="Ayuda de entrada a la demo" style={{left:position?.left??14,top:position?.top??14,visibility:position?'visible':'hidden'}}>
    <div className="entry-cue-heading"><span aria-hidden="true">✦</span><span>ESTÁS AQUÍ</span><button type="button" className="nc-close-control" aria-label="Cerrar indicación" onClick={onDismiss}><CloseIcon/></button></div><h2 ref={heading} tabIndex={-1}>{cue.title}</h2><p>{cue.text}</p><button type="button" className="entry-continue" onClick={onDismiss}>Entendido, continuar →</button>
  </section>;
}
