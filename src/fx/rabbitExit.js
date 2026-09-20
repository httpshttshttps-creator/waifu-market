// Closing animation for the Sell sheet: a white rabbit drops from the top of
// the screen onto the sheet, is dizzy for a moment, shakes it off, then hops
// twice - the first landing rattles the sheet, the second slams it shut and
// it drops out of sight.
//
// Everything is on one timeline (ms from the start, see T below). Each moving
// part - rabbit motion, squash & stretch, ears, eyes, stars, the sheet, the
// backdrop - is its own Web Animation with keyframes placed on that timeline,
// all created in the same tick so they stay in sync.

import { play } from "../audio/engine.js";
import { prefersReducedMotion } from "./exitPresence.js";

const T = {
  land: 520,
  dizzyEnd: 1750,
  standEnd: 2050,
  jump1: { crouch: 2050, air: 2160, apex: 2350, land: 2510, settle: 2570 },
  jump2: { crouch: 2650, air: 2770, apex: 3000, land: 3190 },
  drop: 3250,
  end: 3700,
};

const W = 92;
const H = 104;

function star(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`);
  }
  return pts.join(" ");
}

const OUTLINE = 'fill="#fff" stroke="#dfe3ea" stroke-width="1.4"';

const RABBIT_SVG = `
<svg viewBox="0 0 100 112" width="${W}" height="${H}" overflow="visible" aria-hidden="true">
  <circle cx="80" cy="96" r="7.5" ${OUTLINE}/>
  <ellipse cx="50" cy="88" rx="27" ry="21" ${OUTLINE}/>
  <ellipse cx="34" cy="106" rx="13" ry="6.5" ${OUTLINE}/>
  <ellipse cx="66" cy="106" rx="13" ry="6.5" ${OUTLINE}/>
  <ellipse cx="41" cy="96" rx="7" ry="9" ${OUTLINE}/>
  <ellipse cx="59" cy="96" rx="7" ry="9" ${OUTLINE}/>
  <g class="bunny__ear bunny__ear--l">
    <ellipse cx="37" cy="19" rx="9.5" ry="23" transform="rotate(-8 37 19)" ${OUTLINE}/>
    <ellipse cx="37" cy="21" rx="4.6" ry="15.5" transform="rotate(-8 37 21)" fill="#ffc8d6"/>
  </g>
  <g class="bunny__ear bunny__ear--r">
    <ellipse cx="63" cy="19" rx="9.5" ry="23" transform="rotate(8 63 19)" ${OUTLINE}/>
    <ellipse cx="63" cy="21" rx="4.6" ry="15.5" transform="rotate(8 63 21)" fill="#ffc8d6"/>
  </g>
  <circle cx="50" cy="56" r="25" ${OUTLINE}/>
  <circle cx="34" cy="63" r="5" fill="#ffc8d6" opacity=".7"/>
  <circle cx="66" cy="63" r="5" fill="#ffc8d6" opacity=".7"/>
  <g class="bunny__eyes">
    <circle cx="40" cy="55" r="3.4" fill="#2a2a35"/><circle cx="60" cy="55" r="3.4" fill="#2a2a35"/>
    <circle cx="41" cy="53.8" r="1.1" fill="#fff"/><circle cx="61" cy="53.8" r="1.1" fill="#fff"/>
  </g>
  <g class="bunny__eyes-dizzy" opacity="0">
    <path class="bunny__spiral" d="M39 55 a1 1 0 1 1 2 0 a2.2 2.2 0 1 1 -4.4 0 a3.6 3.6 0 1 1 7.2 0 a5 5 0 1 1 -10 0" fill="none" stroke="#2a2a35" stroke-width="1.3"/>
    <path class="bunny__spiral" d="M59 55 a1 1 0 1 1 2 0 a2.2 2.2 0 1 1 -4.4 0 a3.6 3.6 0 1 1 7.2 0 a5 5 0 1 1 -10 0" fill="none" stroke="#2a2a35" stroke-width="1.3"/>
  </g>
  <path d="M47.5 62 h5 l-2.5 3.2 z" fill="#ff9db5"/>
  <path d="M50 65.2 v2 M50 67.2 q-3 3 -6 0 M50 67.2 q3 3 6 0" fill="none" stroke="#c98a9a" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M30 62 h-11 M31 66 l-10 3 M70 62 h11 M69 66 l10 3" stroke="#cfd4dc" stroke-width="1" stroke-linecap="round"/>
  <g class="bunny__stars" opacity="0">
    <polygon class="bunny__star" style="animation-delay:0s" points="${star(50, 30, 5)}" fill="#ffd94d"/>
    <polygon class="bunny__star" style="animation-delay:-0.37s" points="${star(50, 30, 4.2)}" fill="#fff3a0"/>
    <polygon class="bunny__star" style="animation-delay:-0.73s" points="${star(50, 30, 4.6)}" fill="#ffd94d"/>
  </g>
</svg>`;

export function runRabbitExit({ overlay, sheet, onDone }) {
  if (prefersReducedMotion() || !overlay || !sheet) {
    const t = setTimeout(onDone, 0);
    return () => clearTimeout(t);
  }

  overlay.dataset.silentClose = "true"; // no generic "sheet closed" whoosh at the end
  const rect = sheet.getBoundingClientRect();
  const vh = window.innerHeight;
  const dropDist = vh - rect.top + 60;
  const cx = rect.left + rect.width * 0.5 + 24;
  const restTop = rect.top - H + 12; // feet sink slightly into the sheet's top edge

  const bunny = document.createElement("div");
  bunny.className = "bunny";
  Object.assign(bunny.style, { left: `${cx - W / 2}px`, top: `${restTop}px`, width: `${W}px`, height: `${H}px` });
  bunny.innerHTML = `<div class="bunny__inner">${RABBIT_SVG}</div>`;
  overlay.appendChild(bunny);

  const inner = bunny.querySelector(".bunny__inner");
  const earL = bunny.querySelector(".bunny__ear--l");
  const earR = bunny.querySelector(".bunny__ear--r");
  const eyes = bunny.querySelector(".bunny__eyes");
  const eyesDizzy = bunny.querySelector(".bunny__eyes-dizzy");
  const stars = bunny.querySelector(".bunny__stars");

  const anims = [];
  const total = T.end;
  // Build one animation from [ms, props, easing?] steps on the shared timeline.
  const timeline = (el, steps, extra = {}) => {
    const frames = steps.map(([ms, props, easing]) => ({ offset: Math.min(1, ms / total), ...props, ...(easing ? { easing } : {}) }));
    if (frames[0].offset > 0) frames.unshift({ ...frames[0], offset: 0 });
    if (frames[frames.length - 1].offset < 1) frames.push({ ...frames[frames.length - 1], offset: 1, easing: "linear" });
    const anim = el.animate(frames, { duration: total, fill: "forwards", easing: "linear", ...extra });
    anims.push(anim);
    return anim;
  };

  const tr = (y = 0, rot = 0, x = 0) => ({ transform: `translate(${x}px, ${y}px) rotate(${rot}deg)` });
  const sq = (sx = 1, sy = 1) => ({ transform: `scale(${sx}, ${sy})` });
  const gravityIn = "cubic-bezier(0.55, 0.05, 0.9, 0.45)";
  const up = "cubic-bezier(0.2, 0.7, 0.4, 1)";
  const down = "cubic-bezier(0.6, 0, 0.9, 0.5)";

  // ---- where the rabbit is: fall, sway while dizzy, two hops, ride the sheet down ----
  timeline(bunny, [
    [0, tr(-(restTop + H + 60), 30), gravityIn],
    [T.land, tr(0, -6), "ease-out"],
    [T.land + 90, tr(0, 4)],
    [T.land + 250, tr(0, -12, -4), "ease-in-out"],
    [950, tr(0, 11, 4), "ease-in-out"],
    [1130, tr(0, -9, -3), "ease-in-out"],
    [1300, tr(0, 7, 2), "ease-in-out"],
    [1470, tr(0, -4, -1), "ease-in-out"],
    [1620, tr(0, 2), "ease-in-out"],
    [T.dizzyEnd, tr(0, 0), "ease-in-out"],
    [1810, tr(0, 6), "ease-in-out"],
    [1870, tr(0, -6), "ease-in-out"],
    [1930, tr(0, 5), "ease-in-out"],
    [T.standEnd, tr(0, 0)],
    [T.jump1.air, tr(0, 0), up],
    [T.jump1.apex, tr(-74, -8), down],
    [T.jump1.land, tr(0, 0)],
    [T.jump2.air, tr(0, 0), up],
    [T.jump2.apex, tr(-112, 8), down],
    [T.jump2.land, tr(0, 0)],
    [T.drop, tr(0, 0), "cubic-bezier(0.5, 0, 0.9, 0.4)"],
    [T.end, tr(dropDist, -4)],
  ]);

  // ---- squash & stretch (pivoting on the feet) ----
  timeline(inner, [
    [0, sq(0.9, 1.15)],
    [T.land, sq(0.9, 1.15), "ease-out"],
    [T.land + 40, sq(1.32, 0.62), "ease-out"],
    [T.land + 160, sq(0.96, 1.06), "ease-out"],
    [T.land + 250, sq(1, 1)],
    [T.standEnd, sq(1, 1)],
    [T.jump1.crouch + 100, sq(1.16, 0.8), "ease-out"],
    [T.jump1.air + 30, sq(0.9, 1.18)],
    [T.jump1.apex, sq(1, 1.02)],
    [T.jump1.land - 20, sq(0.94, 1.1)],
    [T.jump1.land + 30, sq(1.18, 0.78), "ease-out"],
    [T.jump1.settle + 20, sq(1, 1)],
    [T.jump2.crouch + 110, sq(1.22, 0.72), "ease-out"],
    [T.jump2.air + 30, sq(0.88, 1.22)],
    [T.jump2.apex, sq(1, 1.02)],
    [T.jump2.land - 20, sq(0.92, 1.12)],
    [T.jump2.land + 30, sq(1.26, 0.7), "ease-out"],
    [T.drop, sq(1.1, 0.86)],
    [T.drop + 120, sq(0.94, 1.12)],
    [T.end, sq(0.94, 1.12)],
  ]);
  inner.style.transformOrigin = "50% 100%";

  // ---- ears: streaming back in the fall, drooping when dizzy, perking up, flapping on hops ----
  const ear = (side) => (angle) => ({ transform: `rotate(${side * angle}deg)` });
  for (const [el, side] of [[earL, -1], [earR, 1]]) {
    const e = ear(side);
    timeline(el, [
      [0, e(-28)],
      [T.land, e(-30)],
      [T.land + 60, e(45), "ease-out"],
      [T.land + 400, e(34), "ease-in-out"],
      [1300, e(40), "ease-in-out"],
      [T.dizzyEnd, e(36)],
      [1900, e(-10), "cubic-bezier(0.3, 1.6, 0.5, 1)"],
      [T.standEnd, e(0)],
      [T.jump1.air, e(0)],
      [T.jump1.apex, e(-22), "ease-in-out"],
      [T.jump1.land, e(-18)],
      [T.jump1.land + 60, e(12), "ease-out"],
      [T.jump1.settle + 80, e(0)],
      [T.jump2.air, e(0)],
      [T.jump2.apex, e(-26), "ease-in-out"],
      [T.jump2.land, e(-20)],
      [T.jump2.land + 60, e(14)],
      [T.end, e(14)],
    ]);
  }

  // ---- eyes: dots -> spirals while dizzy -> dots, stars circling the head ----
  const swap = (el, visibleDuring) =>
    timeline(el, [
      [0, { opacity: visibleDuring ? 0 : 1 }],
      [T.land + 60, { opacity: visibleDuring ? 0 : 1 }],
      [T.land + 61, { opacity: visibleDuring ? 1 : 0 }],
      [T.dizzyEnd, { opacity: visibleDuring ? 1 : 0 }],
      [T.dizzyEnd + 1, { opacity: visibleDuring ? 0 : 1 }],
    ]);
  swap(eyes, false);
  swap(eyesDizzy, true);
  timeline(stars, [
    [0, { opacity: 0 }],
    [T.land + 80, { opacity: 0 }],
    [T.land + 220, { opacity: 1 }],
    [T.dizzyEnd - 150, { opacity: 1 }],
    [T.dizzyEnd + 60, { opacity: 0 }],
  ]);

  // ---- the sheet: dented by the landing, rattled by hop 1, slammed away by hop 2 ----
  const sheetPose = (y = 0, rot = 0) => ({ transform: `translateY(${y}px) rotate(${rot}deg)`, transformOrigin: "50% 100%" });
  const sheetAnim = timeline(sheet, [
    [0, sheetPose()],
    [T.land, sheetPose()],
    [T.land + 40, sheetPose(12), "ease-out"],
    [T.land + 180, sheetPose(-3), "ease-in-out"],
    [T.land + 300, sheetPose(0)],
    [T.jump1.land, sheetPose()],
    [T.jump1.land + 35, sheetPose(14, 0.3), "ease-out"],
    [T.jump1.land + 110, sheetPose(-5, -0.5), "ease-in-out"],
    [T.jump1.land + 190, sheetPose(6, 0.4), "ease-in-out"],
    [T.jump1.land + 270, sheetPose(-2, -0.2), "ease-in-out"],
    [T.jump1.land + 350, sheetPose()],
    [T.jump2.land, sheetPose()],
    [T.jump2.land + 40, sheetPose(18), "ease-out"],
    [T.drop, sheetPose(18), "cubic-bezier(0.5, 0, 0.9, 0.4)"],
    [T.end, sheetPose(dropDist + 40)],
  ]);

  // ---- the backdrop goes with it ----
  timeline(overlay, [
    [0, { opacity: 1 }],
    [T.drop + 40, { opacity: 1 }, "ease-in"],
    [T.end, { opacity: 0 }],
  ]);

  play("bunnyExit");

  let finished = false;
  sheetAnim.onfinish = () => {
    finished = true;
    onDone();
  };

  return () => {
    anims.forEach((a) => a.cancel());
    bunny.remove();
    delete overlay.dataset.silentClose;
    if (!finished) sheetAnim.onfinish = null;
  };
}
