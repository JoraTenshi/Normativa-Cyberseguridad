/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
export const END_TIMING={reveal:2200,trace:2600,glow:900};
export const END_DURATION=END_TIMING.reveal+END_TIMING.trace+END_TIMING.glow;

export function endingPhaseAt(elapsed) {
  if(elapsed<END_TIMING.reveal)return 'reveal';
  if(elapsed<END_TIMING.reveal+END_TIMING.trace)return 'tracing';
  if(elapsed<END_DURATION)return 'glow';
  return 'done';
}

export function networkTiming(scenario) {
  const levels=scenario.network.map(()=>0),pending=scenario.network.map(()=>0);
  for(const [,to] of scenario.edges)pending[to]++;
  const queue=pending.flatMap((count,index)=>count===0?[index]:[]);
  for(let index=0;index<queue.length;index++){
    const from=queue[index];
    for(const [a,to] of scenario.edges)if(a===from){
      levels[to]=Math.max(levels[to],levels[from]+1);
      if(--pending[to]===0)queue.push(to);
    }
  }
  if(queue.length!==scenario.network.length)throw new Error('The activity network must be acyclic');
  return {arrivals:levels.map(level=>600+level*2200),cycle:(Math.max(...levels)+1)*2200};
}

export function nodeBreath(time,arrival) {
  const distance=Math.abs(time-arrival)/650;
  return distance>=1?0:(1+Math.cos(distance*Math.PI))/2;
}

export function edgePosition(a,b,progress) {
  const t=Math.max(0,Math.min(1,progress)),u=1-t,middle=(a[2]+b[2])/2;
  return {x:u*u*u*a[2]+3*u*u*t*middle+3*u*t*t*middle+t*t*t*b[2],y:u*u*u*a[3]+3*u*u*t*a[3]+3*u*t*t*b[3]+t*t*t*b[3]};
}

export function spineGeometry(width,height,end) {
  const x=8,start=12,bottom=Math.max(start+1,end?.y??height-12);
  if(!end)return {d:`M${x} ${start} V${bottom}`,length:bottom-start,end:{x,y:bottom}};
  const turn=Math.min(18,Math.max(1,(end.x-x)/2));
  return {d:`M${x} ${start} V${bottom-turn} Q${x} ${bottom} ${x+turn} ${bottom} H${end.x}`,
    length:Math.max(1,bottom-start+end.x-x),end};
}
