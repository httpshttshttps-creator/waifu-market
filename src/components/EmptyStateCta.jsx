import { useRef } from "react";
import { sparkBurst } from "../fx/sparks.js";
import { play } from "../audio/engine.js";

// The call-to-action button shown when a list has nothing to show ("Clear
// filters" in the Market, "Browse the Market" on Home): pops in, keeps a
// soft pulse/shimmer going so it's noticed, squashes when pressed and throws
// off sparks when clicked.
export default function EmptyStateCta({ children, onClick }) {
  const ref = useRef(null);

  function handleClick(event) {
    if (ref.current) sparkBurst(ref.current.getBoundingClientRect());
    play("sparkle");
    onClick?.(event);
  }

  return (
    <button ref={ref} type="button" className="empty-state__cta" data-click-sound="none" onClick={handleClick}>
      <span className="empty-state__cta-label">{children}</span>
    </button>
  );
}
