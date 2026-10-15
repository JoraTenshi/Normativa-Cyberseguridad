import { createContext, useCallback, useMemo, useRef, useState } from 'react';

// Guards are synchronous: Enter/submission cannot race the button's next render.
export const ReferenceSelectionContext = createContext(null);
export function useReferenceGate() {
  const guards = useRef(new Map());
  const [, refresh] = useState(0);
  const notify = useCallback(() => refresh(value => value + 1), []);
  const context = useMemo(() => ({
    notify,
    register(id, guard) {
      guards.current.set(id, guard);
      notify();
      return () => { guards.current.delete(id); notify(); };
    },
  }), [notify]);
  const blockers = () => [...guards.current.values()].map(guard => guard()).filter(Boolean);
  return { context, blockers };
}
