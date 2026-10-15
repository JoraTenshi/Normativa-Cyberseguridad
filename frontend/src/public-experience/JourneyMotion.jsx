/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
import React,{useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {edgePosition,endingPhaseAt,END_DURATION,spineGeometry} from './journey-motion.js';

export function useMotionClock(active) {
  const elapsed=useRef(0),[time,setTime]=useState(0);
  useEffect(()=>{
    if(!active)return;
    let frame,last=performance.now(),paint=last;
    const tick=now=>{
      elapsed.current+=Math.min(now-last,100);last=now;
      if(now-paint>=32){setTime(elapsed.current);paint=now;}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(frame);
  },[active]);
  return time;
}

export function useJourneyEnding({enabled,active,reduce,run}) {
  const elapsed=useRef(0),[phase,setPhase]=useState('idle');
  useLayoutEffect(()=>{
    elapsed.current=0;setPhase(!enabled?'idle':reduce?'done':'reveal');
  },[enabled,reduce,run]);
  useEffect(()=>{
    if(!enabled||!active||reduce||elapsed.current>=END_DURATION)return;
    let frame,last=performance.now();
    const tick=now=>{
      elapsed.current+=Math.min(now-last,100);last=now;
      setPhase(endingPhaseAt(elapsed.current));
      if(elapsed.current<END_DURATION)frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(frame);
  },[enabled,active,reduce,run]);
  return phase;
}

export function NetworkPath({a,b,progress,active}) {
  const id=useId(),middle=(a[2]+b[2])/2,point=edgePosition(a,b,progress);
  const d=`M${a[2]},${a[3]} C${middle},${a[3]} ${middle},${b[3]} ${b[2]},${b[3]}`;
  const visible=active&&progress>=-.15&&progress<=1.15;
  return <>
    <defs><radialGradient id={id} gradientUnits="userSpaceOnUse" cx={point.x} cy={point.y} r="13"><stop stopColor="var(--j-accent)"/><stop offset="1" stopColor="var(--j-accent)" stopOpacity="0"/></radialGradient></defs>
    <path className="journey-flow-base" d={d}/>
    <path className="journey-flow-pulse" d={d} style={{stroke:`url(#${id})`,opacity:visible ? .95 : 0}}/>
  </>;
}

export function JourneySpine({active,complete}) {
  const svg=useRef(null),id=useId(),time=useMotionClock(active);
  const [size,setSize]=useState({width:1,height:1,end:null});
  useLayoutEffect(()=>{
    const diagram=svg.current.parentElement;
    const measure=()=>{
      const rect=diagram.getBoundingClientRect(),mark=diagram.querySelector('.journey-completion-mark')?.getBoundingClientRect();
      setSize({width:rect.width,height:rect.height,end:mark?{x:mark.left-rect.left+mark.width/2,y:mark.top-rect.top+mark.height/2}:null});
    };
    measure();const observer=new ResizeObserver(measure);observer.observe(diagram);
    return()=>observer.disconnect();
  },[complete]);
  const geometry=spineGeometry(size.width,size.height,size.end);
  return <svg ref={svg} className="journey-spine" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden="true">
    <defs><radialGradient id={id} gradientUnits="userSpaceOnUse" cx="8" cy={size.height*(time%6000)/6000} r="90"><stop stopColor="var(--j-accent)"/><stop offset="1" stopColor="var(--j-accent)" stopOpacity="0"/></radialGradient></defs>
    <path className="journey-flow-base" d={geometry.d}/>
    <path className="journey-flow-pulse" d={geometry.d} style={{stroke:`url(#${id})`}}/>
    {complete&&<path className="journey-spine-trace" d={geometry.d} style={{'--trace-length':geometry.length,strokeDasharray:`${geometry.length} ${geometry.length}`}}/>}
    <circle className="journey-route-marker" cx="8" cy="12" r="6"/><circle className="journey-route-origin" cx="8" cy="12" r="2"/>
    {!complete&&<circle className="journey-route-marker" cx={geometry.end.x} cy={geometry.end.y} r="5"/>}
  </svg>;
}
