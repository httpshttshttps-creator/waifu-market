// Tapping the "VYRO MARKET" title: a panel the size of the title is pushed
// back into the wall like a button being pressed in, then its two halves
// slide apart like a hidden door. Behind it: a plank of wood with a smiley
// painted in blood, blood running down from it and dripping out past the
// bottom of the plank. After a few seconds the door slides shut and the
// panel comes back out.
//
// Everything is on one timeline (see T, ms) built from Web Animations, plus
// a small sound sequence (audio/synth.js "marketDoor") on the same clock.

import { play } from "../audio/engine.js";
import { prefersReducedMotion } from "./exitPresence.js";

const PAD_X = 12;
const PAD_Y = 6;
const BLOOD = "#7d0c0c";
const BLOOD_DARK = "#4d0606";

const T = {
  pressEnd: 430,
  openStart: 640,
  openEnd: 1320,
  closeStart: 4300,
  closeEnd: 4870,
  backEnd: 5260,
};

let active = null;

const rand = (a, b) => a + Math.random() * (b - a);

function woodSvg(W, H) {
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(H * 0.42, 22);
  const grain = Array.from({ length: 9 }, (_, i) => {
    const y = (H / 9) * (i + 0.5) + rand(-2, 2);
    const amp = rand(0.6, 1.8);
    return `<path d="M0 ${y.toFixed(1)} Q ${(W * 0.25).toFixed(0)} ${(y - amp).toFixed(1)} ${(W * 0.5).toFixed(0)} ${y.toFixed(1)} T ${W} ${(y + rand(-1, 1)).toFixed(1)}" fill="none" stroke="rgba(0,0,0,${rand(0.15, 0.35).toFixed(2)})" stroke-width="${rand(0.5, 1.2).toFixed(1)}"/>`;
  }).join("");
  const nail = (x, y) =>
    `<circle cx="${x}" cy="${y}" r="1.9" fill="#1d130c"/><circle cx="${x - 0.5}" cy="${y - 0.5}" r="0.7" fill="#6b5a4a"/>`;
  return `
<svg class="mdoor__wood-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <linearGradient id="mw-base" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a2f1b"/><stop offset=".5" stop-color="#3a2415"/><stop offset="1" stop-color="#2b1a10"/>
    </linearGradient>
    <radialGradient id="mw-vig" cx=".5" cy=".5" r=".75">
      <stop offset=".55" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,0,0,.6)"/>
    </radialGradient>
    <filter id="mw-rough" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#mw-base)"/>
  ${grain}
  <ellipse cx="${(W * 0.82).toFixed(0)}" cy="${(H * 0.32).toFixed(0)}" rx="5" ry="3.2" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="1"/>
  <ellipse cx="${(W * 0.82).toFixed(0)}" cy="${(H * 0.32).toFixed(0)}" rx="2.4" ry="1.5" fill="rgba(0,0,0,.35)"/>
  <path d="M${(W * 0.08).toFixed(0)} 0 L ${(W * 0.1).toFixed(0)} ${H}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>
  <rect width="${W}" height="${H}" fill="url(#mw-vig)"/>
  ${nail(5, 5)}${nail(W - 5, 5)}${nail(5, H - 5)}${nail(W - 5, H - 5)}
  <g class="mdoor__smiley" filter="url(#mw-rough)" fill="none" stroke="${BLOOD}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${(cx - r).toFixed(1)} ${cy.toFixed(1)} C ${(cx - r).toFixed(1)} ${(cy - r * 1.12).toFixed(1)}, ${(cx + r).toFixed(1)} ${(cy - r * 1.12).toFixed(1)}, ${(cx + r + 0.6).toFixed(1)} ${(cy + 0.5).toFixed(1)} C ${(cx + r).toFixed(1)} ${(cy + r * 1.1).toFixed(1)}, ${(cx - r).toFixed(1)} ${(cy + r * 1.1).toFixed(1)}, ${(cx - r + 0.8).toFixed(1)} ${(cy - r * 0.15).toFixed(1)}" stroke-width="2.6"/>
    <ellipse class="mdoor__eye mdoor__eye--l" cx="${(cx - r * 0.38).toFixed(1)}" cy="${(cy - r * 0.22).toFixed(1)}" rx="${(r * 0.1).toFixed(1)}" ry="${(r * 0.18).toFixed(1)}" fill="${BLOOD}" stroke-width="1"/>
    <ellipse class="mdoor__eye mdoor__eye--r" cx="${(cx + r * 0.36).toFixed(1)}" cy="${(cy - r * 0.2).toFixed(1)}" rx="${(r * 0.13).toFixed(1)}" ry="${(r * 0.22).toFixed(1)}" fill="${BLOOD}" stroke-width="1"/>
    <path class="mdoor__smile" d="M${(cx - r * 0.62).toFixed(1)} ${(cy + r * 0.22).toFixed(1)} Q ${cx.toFixed(1)} ${(cy + r * 0.98).toFixed(1)} ${(cx + r * 0.64).toFixed(1)} ${(cy + r * 0.18).toFixed(1)}" stroke-width="2.4"/>
    <path d="M${(cx - r * 0.66).toFixed(1)} ${(cy + r * 0.2).toFixed(1)} l -1.6 -2.4 M${(cx + r * 0.68).toFixed(1)} ${(cy + r * 0.16).toFixed(1)} l 1.6 -2.4" stroke-width="1.6"/>
  </g>
</svg>`;
}

