import { useEffect, useRef, useState } from 'react';
import './task-arrival.css';

// A presentation effect only: callers resolve the exact entity and guard drafts.
export default function useTaskArrival(identity, request, ready = true) {
  const target = useRef(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    setActive(false);
    if (!identity || !request || !ready || !target.current) return undefined;
    const element = target.current;
    let timer;
    const frame = requestAnimationFrame(() => {
      if (!element.isConnected) return;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      element.focus({ preventScroll: true });
      const behavior = reduced ? 'instant' : 'smooth';
      // A sticky detail can scroll independently of the page. Its header may
      // have viewport coordinates while still being clipped by that panel.
      let anchor = element;
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (!/(auto|scroll)/.test(getComputedStyle(parent).overflowY) || parent.scrollHeight <= parent.clientHeight) continue;
        const targetBox = element.getBoundingClientRect(), parentBox = parent.getBoundingClientRect();
        if (targetBox.top < parentBox.top + 12 || targetBox.bottom > parentBox.bottom - 12) {
          parent.scrollTo({ top: Math.max(0, parent.scrollTop + targetBox.top - parentBox.top - parent.clientTop - 12), behavior });
        }
        anchor = parent;
      }
      const box = anchor.getBoundingClientRect();
      if (box.top < 88 || box.bottom > window.innerHeight - 24) {
        anchor.scrollIntoView({ block: anchor === element ? 'center' : 'start', behavior });
      }
      setActive(true);
      timer = setTimeout(() => setActive(false), 2800);
    });
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [identity, request, ready]);
  return { target, active };
}
