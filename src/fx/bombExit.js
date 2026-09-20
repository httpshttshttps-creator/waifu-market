// Closing animation for the Settings sheet: the Done button squeezes into a
// little black bomb, its fuse burns down, the bomb goes off, and the sheet
// shatters into pieces that each fly out of the screen in their own direction.
// Deliberately light on glow: smoke puffs, a faint shockwave and a few sparks.

import { play } from "../audio/engine.js";
import { prefersReducedMotion } from "./exitPresence.js";

const rand = (a, b) => a + Math.random() * (b - a);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

const MORPH_MS = 420; // button -> bomb
const FUSE_MS = 1100; // fuse burning down
const BOOM_AT = MORPH_MS + FUSE_MS;
const SHARDS_MS = 1350; // after the boom, until everything is gone
const BOMB = 58;

const BOMB_FX_SVG = `
<svg class="bomb__fx" viewBox="0 0 60 60" aria-hidden="true">
  <ellipse cx="20" cy="21" rx="7" ry="4.5" fill="#fff" opacity=".16" transform="rotate(-30 20 21)"/>
  <rect x="23" y="-7" width="14" height="10" rx="2.5" fill="#4a4a58"/>
  <path class="bomb__fuse" d="M30 -7 C 30 -14, 39 -12, 43 -19" fill="none" stroke="#c9a969" stroke-width="2.6" stroke-linecap="round"/>
  <circle class="bomb__spark" cx="43" cy="-19" r="2.6" fill="#ffd36b"/>
</svg>`;

