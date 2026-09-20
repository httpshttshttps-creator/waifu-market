import { useCallback, useReducer, useRef } from "react";

// Keeps a sheet mounted while its closing animation plays.
//
// Sheets are rendered conditionally by their parents (`open` / `character`),
// so the moment the parent flips to "closed" the sheet would vanish. This
// hook says "still mounted" until the exit animation calls finish():
//
//   const { mounted, exiting, finish } = useExitPresence(open);
//   useLayoutEffect(() => { if (exiting) return runExit({ onDone: finish }); }, [exiting]);
//   if (!mounted) return null;
//
// Re-opening mid-exit flips `exiting` back to false, which runs the effect's
// cleanup - so the animation is cancelled cleanly.
export function useExitPresence(active) {
  const [, rerender] = useReducer((n) => n + 1, 0);
  const state = useRef({ shown: active, done: !active });
  const s = state.current;

  if (active) {
    s.shown = true;
    s.done = false;
  }

  const exiting = !active && s.shown && !s.done;

  const finish = useCallback(() => {
    state.current.done = true;
    state.current.shown = false;
    rerender();
  }, []);

  return { mounted: active || exiting, exiting, finish };
}

export const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
