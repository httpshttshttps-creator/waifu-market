// Fireworks over the top of the mini app, like a night sky: a soft dark veil
// with twinkling stars fades in over the upper part of the screen, rockets
// climb with sparking trails and burst into different shapes (peony, ring,
// willow, heart, crackle), then it all fades away. Tapping the name again
// while a show is running just adds more rockets.

import { play } from "../audio/engine.js";

const REGION = 0.62; // fraction of the screen height the show covers, from the top
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

let show = null;

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

function readColor(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw || fallback;
}

// Burst shapes: each returns [angle, speed] pairs (px/s).
const SHAPES = {
  peony: (n) => Array.from({ length: n }, () => [rand(0, TAU), rand(70, 360)]),
  ring: (n) => Array.from({ length: n }, (_, i) => [(i / n) * TAU, 290]),
  double: (n) => Array.from({ length: n }, (_, i) => [(i / n) * TAU, i % 2 ? 160 : 310]),
  willow: (n) => Array.from({ length: n }, () => [rand(0, TAU), rand(50, 250)]),
  heart: (n) =>
    Array.from({ length: n }, (_, i) => {
      const t = (i / n) * TAU;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      return [Math.atan2(y, x), Math.hypot(x, y) * 14];
    }),
};

export function launchFireworks() {
  if (prefersReducedMotion()) return;
  if (show) {
    show.addRockets(5, 200);
    return;
  }
  show = createShow();
}

