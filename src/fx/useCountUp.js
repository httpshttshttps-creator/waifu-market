import { useCallback, useEffect, useRef, useState } from "react";

// Counts a number up from 0 to `value` when `run()` is called - the little
// flourish when you tap a balance / count. Shared by the Home stats and the
// Market header's balance pill.
export function useCountUp(value) {
  const [shown, setShown] = useState(value);
  const raf = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    setShown(value);
  }, [value]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const run = useCallback(() => {
    const target = Number(value);
    if (!Number.isFinite(target) || target === 0) return;
    cancelAnimationFrame(raf.current);
    const start = performance.now();
    const DURATION = 750;
    const step = (now) => {
      const u = Math.min(1, (now - start) / DURATION);
      setShown(u >= 1 ? target : Math.round(target * (1 - Math.pow(1 - u, 3))));
      if (u < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, [value]);

  return [shown, run];
}
