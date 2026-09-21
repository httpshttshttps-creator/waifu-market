// Particles for the card reveal: when the card flips face-up it throws out
// sparkles (and, for the rare pulls, confetti and a shockwave) in the card's
// rarity colour. Bigger burst for higher tiers. Prismatic/Omnara cards use
// the full rainbow.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function playRevealFx(canvas, { x, y, accent, tier, rainbow }) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  const palette = rainbow
    ? ["#FF6EC7", "#8B5FE0", "#4FB6E7", "#6FE3B4", "#F2B84B", "#ffffff"]
    : [accent, accent, "#ffffff", "#ffe9a8"];

  const sparkCount = [46, 90, 150, 200][Math.min(tier, 3)];
  const particles = [];
  for (let i = 0; i < sparkCount; i++) {
    const angle = rand(0, TAU);
    const speed = rand(80, 120 + 130 * (tier + 1)) * (Math.random() < 0.15 ? 1.6 : 1);
    particles.push({
      kind: "spark",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      drag: rand(1.1, 2.2),
      gravity: rand(40, 110),
      life: 0,
      max: rand(0.7, 1.5),
      size: rand(2.2, 5.6),
      rot: rand(0, TAU),
      spin: rand(-4, 4),
      color: pick(palette),
    });
  }
  // Confetti for the special pulls.
  if (tier >= 2) {
    for (let i = 0; i < 70; i++) {
      const angle = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const speed = rand(220, 520);
      particles.push({
        kind: "confetti",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.9,
        gravity: rand(260, 380),
        life: 0,
        max: rand(1.6, 2.6),
        size: rand(4, 8),
        rot: rand(0, TAU),
        spin: rand(-9, 9),
        color: pick(palette),
        flutter: rand(0, TAU),
      });
    }
  }

  const rings = tier >= 1 ? [{ delay: 0, speed: 520, w: 5 }, { delay: 0.12, speed: 380, w: 3 }] : [{ delay: 0, speed: 380, w: 3 }];
  let elapsed = 0;
  let last = performance.now();
  let raf = 0;
  let stopped = false;

  function starPath(size) {
    g.beginPath();
    g.moveTo(0, -size);
    g.quadraticCurveTo(size * 0.12, -size * 0.12, size, 0);
    g.quadraticCurveTo(size * 0.12, size * 0.12, 0, size);
    g.quadraticCurveTo(-size * 0.12, size * 0.12, -size, 0);
    g.quadraticCurveTo(-size * 0.12, -size * 0.12, 0, -size);
    g.closePath();
  }

  function frame(now) {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    g.clearRect(0, 0, W, H);

    g.globalCompositeOperation = "lighter";
    for (const ring of rings) {
      const age = elapsed - ring.delay;
      if (age < 0) continue;
      const radius = age * ring.speed;
      const fade = 1 - Math.min(1, radius / (Math.max(W, H) * 0.7));
      if (fade <= 0) continue;
      g.globalAlpha = 0.7 * fade;
      g.strokeStyle = rainbow ? "#ffffff" : accent;
      g.lineWidth = ring.w * fade + 0.5;
      g.beginPath();
      g.arc(x, y, radius, 0, TAU);
      g.stroke();
    }

    let alive = 0;
    for (const p of particles) {
      p.life += dt;
      if (p.life >= p.max) continue;
      alive++;
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy = p.vy * damp + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      const u = p.life / p.max;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.color;
      if (p.kind === "spark") {
        const twinkle = 0.65 + 0.35 * Math.sin(p.life * 22 + p.rot);
        g.globalAlpha = (1 - u) * twinkle;
        starPath(p.size * (1 - 0.4 * u));
        g.fill();
      } else {
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = Math.min(1, (1 - u) * 1.6);
        g.scale(1, Math.abs(Math.sin(p.life * 8 + p.flutter)) * 0.8 + 0.2);
        g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        g.globalCompositeOperation = "lighter";
      }
      g.restore();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";

    if (alive === 0 && elapsed > 1.2) {
      g.clearRect(0, 0, W, H);
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    g.clearRect(0, 0, W, H);
  };
}