export function runBombExit({ overlay, sheet, onDone }) {
  const button = sheet?.querySelector(".confirm-sheet__actions .sheet-button");
  if (prefersReducedMotion() || !overlay || !sheet || !button) {
    const t = setTimeout(onDone, 0);
    return () => clearTimeout(t);
  }

  overlay.dataset.silentClose = "true";
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const btn = button.getBoundingClientRect();
  const btnStyle = getComputedStyle(button);
  const bc = { x: btn.left + btn.width / 2, y: btn.top + btn.height / 2 };

  const anims = [];
  const timers = [];
  const extras = []; // DOM nodes we add, removed on cleanup
  let raf = 0;
  let boomed = false;

  const animate = (el, frames, opts) => {
    const a = el.animate(frames, opts);
    anims.push(a);
    return a;
  };
  const add = (el) => {
    overlay.appendChild(el);
    extras.push(el);
    return el;
  };

  // ---- the stand-in that turns from the Done pill into a bomb ----
  const bomb = document.createElement("div");
  bomb.className = "bomb";
  bomb.innerHTML = `<span class="bomb__label">${button.textContent}</span>${BOMB_FX_SVG}`;
  Object.assign(bomb.style, {
    left: `${btn.left}px`,
    top: `${btn.top}px`,
    width: `${btn.width}px`,
    height: `${btn.height}px`,
    background: btnStyle.backgroundColor,
    color: btnStyle.color,
    borderRadius: btnStyle.borderRadius,
  });
  add(bomb);
  button.style.visibility = "hidden";

  const circle = (size, radius) => ({
    left: `${bc.x - size / 2}px`,
    top: `${bc.y - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: `${radius}px`,
    background: "#1d1d26",
  });

  animate(
    bomb,
    [
      { left: `${btn.left}px`, top: `${btn.top}px`, width: `${btn.width}px`, height: `${btn.height}px`, borderRadius: btnStyle.borderRadius, background: btnStyle.backgroundColor, offset: 0, easing: "cubic-bezier(0.6, 0, 0.4, 1)" },
      { ...circle(34, 17), offset: 0.5, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" },
      { ...circle(BOMB + 8, (BOMB + 8) / 2), offset: 0.78, easing: "ease-in-out" },
      { ...circle(BOMB, BOMB / 2), offset: 1 },
    ],
    { duration: MORPH_MS, fill: "forwards" }
  );
  animate(bomb.querySelector(".bomb__label"), [{ opacity: 1 }, { opacity: 0 }], { duration: 110, fill: "forwards" });
  const fx = bomb.querySelector(".bomb__fx");
  animate(fx, [{ opacity: 0 }, { opacity: 1 }], { duration: 130, delay: 210, fill: "forwards" });

  // It ticks: a nervous little pulse that gets shakier as the fuse runs out.
  animate(
    bomb,
    [
      { transform: "scale(1)" },
      { transform: "scale(1.07) rotate(-1.5deg)", offset: 0.5 },
      { transform: "scale(1)" },
    ],
    { duration: 280, delay: MORPH_MS, iterations: Math.round(FUSE_MS / 280) }
  );

  // ---- fuse burning down ----
  const fuse = bomb.querySelector(".bomb__fuse");
  const spark = bomb.querySelector(".bomb__spark");
  const fuseLength = fuse.getTotalLength();
  fuse.style.strokeDasharray = `${fuseLength} ${fuseLength}`;

  const start = performance.now();
  const tick = (now) => {
    const t = now - start;
    if (t >= BOOM_AT) {
      explode();
      return;
    }
    const p = clamp01((t - MORPH_MS) / FUSE_MS);
    const visible = fuseLength * (1 - p);
    fuse.style.strokeDasharray = `${visible} ${fuseLength}`;
    if (t >= MORPH_MS) {
      const pt = fuse.getPointAtLength(visible);
      spark.setAttribute("cx", pt.x.toFixed(1));
      spark.setAttribute("cy", pt.y.toFixed(1));
      spark.setAttribute("r", (2.2 + Math.random() * 1.6).toFixed(1));
      spark.style.opacity = "1";
    } else {
      spark.style.opacity = "0";
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  // ---- boom ----
  function explode() {
    if (boomed) return;
    boomed = true;
    const r = sheet.getBoundingClientRect();
    bomb.remove();

    // Cut the sheet into an irregular grid of shards, each a clipped clone of
    // the sheet, and fling every one out of the screen its own way.
    const cols = 4;
    const rows = 5;
    const cellW = r.width / cols;
    const cellH = r.height / rows;
    const pts = [];
    for (let j = 0; j <= rows; j++) {
      pts[j] = [];
      for (let i = 0; i <= cols; i++) {
        const onX = i === 0 || i === cols;
        const onY = j === 0 || j === rows;
        pts[j][i] = [
          i * cellW + (onX ? 0 : rand(-0.3, 0.3) * cellW),
          j * cellH + (onY ? 0 : rand(-0.3, 0.3) * cellH),
        ];
      }
    }

    const shards = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const poly = [pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]];
        const cx = poly.reduce((s, p) => s + p[0], 0) / 4;
        const cy = poly.reduce((s, p) => s + p[1], 0) / 4;
        const shard = sheet.cloneNode(true);
        shard.classList.add("shard", "no-anim");
        shard.removeAttribute("data-exiting");
        Object.assign(shard.style, {
          position: "fixed",
          left: `${r.left}px`,
          top: `${r.top}px`,
          width: `${r.width}px`,
          height: `${r.height}px`,
          margin: "0",
          visibility: "visible",
          transformOrigin: `${cx}px ${cy}px`,
          clipPath: `polygon(${poly.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`,
        });
        add(shard);
        shards.push({ shard, cx: r.left + cx, cy: r.top + cy });
      }
    }
    sheet.style.visibility = "hidden";

    for (const { shard, cx, cy } of shards) {
      const angle = Math.atan2(cy - bc.y, cx - bc.x) + rand(-0.45, 0.45);
      const dist = Math.max(vw, vh) * rand(1.0, 1.5);
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist + rand(0, vh * 0.3); // a little gravity
      const spin = rand(200, 540) * (Math.random() < 0.5 ? -1 : 1);
      animate(
        shard,
        [
          { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1, offset: 0 },
          { transform: `translate(${dx * 0.3}px, ${dy * 0.3}px) rotate(${spin * 0.35}deg) scale(1)`, opacity: 1, offset: 0.22 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(0.7)`, opacity: 0.85, offset: 0.85 },
          { transform: `translate(${dx * 1.05}px, ${dy * 1.05}px) rotate(${spin * 1.05}deg) scale(0.7)`, opacity: 0, offset: 1 },
        ],
        { duration: rand(760, 1100), delay: rand(0, 70), easing: "cubic-bezier(0.2, 0.6, 0.3, 1)", fill: "forwards" }
      );
    }

    // Smoke, a faint shockwave and a few sparks.
    for (let i = 0; i < 8; i++) {
      const puff = document.createElement("div");
      puff.className = "bomb-puff";
      const size = rand(30, 58);
      Object.assign(puff.style, { left: `${bc.x - size / 2}px`, top: `${bc.y - size / 2}px`, width: `${size}px`, height: `${size}px` });
      add(puff);
      const a = rand(0, Math.PI * 2);
      const d = rand(30, 110);
      animate(
        puff,
        [
          { transform: "translate(0,0) scale(0.4)", opacity: 0.6 },
          { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d - 20}px) scale(${rand(1.8, 2.8)})`, opacity: 0 },
        ],
        { duration: rand(600, 900), easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "forwards" }
      );
    }
    const ring = document.createElement("div");
    ring.className = "bomb-ring";
    Object.assign(ring.style, { left: `${bc.x - 20}px`, top: `${bc.y - 20}px` });
    add(ring);
    animate(ring, [{ transform: "scale(0.3)", opacity: 0.5 }, { transform: "scale(9)", opacity: 0 }], { duration: 520, easing: "cubic-bezier(0.1, 0.6, 0.3, 1)", fill: "forwards" });
    for (let i = 0; i < 12; i++) {
      const dot = document.createElement("div");
      dot.className = "bomb-spark";
      Object.assign(dot.style, { left: `${bc.x - 2}px`, top: `${bc.y - 2}px` });
      add(dot);
      const a = rand(0, Math.PI * 2);
      const d = rand(60, 170);
      animate(
        dot,
        [
          { transform: "translate(0,0)", opacity: 1 },
          { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 30}px)`, opacity: 0 },
        ],
        { duration: rand(350, 600), easing: "cubic-bezier(0.1, 0.7, 0.3, 1)", fill: "forwards" }
      );
    }

    // A short, small shake of the whole app.
    const shell = document.querySelector(".app-shell");
    if (shell) {
      animate(
        shell,
        [
          { transform: "translate(0, 0)" },
          { transform: "translate(-4px, 3px)", offset: 0.1 },
          { transform: "translate(4px, -3px)", offset: 0.25 },
          { transform: "translate(-3px, 2px)", offset: 0.45 },
          { transform: "translate(2px, -1px)", offset: 0.7 },
          { transform: "translate(0, 0)" },
        ],
        { duration: 360 }
      );
    }

    // The backdrop fades as the pieces clear the screen.
    animate(overlay, [{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 640, easing: "ease-in", fill: "forwards" });
    timers.push(setTimeout(onDone, SHARDS_MS));
  }

  play("bombExit");

  return () => {
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    anims.forEach((a) => a.cancel());
    extras.forEach((el) => el.remove());
    button.style.visibility = "";
    sheet.style.visibility = "";
    delete overlay.dataset.silentClose;
  };
}
