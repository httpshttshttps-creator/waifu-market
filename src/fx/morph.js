// The Sort/Filter button -> menu morph.
//
//   1. the rectangular button squeezes in from both sides into a small square
//   2. the square hops, then swings (spinning) to the middle of the screen
//   3. it springs open into the menu panel
//
// Only a lightweight stand-in box (`morph`) is animated; the real panel stays
// hidden until this finishes, then swaps in seamlessly and builds its own
// content. Phase 2 measures the panel when it starts (not when the sheet
// opens) so a list that finished loading in the meantime is accounted for.

const SQ = 46;

const box = (cx, cy, w, h, radius, rot = 0, extra = {}) => ({
  left: `${cx - w / 2}px`,
  top: `${cy - h / 2}px`,
  width: `${w}px`,
  height: `${h}px`,
  borderRadius: `${radius}px`,
  transform: `rotate(${rot}deg)`,
  ...extra,
});

export function runMorph({ morph, panel, from, onDone }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bc = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
  const center = { x: vw / 2, y: vh / 2 };
  const mid = { x: (bc.x + center.x) / 2 + 84, y: (bc.y + center.y) / 2 - 46 };
  const glow = "0 0 26px var(--gold)";
  const noGlow = "0 0 0 transparent";

  const label = morph.firstElementChild;
  const anims = [];
  let cancelled = false;

  // ---- phase 1: squeeze, hop, swing to the middle ----
  const phase1 = morph.animate(
    [
      { ...box(bc.x, bc.y, from.width, from.height, 14, 0, { boxShadow: noGlow }), offset: 0, easing: "cubic-bezier(0.65, 0, 0.35, 1)" },
      { ...box(bc.x, bc.y, SQ, SQ, 14, 0, { boxShadow: noGlow }), offset: 0.3, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" },
      { ...box(bc.x, bc.y - 16, SQ * 1.08, SQ * 1.08, 15, 0, { boxShadow: glow }), offset: 0.42, easing: "cubic-bezier(0.45, 0, 0.4, 1)" },
      { ...box(mid.x, mid.y, SQ * 1.14, SQ * 1.14, 16, 200, { boxShadow: glow }), offset: 0.72, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
      { ...box(center.x, center.y, SQ, SQ, 14, 360, { boxShadow: glow }), offset: 1 },
    ],
    { duration: 780, fill: "forwards" }
  );
  anims.push(phase1);

  // The label ("Sort / Filter") has no room once the button is a square.
  if (label) {
    anims.push(label.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 130, fill: "forwards", easing: "ease-in" }));
  }

  phase1.onfinish = () => {
    if (cancelled) return;
    // ---- phase 2: spring open into the panel ----
    const P = panel.getBoundingClientRect();
    const pc = { x: P.left + P.width / 2, y: P.top + P.height / 2 };
    const phase2 = morph.animate(
      [
        { ...box(center.x, center.y, SQ, SQ, 14, 360, { boxShadow: glow }), offset: 0, easing: "cubic-bezier(0.3, 0.9, 0.4, 1)" },
        { ...box(pc.x, pc.y, P.width + 12, P.height + 12, 26, 360, { boxShadow: noGlow }), offset: 0.7, easing: "ease-in-out" },
        { ...box(pc.x, pc.y, P.width, P.height, 22, 360, { boxShadow: noGlow }), offset: 1 },
      ],
      { duration: 440, fill: "forwards" }
    );
    anims.push(phase2);
    phase2.onfinish = () => {
      if (!cancelled) onDone();
    };
  };

  return () => {
    cancelled = true;
    anims.forEach((a) => a.cancel());
  };
}