function makeDrips(W, H, EXTRA) {
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(H * 0.42, 22);
  // [x, y start, length, width] - eyes, mouth corners, rim of the face.
  const spec = [
    [cx - r * 0.38, cy - r * 0.05, H * 0.55 + EXTRA * 0.9, 2.2],
    [cx + r * 0.36, cy - r * 0.02, H * 0.5 + EXTRA * 0.55, 2.6],
    [cx - r * 0.62, cy + r * 0.3, H * 0.45 + EXTRA * 1.0, 2.6],
    [cx + r * 0.66, cy + r * 0.26, H * 0.5 + EXTRA * 0.75, 2.0],
    [cx - r * 0.05, cy + r * 0.98, H * 0.3 + EXTRA * 0.6, 3.0],
    [cx + r * 0.45, cy + r * 0.9, H * 0.35 + EXTRA * 0.95, 1.8],
    [cx - r * 0.95, cy + r * 0.1, H * 0.4 + EXTRA * 0.5, 1.7],
    [cx + r * 0.98, cy + r * 0.05, H * 0.42 + EXTRA * 0.7, 2.2],
  ];
  return spec.map(([x, y, len, w], i) => ({ x, y, len, w, delay: 900 + i * 170 + rand(0, 200), dur: rand(2100, 3300) }));
}

export function cancelMarketDoor() {
  active?.cancel();
}

