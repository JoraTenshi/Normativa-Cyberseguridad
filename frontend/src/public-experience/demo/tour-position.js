/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
// Pure geometry for the guided tour. No persistence, DOM writes or task data.
const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min,max)));

export function tourPosition(target, card, viewport) {
  const margin = 14, gap = 32, markerSize = 40;
  const width = Math.min(card.width,viewport.width-margin*2);
  const height = Math.min(card.height,viewport.height-margin*2);
  const bounds = {
    left:clamp(target.left,margin,viewport.width-margin),
    top:clamp(target.top,margin,viewport.height-margin),
    right:clamp(target.right,margin,viewport.width-margin),
    bottom:clamp(target.bottom,margin,viewport.height-margin)
  };
  const centerX=(bounds.left+bounds.right)/2, centerY=(bounds.top+bounds.bottom)/2;
  const candidates=[
    {side:'right',left:bounds.right+gap,top:clamp(centerY-height/2,margin,viewport.height-height-margin)},
    {side:'left',left:bounds.left-gap-width,top:clamp(centerY-height/2,margin,viewport.height-height-margin)},
    {side:'below',left:clamp(centerX-width/2,margin,viewport.width-width-margin),top:bounds.bottom+gap},
    {side:'above',left:clamp(centerX-width/2,margin,viewport.width-width-margin),top:bounds.top-gap-height}
  ];
  // On a narrow screen use the space below/above, never a fixed footer.
  const preferred=viewport.width<760 ? [candidates[2],candidates[3],candidates[0],candidates[1]] : candidates;
  let chosen=preferred.find(p=>p.left>=margin && p.top>=margin && p.left+width<=viewport.width-margin && p.top+height<=viewport.height-margin);
  if(!chosen) {
    // Oversized targets/tiny viewports: retain every control in view. The marker
    // and outline keep the target identifiable even when no disjoint fit exists.
    const below=viewport.height-bounds.bottom >= bounds.top;
    chosen={side:below?'below':'above',left:clamp(centerX-width/2,margin,viewport.width-width-margin),top:below?viewport.height-height-margin:margin};
  }
  const {side,left,top}=chosen;
  const marker = side==='right' ? {x:left-gap/2-markerSize/2,y:clamp(centerY-markerSize/2,top+12,top+height-markerSize-12)}
    : side==='left' ? {x:left+width+gap/2-markerSize/2,y:clamp(centerY-markerSize/2,top+12,top+height-markerSize-12)}
    : {x:clamp(centerX-markerSize/2,left+16,left+width-markerSize-16),y:side==='below'?top-gap/2-markerSize/2:top+height+gap/2-markerSize/2};
  return {left,top,width,height,side,marker:{left:clamp(marker.x,6,viewport.width-markerSize-6),top:clamp(marker.y,6,viewport.height-markerSize-6)},target:{left:bounds.left-5,top:bounds.top-5,width:Math.max(1,bounds.right-bounds.left+10),height:Math.max(1,bounds.bottom-bounds.top+10)}};
}
