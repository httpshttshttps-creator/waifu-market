// The Settings gear flight: tapping the gear in the Home header lifts it off,
// spins it, and swings it down to the bottom of the screen where the
// Settings sheet opens; it lands in the sheet's title and stays there.
//
//   ProfileHeader  --launchGear(button)-->  a "flyer" copy of the icon is
//                                           made at the button (which hides
//                                           its own icon)
//   SettingsSheet  --landGear(slot)----->   once the sheet is mounted we know
//                                           where the title's gear slot is,
//                                           so the whole flight is created
//                                           as ONE animation to that spot
//   SettingsSheet closing --returnGear--->  the header icon pops back
//
// The flight target is measured from layout offsets rather than
// getBoundingClientRect, so it's the sheet's FINAL position even though the
// sheet is still sliding up when we measure it.

import { play } from "../audio/engine.js";

const DURATION = 1350;
const listeners = new Set();
let flight = null;

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

export function subscribeGear(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

const emit = (event) => listeners.forEach((cb) => cb(event));

function layoutRect(el, root) {
  let x = 0;
  let y = 0;
  let node = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent;
  }
  return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight };
}

const easeOut = (u) => 1 - Math.pow(1 - u, 3);
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

function abort(notify) {
  if (!flight) return;
  clearTimeout(flight.timer);
  flight.anim?.cancel();
  flight.flyer.remove();
  flight = null;
  if (notify) emit("returned");
}

// Returns true if a flight started (the caller then hides its own icon).
export function launchGear(button) {
  if (prefersReducedMotion()) return false;
  const icon = button?.querySelector("svg");
  if (!icon) return false;
  abort(false);

  const r = icon.getBoundingClientRect();
  const flyer = document.createElement("div");
  flyer.className = "gear-flyer";
  Object.assign(flyer.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const clone = icon.cloneNode(true);
  clone.removeAttribute("width");
  clone.removeAttribute("height");
  flyer.appendChild(clone);
  (document.querySelector(".app-shell") || document.body).appendChild(flyer);

  // If nothing claims the flight (the sheet never opened), send the icon back.
  flight = { flyer, from: r, anim: null, timer: setTimeout(() => abort(true), 300) };
  return true;
}

export function landGear(slot) {
  if (!flight || flight.anim || !slot) return;
  clearTimeout(flight.timer);

  const overlay = slot.closest(".sheet-overlay");
  const to = layoutRect(slot, overlay);
  const { flyer, from } = flight;

  const S = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
  const E = { x: to.left + to.width / 2, y: to.top + to.height / 2 };
  const k = to.width / from.width; // scale of the icon in its resting place
  // Swing out to the side of the straight line so it arcs instead of sliding.
  const C = { x: Math.max(12, Math.min(S.x, E.x) - 90), y: (S.y + E.y) / 2 - 70 };
  const LIFT = -16;

  const frames = [];
  const STEPS = 44;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    let x;
    let y;
    let rot;
    let scale;
    if (t <= 0.2) {
      // Lift off and spin up.
      const u = easeOut(t / 0.2);
      x = S.x;
      y = S.y + LIFT * u;
      rot = 200 * u;
      scale = 1 + 0.8 * u;
    } else if (t <= 0.86) {
      // Curved flight to the sheet.
      const u = easeInOut((t - 0.2) / 0.66);
      const p0 = { x: S.x, y: S.y + LIFT };
      const a = 1 - u;
      x = a * a * p0.x + 2 * a * u * C.x + u * u * E.x;
      y = a * a * p0.y + 2 * a * u * C.y + u * u * E.y;
      rot = 200 + 840 * u;
      scale = 1.8 + (k * 1.25 - 1.8) * u;
    } else {
      // Touch down: a little squash-and-settle while the spin winds down.
      const v = (t - 0.86) / 0.14;
      x = E.x;
      y = E.y;
      rot = 1040 + 40 * easeOut(v);
      scale = k * (1 + 0.25 * (1 - v) * Math.cos(v * Math.PI * 1.5));
    }
    frames.push({
      offset: t,
      transform: `translate(${x - S.x}px, ${y - S.y}px) rotate(${rot}deg) scale(${scale})`,
    });
  }

  slot.dataset.landed = "pending"; // hidden until the flyer arrives
  const anim = flyer.animate(frames, { duration: DURATION, easing: "linear", fill: "forwards" });
  flight.anim = anim;
  play("gearSpin");

  anim.onfinish = () => {
    slot.dataset.landed = "true";
    flyer.remove();
    flight = null;
    play("gearLand");
  };
}

// The sheet closed: make sure nothing is left flying and bring the header
// icon back.
export function returnGear() {
  abort(false);
  emit("returned");
}