export function runMarketDoor(titleEl) {
  if (active || prefersReducedMotion() || !titleEl) return false;

  const range = document.createRange();
  range.selectNodeContents(titleEl);
  const text = range.getBoundingClientRect();
  const R = {
    left: text.left - PAD_X,
    top: text.top - PAD_Y,
    width: Math.round(text.width + PAD_X * 2),
    height: Math.round(text.height + PAD_Y * 2),
  };
  const EXTRA = 64; // how far the blood runs below the plank

  const host = document.querySelector(".app-shell") || document.body;
  const root = document.createElement("div");
  root.className = "mdoor";
  Object.assign(root.style, { left: `${R.left}px`, top: `${R.top}px`, width: `${R.width}px`, height: `${R.height}px` });

  const drips = makeDrips(R.width, R.height, EXTRA);
  const dripSvg = `
<svg class="mdoor__drips" viewBox="0 0 ${R.width} ${R.height + EXTRA + 30}" width="${R.width}" height="${R.height + EXTRA + 30}" aria-hidden="true">
  ${drips
    .map(
      (d, i) => `
  <g class="mdoor__drip" data-i="${i}" opacity="0">
    <path d="M${d.x.toFixed(1)} ${d.y.toFixed(1)} v ${d.len.toFixed(1)}" stroke="${BLOOD}" stroke-width="${d.w}" stroke-linecap="round" fill="none" class="mdoor__drip-line" stroke-dasharray="${d.len.toFixed(1)}" stroke-dashoffset="${d.len.toFixed(1)}"/>
    ${d.w > 2 ? `<path d="M${(d.x - d.w * 0.25).toFixed(1)} ${(d.y + 2).toFixed(1)} v ${(d.len - 3).toFixed(1)}" stroke="#b83a3a" stroke-opacity=".45" stroke-width=".7" stroke-linecap="round" fill="none" class="mdoor__drip-shine" stroke-dasharray="${(d.len - 3).toFixed(1)}" stroke-dashoffset="${(d.len - 3).toFixed(1)}"/>` : ""}
    <circle class="mdoor__drip-head" cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${(d.w * 0.95).toFixed(1)}" fill="${BLOOD}"/>
  </g>`
    )
    .join("")}
</svg>`;

  root.innerHTML = `
<div class="mdoor__hole">
  <div class="mdoor__wood">${woodSvg(R.width, R.height)}</div>
  <div class="mdoor__slab">
    <div class="mdoor__half mdoor__half--l"><div class="mdoor__text" style="width:${R.width}px;padding:0 ${PAD_X}px"></div></div>
    <div class="mdoor__half mdoor__half--r"><div class="mdoor__text" style="width:${R.width}px;padding:0 ${PAD_X}px;margin-left:-${R.width / 2}px"></div></div>
  </div>
</div>
${dripSvg}`;

  // Both halves show the title, each its own half of it.
  root.querySelectorAll(".mdoor__text").forEach((slot) => {
    const clone = titleEl.cloneNode(true);
    clone.classList.add("no-anim");
    clone.removeAttribute("role");
    clone.removeAttribute("tabindex");
    Object.assign(clone.style, { margin: "0", visibility: "visible", whiteSpace: "nowrap" });
    slot.appendChild(clone);
  });

  host.appendChild(root);
  titleEl.style.visibility = "hidden";

  const hole = root.querySelector(".mdoor__hole");
  const wood = root.querySelector(".mdoor__wood");
  const slab = root.querySelector(".mdoor__slab");
  const halfL = root.querySelector(".mdoor__half--l");
  const halfR = root.querySelector(".mdoor__half--r");
  const smile = root.querySelector(".mdoor__smile");
  const eyeR = root.querySelector(".mdoor__eye--r");
  const dripGroups = [...root.querySelectorAll(".mdoor__drip")];

  const anims = [];
  const timers = [];
  const animate = (el, frames, opts) => {
    const a = el.animate(frames, { fill: "both", ...opts });
    anims.push(a);
    return a;
  };

  // 1. Pushed back into the wall.
  const recessed = "translateZ(-32px) rotateX(8deg) scale(0.9)";
  animate(
    slab,
    [
      { transform: "translateZ(0) rotateX(0deg) scale(1)", filter: "brightness(1)" },
      { transform: "translateZ(-40px) rotateX(11deg) scale(0.87)", filter: "brightness(0.7)", offset: 0.68 },
      { transform: recessed, filter: "brightness(0.74)" },
    ],
    { duration: T.pressEnd, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" }
  );
  animate(
    hole,
    [
      { boxShadow: "inset 0 0 0 0 rgba(0,0,0,0)" },
      { boxShadow: "inset 0 0 14px 4px rgba(0,0,0,0.85)" },
    ],
    { duration: T.pressEnd, easing: "ease-out" }
  );

  // 2. The two halves slide apart into the wall; the wood behind comes out of the dark.
  animate(halfL, [{ transform: "translateX(0)" }, { transform: "translateX(-104%)" }], { duration: T.openEnd - T.openStart, delay: T.openStart, easing: "cubic-bezier(0.6, 0, 0.25, 1)" });
  animate(halfR, [{ transform: "translateX(0)" }, { transform: "translateX(104%)" }], { duration: T.openEnd - T.openStart, delay: T.openStart, easing: "cubic-bezier(0.6, 0, 0.25, 1)" });
  animate(wood, [{ filter: "brightness(0.15)" }, { filter: "brightness(1)" }], { duration: 800, delay: T.openStart + 120, easing: "ease-out" });
  // A faint, uneasy flicker while it's open.
  animate(wood, [{ opacity: 1 }, { opacity: 0.9 }, { opacity: 1 }, { opacity: 0.95 }, { opacity: 1 }], {
    duration: 2600,
    delay: T.openEnd,
  });

  // 3. Blood runs down from the smiley and off the plank.
  dripGroups.forEach((group, i) => {
    const d = drips[i];
    const line = group.querySelector(".mdoor__drip-line");
    const shine = group.querySelector(".mdoor__drip-shine");
    const head = group.querySelector(".mdoor__drip-head");
    const opts = { duration: d.dur, delay: d.delay, easing: "cubic-bezier(0.45, 0.1, 0.55, 1)" };
    animate(group, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: d.delay });
    animate(line, [{ strokeDashoffset: d.len }, { strokeDashoffset: 0 }], opts);
    if (shine) animate(shine, [{ strokeDashoffset: d.len - 3 }, { strokeDashoffset: 0 }], opts);
    animate(head, [{ transform: "translateY(0)" }, { transform: `translateY(${d.len}px)` }], opts);
    // The longer ones let a drop fall off the end.
    if (d.y + d.len > R.height + 20) {
      const drop = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      drop.setAttribute("cx", d.x.toFixed(1));
      drop.setAttribute("cy", (d.y + d.len).toFixed(1));
      drop.setAttribute("r", (d.w * 0.85).toFixed(1));
      drop.setAttribute("fill", BLOOD);
      drop.setAttribute("opacity", "0");
      root.querySelector(".mdoor__drips").appendChild(drop);
      animate(
        drop,
        [
          { transform: "translateY(0)", opacity: 0.95 },
          { transform: "translateY(38px)", opacity: 0.9, offset: 0.7 },
          { transform: "translateY(52px)", opacity: 0 },
        ],
        { duration: 900, delay: d.delay + d.dur - 150, easing: "cubic-bezier(0.5, 0, 0.9, 0.6)", fill: "forwards" }
      );
    }
  });

  // The smile twitches wider; one eye jerks.
  for (const at of [2500, 3500]) {
    animate(smile, [{ transform: "scaleX(1)" }, { transform: "scaleX(1.1)" }, { transform: "scaleX(1)" }], { duration: 520, delay: at, easing: "ease-in-out" });
  }
  animate(eyeR, [{ transform: "scale(1)" }, { transform: "scale(1.45, 0.7)" }, { transform: "scale(1)" }], { duration: 260, delay: 2950 });

  // 4. Blood fades, the door slides shut, the panel comes back out.
  dripGroups.forEach((group) => {
    animate(group, [{ opacity: 1 }, { opacity: 0 }], { duration: 380, delay: T.closeStart - 300, fill: "forwards" });
  });
  animate(halfL, [{ transform: "translateX(-104%)" }, { transform: "translateX(0)" }], { duration: T.closeEnd - T.closeStart, delay: T.closeStart, easing: "cubic-bezier(0.5, 0, 0.3, 1)", fill: "forwards" });
  animate(halfR, [{ transform: "translateX(104%)" }, { transform: "translateX(0)" }], { duration: T.closeEnd - T.closeStart, delay: T.closeStart, easing: "cubic-bezier(0.5, 0, 0.3, 1)", fill: "forwards" });
  animate(
    slab,
    [
      { transform: recessed, filter: "brightness(0.74)" },
      { transform: "translateZ(0) rotateX(0deg) scale(1)", filter: "brightness(1)" },
    ],
    { duration: T.backEnd - T.closeEnd, delay: T.closeEnd, easing: "cubic-bezier(0.3, 1.4, 0.5, 1)", fill: "forwards" }
  );
  animate(hole, [{ boxShadow: "inset 0 0 14px 4px rgba(0,0,0,0.85)" }, { boxShadow: "inset 0 0 0 0 rgba(0,0,0,0)" }], { duration: T.backEnd - T.closeEnd, delay: T.closeEnd, fill: "forwards" });

  play("marketDoor");

  const finish = () => {
    root.remove();
    titleEl.style.visibility = "";
    active = null;
  };
  timers.push(setTimeout(finish, T.backEnd + 60));

  active = {
    cancel() {
      timers.forEach(clearTimeout);
      anims.forEach((a) => a.cancel());
      finish();
    },
  };
  return true;
}
