import { useEffect } from 'react';

export function useJosePaid(onOpen) {
  useEffect(() => {
    const threshold = 160;

    const check = () => {
      const widthDiff  = window.outerWidth  - window.innerWidth  > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;
      if (widthDiff || heightDiff) onOpen();
    };

    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [onOpen]);
}