function createShow() {
  const host = document.querySelector(".app-shell") || document.body;
  const canvas = document.createElement("canvas");
  canvas.className = "fireworks-canvas";
  host.appendChild(canvas);

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const W = window.innerWidth;
  const H = Math.round(window.innerHeight * REGION);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.height = `${H}px`;
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  const themeGold = readColor("--gold-bright", "#ffd94d");

  const stars = Array.from({ length: 70 }, () => ({
    x: rand(0, W),
    y: rand(0, H * 0.9),
    r: rand(0.5, 1.5),
    phase: rand(0, TAU),
    speed: rand(1.5, 4),
  }));

  const rockets = [];
  const particles = [];
  const flashes = [];
  const pending = []; // launches waiting for their time: { at, size }
  let elapsed = 0;
  let last = performance.now();
  let raf = 0;
  let ended = false;
  let veil = 0; // 0..1
  let lastLaunchSchedule = 0;

  function addRockets(count, startAt = 0, spread = 380) {
    for (let i = 0; i < count; i++) {
      pending.push({ at: elapsed + startAt + i * rand(spread * 0.6, spread * 1.3) });
    }
    lastLaunchSchedule = Math.max(lastLaunchSchedule, ...pending.map((p) => p.at));
  }

  // The opening volley, then a finale of three at once.
  addRockets(7, 250, 420);
  pending.push({ at: elapsed + 3500 }, { at: elapsed + 3560 }, { at: elapsed + 3640 });
  lastLaunchSchedule = 3640;

  function launch() {
    const x = rand(W * 0.12, W * 0.88);
    const targetY = rand(H * 0.16, H * 0.52);
    rockets.push({
      x,
      y: H,
      vx: rand(-14, 14),
      vy: -rand(H * 0.9, H * 1.15),
      targetY,
      hue: rand(0, 360),
    });
    play("fireLaunch");
  }

  function burst(x, y, hue) {
    const type = pick(["peony", "peony", "ring", "double", "willow", "heart", "crackle"]);
    const shape = type === "crackle" ? "peony" : type;
    const count = type === "heart" ? 64 : type === "willow" ? 110 : 120;
    const colorA = `hsl(${hue}, 100%, 62%)`;
    const colorB = `hsl(${(hue + 40) % 360}, 100%, 70%)`;
    const gold = themeGold;
    for (const [angle, speed] of SHAPES[shape](count)) {
      const isWillow = type === "willow";
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: isWillow ? 1.1 : 1.7,
        gravity: isWillow ? 90 : 55,
        life: 0,
        max: isWillow ? rand(2.0, 3.0) : rand(1.1, 1.9),
        size: rand(1.8, 3.4),
        color: isWillow ? gold : type === "double" && speed < 200 ? colorB : Math.random() < 0.2 ? "#fff8e6" : colorA,
        crackle: type === "crackle" && Math.random() < 0.35,
      });
    }
    flashes.push({ x, y, life: 0, max: 0.4, color: colorA });
    play("fireBurst", { size: type === "willow" ? 0.8 : 1 });
    if (type === "crackle") setTimeout(() => play("fireCrackle"), 260);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt * 1000;

    // Launch anything that's due.
    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i].at <= elapsed) {
        launch();
        pending.splice(i, 1);
      }
    }

    const active = pending.length > 0 || rockets.length > 0 || particles.length > 0 || flashes.length > 0;
    veil = active ? Math.min(1, veil + dt / 0.45) : Math.max(0, veil - dt / 0.8);

    // ---- update ----
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.vy *= 1 - 0.55 * dt;
      // Sparks off the tail.
      for (let s = 0; s < 2; s++) {
        particles.push({
          x: r.x + rand(-1, 1),
          y: r.y + rand(0, 4),
          vx: rand(-18, 18),
          vy: rand(20, 70),
          drag: 1,
          gravity: 30,
          life: 0,
          max: rand(0.25, 0.5),
          size: rand(0.8, 1.6),
          color: "#ffcf7a",
          crackle: false,
        });
      }
      if (r.y <= r.targetY || r.vy > -60) {
        burst(r.x, r.y, r.hue);
        rockets.splice(i, 1);
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) {
        if (p.crackle) {
          for (let k = 0; k < 6; k++) {
            const a = rand(0, TAU);
            const sp = rand(30, 110);
            particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 2, gravity: 40, life: 0, max: rand(0.25, 0.5), size: 1.2, color: "#fff2c8", crackle: false });
          }
        }
        particles.splice(i, 1);
        continue;
      }
      p.px = p.x;
      p.py = p.y;
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy = p.vy * damp + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      flashes[i].life += dt;
      if (flashes[i].life >= flashes[i].max) flashes.splice(i, 1);
    }
    if (particles.length > 1200) particles.splice(0, particles.length - 1200);

    // ---- draw ----
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.clearRect(0, 0, W, H);
    if (veil > 0) {
      const veilGradient = g.createLinearGradient(0, 0, 0, H);
      veilGradient.addColorStop(0, `rgba(2, 5, 20, ${0.78 * veil})`);
      veilGradient.addColorStop(0.65, `rgba(3, 8, 26, ${0.5 * veil})`);
      veilGradient.addColorStop(1, "rgba(3, 8, 26, 0)");
      g.fillStyle = veilGradient;
      g.fillRect(0, 0, W, H);
      for (const s of stars) {
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(elapsed / 1000 * s.speed + s.phase));
        g.globalAlpha = veil * tw * (1 - s.y / H);
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc(s.x, s.y, s.r, 0, TAU);
        g.fill();
      }
    }

    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    for (const f of flashes) {
      const u = f.life / f.max;
      const radius = 40 + 150 * u;
      const grad = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, radius);
      grad.addColorStop(0, "rgba(255,255,255,0.9)");
      grad.addColorStop(0.3, f.color.replace("hsl", "hsla").replace(")", ", 0.5)"));
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = 1 - u;
      g.fillStyle = grad;
      g.fillRect(f.x - radius, f.y - radius, radius * 2, radius * 2);
    }
    for (const r of rockets) {
      g.globalAlpha = 1;
      g.fillStyle = "#fff6d8";
      g.beginPath();
      g.arc(r.x, r.y, 2.2, 0, TAU);
      g.fill();
    }
    for (const p of particles) {
      const u = p.life / p.max;
      const flicker = 0.7 + 0.3 * Math.random();
      g.globalAlpha = Math.max(0, (1 - u) * flicker);
      g.strokeStyle = p.color;
      g.lineWidth = p.size * (1 - 0.5 * u);
      g.beginPath();
      g.moveTo(p.px ?? p.x, p.py ?? p.y);
      g.lineTo(p.x, p.y);
      g.stroke();
      // Bright glowing head on each spark.
      if (p.size > 1.6) {
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.size * 0.65 * (1 - 0.5 * u), 0, TAU);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";

    if (!active && veil <= 0) {
      end();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function end() {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    canvas.remove();
    show = null;
  }

  raf = requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });

  return { addRockets };
}
