import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { createTerrainState, generateAhead, pruneBehind, GAP_PRUNE_MARGIN } from "./terrain.js";
import { resumeAudio, updateEngine, playJump, playLand, playCrash, playScore, stopEngine } from "./sound.js";

const { Engine, Body, Bodies, Composite, Constraint, Events } = Matter;

// Collision categories - kept simple: the bike's wheels are only allowed
// to rest on "ground" (real terrain AND the safe moving platforms), while
// touching anything in "trap" ends the run immediately. The chassis
// touching either ground or a trap also ends the run (you can't land on
// your frame).
const CATEGORY_GROUND = 0x0002;
const CATEGORY_BIKE = 0x0004;
const CATEGORY_TRAP = 0x0008;

// ---------------- physics tuning ----------------
// Jumping is now a discrete action (double-tap - see DOUBLE_TAP_WINDOW
// below), not something that emerges from ramp launch physics. That
// makes the whole system much more predictable: JUMP_VELOCITY is a
// fixed upward kick applied the instant a double-tap is registered
// while grounded, and it deliberately never touches horizontal
// velocity - so a bike already moving keeps moving at the same speed
// through the jump (carries its momentum forward), while a bike at a
// standstill just hops straight up and back down. Propulsion is a
// direct forward force on the chassis (not wheel friction) so it's
// never affected by how the wheels happen to be spinning; wheel
// rotation itself is left entirely to Matter's own friction/contact
// simulation. Angular momentum in the air is barely damped - once a
// flip is spinning, it keeps spinning instead of politely stopping the
// moment gas is released, matching how a real spinning mass behaves.
const GRAVITY_Y = 0.68;
const FORWARD_FORCE = 0.019;
// Rear-wheel spin under power is purely COSMETIC (a separate drawn
// rotation, not a real physics torque) - see rearSpinAngle below.
// Applying real torque to the rear wheel turned out to transmit a
// reaction force straight through its axle pin into the chassis
// (offset from the center of mass), pitching the whole bike forward
// under acceleration - a real wheelie-causing mechanism, just not one
// we want here where stable, predictable ground handling matters more
// than that extra bit of realism. Propulsion itself is entirely the
// direct FORWARD_FORCE on the chassis above, completely unaffected by
// this.
const REAR_SPIN_RATE = 0.045; // cosmetic radians per (ms * speedFraction) while driving
const MAX_SPEED = 31;
const JUMP_VELOCITY = 50; // upward kick from a double-tap, horizontal velocity untouched
const DOUBLE_TAP_WINDOW = 320; // ms between taps to register as a jump instead of two separate holds
const AIR_PITCH_TORQUE = 0.0022; // ramps up over ~1.1s of holding - deliberate, not an instant snap
const AIR_PITCH_MAX_SPIN = 2.4; // rad/s - more room to commit to a full flip on a big jump
const AUTO_LEVEL_DAMPING = 0.006; // barely bleeds off existing spin - a flip keeps turning once started
const FALL_DEATH_OFFSET = 1400; // generous last-resort net; the real catch is the pit's spike floor
const CAMERA_LEAD_X = 0.32;
const CAMERA_FOLLOW_X = 0.09;
const CAMERA_FOLLOW_Y = 0.08;
const CAMERA_MAX_ZOOM_OUT = 0.12; // fraction zoomed out at top speed
const CAMERA_ZOOM_SMOOTHING = 0.05;
const CAMERA_SHAKE_START_FRACTION = 0.7; // shake only kicks in above 70% of top speed
const CAMERA_SHAKE_MAX_PX = 2.5;
const FIXED_DT = 1000 / 60; // fixed physics step for smooth, frame-rate-independent motion
const MAX_STEPS_PER_FRAME = 5; // avoid a "spiral of death" after a tab switch/lag spike
const EXPLOSION_DURATION = 700;
const TRAIL_LENGTH = 14; // rear-wheel light-trail particle count
const HARD_LANDING_VY = 3; // impact speed above which a landing spawns dust + a camera thump

function isWheel(body) {
  return body.label === "wheel";
}
function isChassis(body) {
  return body.label === "chassis";
}
function isGround(body) {
  return body.collisionFilter.category === CATEGORY_GROUND;
}
function isTrap(body) {
  return body.collisionFilter.category === CATEGORY_TRAP;
}

function createBike(x, y) {
  const group = Body.nextGroup(true);
  const wheelRadius = 14;
  const wheelBase = 44;
  const rideHeight = 12;

  const chassis = Bodies.rectangle(x, y, 52, 12, {
    collisionFilter: { group, category: CATEGORY_BIKE, mask: CATEGORY_GROUND | CATEGORY_TRAP },
    density: 0.0038, // heavier chassis - more real inertia/momentum, less like a paper cutout
    friction: 0.3,
    frictionAir: 0.008, // lighter air drag so momentum (linear AND angular) carries through a jump
    label: "chassis",
  });

  const rearWheel = Bodies.circle(x - wheelBase / 2, y + rideHeight, wheelRadius, {
    collisionFilter: { group, category: CATEGORY_BIKE, mask: CATEGORY_GROUND | CATEGORY_TRAP },
    friction: 1.1,
    frictionStatic: 1.6,
    density: 0.012,
    label: "wheel",
  });

  const frontWheel = Bodies.circle(x + wheelBase / 2, y + rideHeight, wheelRadius, {
    collisionFilter: { group, category: CATEGORY_BIKE, mask: CATEGORY_GROUND | CATEGORY_TRAP },
    friction: 1.1,
    frictionStatic: 1.6,
    density: 0.012,
    label: "wheel",
  });

  const rearAxle = Constraint.create({
    bodyA: chassis,
    pointA: { x: -wheelBase / 2, y: rideHeight },
    bodyB: rearWheel,
    stiffness: 1,
    damping: 0.25,
    length: 0,
  });

  const frontAxle = Constraint.create({
    bodyA: chassis,
    pointA: { x: wheelBase / 2, y: rideHeight },
    bodyB: frontWheel,
    stiffness: 1,
    damping: 0.25,
    length: 0,
  });

  return { chassis, rearWheel, frontWheel, rearAxle, frontAxle, wheelRadius };
}

function buildGroundSegment(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy) + 2;
  const angle = Math.atan2(dy, dx);
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const thickness = 46;
  return Bodies.rectangle(midX, midY + thickness / 2, length, thickness, {
    isStatic: true,
    angle,
    friction: 1,
    collisionFilter: { category: CATEGORY_GROUND, mask: CATEGORY_BIKE },
    label: "ground",
  });
}

function buildTrapBody(trap) {
  switch (trap.type) {
    case "spike":
      return Bodies.rectangle(trap.x, trap.y - trap.height / 2, trap.width * 0.85, trap.height, {
        isStatic: true,
        collisionFilter: { category: CATEGORY_TRAP, mask: CATEGORY_BIKE },
        label: "trap",
      });
    case "pitfloor": {
      const midX = (trap.x1 + trap.x2) / 2;
      const width = trap.x2 - trap.x1;
      return Bodies.rectangle(midX, trap.y, width, 50, {
        isStatic: true,
        collisionFilter: { category: CATEGORY_TRAP, mask: CATEGORY_BIKE },
        label: "trap",
      });
    }
    case "platform":
      return Bodies.rectangle(trap.x, trap.y, trap.width, trap.height, {
        isStatic: true,
        friction: 1,
        collisionFilter: { category: CATEGORY_GROUND, mask: CATEGORY_BIKE },
        label: "ground",
      });
    case "pendulum":
      return Bodies.circle(trap.anchorX, trap.anchorY + trap.length, trap.radius, {
        isStatic: true,
        collisionFilter: { category: CATEGORY_TRAP, mask: CATEGORY_BIKE },
        label: "trap",
      });
    case "blade":
      return Bodies.circle(trap.x, trap.y, trap.radius * 0.85, {
        isStatic: true,
        collisionFilter: { category: CATEGORY_TRAP, mask: CATEGORY_BIKE },
        label: "trap",
      });
    default:
      return null;
  }
}

// ---------------- rendering ----------------
// Glow is done with modest shadowBlur values and as few extra save/
// restore + shadow-state switches as possible - canvas shadowBlur is
// expensive, and stacking many large-blur passes per frame is the
// single biggest cause of a choppy-feeling game on real phones.

function drawBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#3a0f1f");
  gradient.addColorStop(1, "#1c0812");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawSkyline(ctx, cameraX, viewWidth, viewHeight) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  const parallax = 0.25;
  const baseY = viewHeight * 0.74;
  const spacing = 260;
  const scrollX = cameraX * parallax;
  const offset = -(scrollX % spacing);
  for (let x = offset - spacing; x < viewWidth + spacing; x += spacing) {
    const seedIndex = Math.round((x + scrollX) / spacing);
    const peakHeight = 90 + Math.abs(Math.sin(seedIndex * 12.9898)) * 140;
    ctx.beginPath();
    ctx.moveTo(x, viewHeight + 10);
    ctx.lineTo(x, baseY);
    ctx.lineTo(x + spacing * 0.5, baseY - peakHeight);
    ctx.lineTo(x + spacing, baseY);
    ctx.lineTo(x + spacing, viewHeight + 10);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Ground fill always extends well below the current camera view, so a
// span never reads as a thin floating ribbon with void underneath - and
// at a gap's edges, two spans' fills naturally form facing canyon walls
// around the pit floor.
function drawGround(ctx, terrain, cameraX, viewWidth, fillBottomY) {
  ctx.save();
  ctx.lineWidth = 7;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const span of terrain.spans) {
    if (span.length < 2) continue;
    const last = span[span.length - 1];
    const first = span[0];
    if (last.x < cameraX - 50 || first.x > cameraX + viewWidth + 50) continue;

    ctx.fillStyle = "#2b0e10";
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < span.length; i++) ctx.lineTo(span[i].x, span[i].y);
    ctx.lineTo(last.x, fillBottomY);
    ctx.lineTo(first.x, fillBottomY);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = "#f2c14e";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "#ffedb0";
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < span.length; i++) ctx.lineTo(span[i].x, span[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpike(ctx, trap) {
  ctx.save();
  ctx.shadowColor = "#ff4d4d";
  ctx.shadowBlur = 10;
  ctx.strokeStyle = "#ff8080";
  ctx.fillStyle = "rgba(255, 77, 77, 0.28)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(trap.x, trap.y - trap.height);
  ctx.lineTo(trap.x - trap.width / 2, trap.y);
  ctx.lineTo(trap.x + trap.width / 2, trap.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPitFloor(ctx, trap) {
  ctx.save();
  ctx.shadowColor = "#ff4d4d";
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "#ff8080";
  ctx.fillStyle = "rgba(255, 77, 77, 0.25)";
  ctx.lineWidth = 2;
  const spikeWidth = 26;
  const count = Math.max(1, Math.round((trap.x2 - trap.x1) / spikeWidth));
  const step = (trap.x2 - trap.x1) / count;
  for (let i = 0; i < count; i++) {
    const cx = trap.x1 + step * (i + 0.5);
    ctx.beginPath();
    ctx.moveTo(cx, trap.y - 26);
    ctx.lineTo(cx - step / 2, trap.y);
    ctx.lineTo(cx + step / 2, trap.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlatform(ctx, body) {
  ctx.save();
  ctx.shadowColor = "#6fe3b4";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "rgba(111, 227, 180, 0.3)";
  ctx.strokeStyle = "#8ffcd0";
  ctx.lineWidth = 3;
  const { vertices } = body;
  ctx.beginPath();
  ctx.moveTo(vertices[0].x, vertices[0].y);
  for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPendulum(ctx, trap, body) {
  ctx.save();
  ctx.strokeStyle = "rgba(242, 184, 75, 0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(trap.anchorX, trap.anchorY);
  ctx.lineTo(body.position.x, body.position.y);
  ctx.stroke();

  ctx.shadowColor = "#f2b84b";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#ffd989";
  ctx.beginPath();
  ctx.arc(body.position.x, body.position.y, trap.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBlade(ctx, trap, elapsed) {
  const angle = elapsed * trap.speed * 1.6;
  ctx.save();
  ctx.translate(trap.x, trap.y);
  ctx.rotate(angle);
  ctx.shadowColor = "#ff4d4d";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "#ff8080";
  ctx.fillStyle = "rgba(255, 77, 77, 0.35)";
  ctx.lineWidth = 2.5;

  const spikeCount = 14;
  ctx.beginPath();
  for (let i = 0; i < spikeCount; i++) {
    const a1 = (i / spikeCount) * Math.PI * 2;
    const a2 = ((i + 0.5) / spikeCount) * Math.PI * 2;
    const outer = trap.radius;
    const inner = trap.radius * 0.62;
    const x1 = Math.cos(a1) * outer;
    const y1 = Math.sin(a1) * outer;
    const x2 = Math.cos(a2) * inner;
    const y2 = Math.sin(a2) * inner;
    if (i === 0) ctx.moveTo(x1, y1);
    else ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTrail(ctx, trailPoints) {
  if (trailPoints.length < 2) return;
  ctx.save();
  ctx.strokeStyle = "#ff6ec7";
  ctx.lineCap = "round";
  for (let i = 1; i < trailPoints.length; i++) {
    const p0 = trailPoints[i - 1];
    const p1 = trailPoints[i];
    const alpha = i / trailPoints.length;
    ctx.globalAlpha = alpha * 0.5;
    ctx.lineWidth = 4 * alpha;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBike(ctx, bike, rearSpinAngle) {
  const { chassis, rearWheel, frontWheel, wheelRadius } = bike;
  const wb = 42; // half-length used for the body silhouette only

  // --- چرخ‌های نئونی (سفید/بنفش) روی موقعیت واقعی فیزیک ---
  const drawNeonWheel = (wx, wy, spinAngle) => {
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(spinAngle);

    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.shadowColor = "#a855f7";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, wheelRadius - 4, 0, Math.PI * 2);
    ctx.strokeStyle = "#c084fc";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#3b0764";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * (wheelRadius - 5), Math.sin(a) * (wheelRadius - 5));
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#1e1b4b";
    ctx.fill();

    ctx.restore();
  };

  // چرخ عقب: چرخش نمایشی (rearSpinAngle) - چرخ جلو: زاویه واقعی فیزیک
  drawNeonWheel(rearWheel.position.x, rearWheel.position.y, rearSpinAngle);
  drawNeonWheel(frontWheel.position.x, frontWheel.position.y, frontWheel.angle);

  // --- بدنه موتور (Cyberpunk / Diamond Polygon Shape) روی شاسی فیزیک ---
  ctx.save();
  ctx.translate(chassis.position.x, chassis.position.y);
  ctx.rotate(chassis.angle);

  // 1. شاسی اصلی و تیره موتور
  ctx.beginPath();
  ctx.moveTo(-wb - 5, -8);
  ctx.lineTo(-10, -12);
  ctx.lineTo(15, -22);
  ctx.lineTo(wb + 2, -10);
  ctx.lineTo(20, 8);
  ctx.lineTo(-5, 12);
  ctx.lineTo(-wb + 5, 2);
  ctx.closePath();
  ctx.fillStyle = "#2e1065";
  ctx.fill();
  ctx.strokeStyle = "#581c87";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 2. خطوط و لایه‌های نئونی بالای بدنه (بنفش روشن)
  ctx.shadowColor = "#d8b4fe";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(-wb - 2, -10);
  ctx.lineTo(-5, -15);
  ctx.lineTo(12, -24);
  ctx.lineTo(wb - 5, -12);
  ctx.strokeStyle = "#c084fc";
  ctx.lineWidth = 3;
  ctx.stroke();

  // 3. کریستال/چراغ نئونی آبی جانبی (Triangular Cyan Light Panel)
  ctx.shadowColor = "#38bdf8";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(2, -4);
  ctx.lineTo(16, -10);
  ctx.lineTo(22, 2);
  ctx.lineTo(8, 6);
  ctx.closePath();
  ctx.fillStyle = "#38bdf8";
  ctx.fill();
  ctx.strokeStyle = "#e0f2fe";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 4. چراغ جلو (Cyan Headlight)
  ctx.beginPath();
  ctx.moveTo(wb - 8, -14);
  ctx.lineTo(wb + 2, -10);
  ctx.lineTo(wb - 2, -6);
  ctx.closePath();
  ctx.fillStyle = "#00f0ff";
  ctx.fill();

  ctx.restore();
}

function drawExplosion(ctx, particles) {
  ctx.save();
  for (const p of particles) {
    const alpha = Math.max(0, 1 - p.age / p.life);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Screen-space streaks that flash by when going fast - cheap stand-in
// for motion blur. `lines` is a small live array of {y, life, age,
// length} the caller spawns/ages each frame; this just draws them.
function drawSpeedLines(ctx, lines, width) {
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.lineCap = "round";
  for (const line of lines) {
    const alpha = Math.max(0, 1 - line.age / line.life) * 0.35;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width, line.y);
    ctx.lineTo(width - line.length, line.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHud(ctx, seconds, width) {
  ctx.save();
  const label = `⏱ ${seconds}s`;
  ctx.font = "700 20px 'IBM Plex Mono', monospace";
  const textWidth = ctx.measureText(label).width;
  const pillWidth = textWidth + 32;

  ctx.fillStyle = "rgba(20, 6, 14, 0.65)";
  ctx.strokeStyle = "rgba(242, 193, 78, 0.6)";
  ctx.lineWidth = 1.5;
  const pillX = width / 2 - pillWidth / 2;
  const radius = 18;
  ctx.beginPath();
  ctx.moveTo(pillX + radius, 14);
  ctx.arcTo(pillX + pillWidth, 14, pillX + pillWidth, 14 + 36, radius);
  ctx.arcTo(pillX + pillWidth, 14 + 36, pillX, 14 + 36, radius);
  ctx.arcTo(pillX, 14 + 36, pillX, 14, radius);
  ctx.arcTo(pillX, 14, pillX + pillWidth, 14, radius);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fff3d6";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, width / 2, 14 + 18);
  ctx.restore();
}

function createExplosionParticles(x, y) {
  const colors = ["#ff6ec7", "#5fb8ff", "#ffd989", "#ffffff"];
  const particles = [];
  for (let i = 0; i < 24; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 4,
      life: 380 + Math.random() * 320,
      age: 0,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
  return particles;
}

// Small, brief dust/spark puff for a hard landing - distinct from the
// crash explosion (smaller, shorter-lived, doesn't stop the run).
function createLandingDust(x, y, intensity) {
  const colors = ["#ffedb0", "#f2c14e", "#ffffff"];
  const count = Math.round(6 + Math.min(1.6, intensity) * 5);
  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.PI + (Math.random() - 0.5) * Math.PI * 0.9; // fan out along the ground, upward-ish
    const speed = (1 + Math.random() * 2.4) * Math.min(1.6, intensity);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.5,
      size: 2 + Math.random() * 2.5,
      life: 220 + Math.random() * 160,
      age: 0,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
  return particles;
}

// ---------------- component ----------------

export default function GameCanvas({ onGameOver, onQuit }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const gasRef = useRef(false);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext("2d");

    const engine = Engine.create();
    engine.gravity.y = GRAVITY_Y;
    const world = engine.world;

    const baseline = 420;
    const terrain = createTerrainState(baseline);
    // Spawn resting almost exactly on the ground (wheels ~= wheelRadius
    // above baseline, chassis further up by rideHeight) with only a tiny
    // clearance gap - not high above it. A real fall from height meant
    // the bike was briefly airborne right at spawn, and if the player
    // holds gas from frame one (as the "hold to accelerate" prompt
    // invites), the strong air-flip torque had just enough time to spin
    // the bike into a bad angle before it ever touched down once,
    // causing an instant crash. Numbers below match createBike's own
    // wheelRadius (14) + rideHeight (12) - keep in sync if those change.
    const bike = createBike(160, baseline - 32);
    Composite.add(world, [
      bike.chassis,
      bike.rearWheel,
      bike.frontWheel,
      bike.rearAxle,
      bike.frontAxle,
    ]);

    const spanBuiltCount = new WeakMap();
    let groundBodies = []; // { body, endX }
    const trapRuntime = new Map(); // trap -> { body }
    const builtTraps = new Set();

    function buildNewTerrain() {
      for (const span of terrain.spans) {
        const built = spanBuiltCount.get(span) || 0;
        if (built >= span.length - 1) continue;
        for (let i = built; i < span.length - 1; i++) {
          const body = buildGroundSegment(span[i], span[i + 1]);
          Composite.add(world, body);
          groundBodies.push({ body, endX: span[i + 1].x });
        }
        spanBuiltCount.set(span, span.length - 1);
      }

      for (const trap of terrain.traps) {
        if (builtTraps.has(trap)) continue;
        const body = buildTrapBody(trap);
        if (body) {
          Composite.add(world, body);
          trapRuntime.set(trap, { body });
        }
        builtTraps.add(trap);
      }
    }

    function pruneOldTerrain(frontierX) {
      const cutoff = frontierX - GAP_PRUNE_MARGIN;
      groundBodies = groundBodies.filter((entry) => {
        if (entry.endX < cutoff) {
          Composite.remove(world, entry.body);
          return false;
        }
        return true;
      });

      const removedTraps = pruneBehind(terrain, frontierX);
      for (const trap of removedTraps) {
        const runtime = trapRuntime.get(trap);
        if (runtime) {
          Composite.remove(world, runtime.body);
          trapRuntime.delete(trap);
        }
        builtTraps.delete(trap);
      }
    }

    function updateMovingTraps(elapsed) {
      for (const trap of terrain.traps) {
        const runtime = trapRuntime.get(trap);
        if (!runtime) continue;

        if (trap.type === "platform") {
          const y = trap.y - trap.height + Math.sin(elapsed * trap.speed) * trap.travel;
          Body.setPosition(runtime.body, { x: trap.x, y });
        } else if (trap.type === "pendulum") {
          const angle = Math.sin(elapsed * trap.speed + trap.phase) * 1.15;
          const x = trap.anchorX + Math.sin(angle) * trap.length;
          const y = trap.anchorY + Math.cos(angle) * trap.length;
          Body.setPosition(runtime.body, { x, y });
        }
      }
    }

    // ---------------- collisions ----------------
    // A wheel resting on the seam between two ground segments has TWO
    // simultaneous contact pairs - track ground contact as a reference
    // count (not a Set), so one of those pairs ending doesn't wrongly
    // mark the bike as airborne while it's still resting on the other.
    let groundContacts = 0;
    let crashed = false;
    let gameOverFired = false;
    let explosionStartedAt = null;
    let explosionParticles = [];
    let pendingScore = 0;

    function triggerCrash(elapsedSeconds) {
      if (crashed) return;
      crashed = true;
      pendingScore = Math.max(0, Math.floor(elapsedSeconds));
      explosionStartedAt = performance.now();
      explosionParticles = createExplosionParticles(bike.chassis.position.x, bike.chassis.position.y);
      playCrash();
      updateEngine(false, 0);
    }

    function handlePair(a, b, elapsedSeconds) {
      if ((isWheel(a) && isGround(b)) || (isWheel(b) && isGround(a))) groundContacts++;
      if ((isChassis(a) && (isGround(b) || isTrap(b))) || (isChassis(b) && (isGround(a) || isTrap(a)))) {
        triggerCrash(elapsedSeconds);
      }
      if ((isWheel(a) && isTrap(b)) || (isWheel(b) && isTrap(a))) {
        triggerCrash(elapsedSeconds);
      }
    }

    let elapsedRef = 0;

    const onCollisionStart = (event) => {
      for (const pair of event.pairs) handlePair(pair.bodyA, pair.bodyB, elapsedRef);
    };
    const onCollisionEnd = (event) => {
      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;
        if ((isWheel(bodyA) && isGround(bodyB)) || (isWheel(bodyB) && isGround(bodyA))) {
          groundContacts = Math.max(0, groundContacts - 1);
        }
      }
    };
    Events.on(engine, "collisionStart", onCollisionStart);
    Events.on(engine, "collisionEnd", onCollisionEnd);

    // ---------------- input ----------------
    // A quick double-tap anywhere triggers a jump (if grounded); a
    // single press-and-hold just accelerates, exactly as before. Jump
    // itself is a plain vertical velocity kick that never touches
    // horizontal velocity - see the jumpRequested handling in
    // stepPhysics for why that's what makes "keep moving if you were
    // already moving, stay put if you were standing still" work.
    let lastTapTime = 0;
    let jumpRequested = false;

    function registerTap() {
      const now = performance.now();
      if (now - lastTapTime < DOUBLE_TAP_WINDOW) {
        jumpRequested = true;
        lastTapTime = 0; // avoid a fast third tap chaining into a second jump instantly
      } else {
        lastTapTime = now;
      }
    }

    function onPointerDown(event) {
      event.preventDefault();
      gasRef.current = true;
      resumeAudio(); // audio can only start from inside a real user gesture
      registerTap();
    }
    function onPointerUp() {
      gasRef.current = false;
    }
    function onKeyDown(event) {
      if (event.code === "Space" || event.code === "ArrowUp") {
        gasRef.current = true;
        if (!event.repeat) registerTap();
      }
    }
    function onKeyUp(event) {
      if (event.code === "Space" || event.code === "ArrowUp") gasRef.current = false;
    }
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ---------------- sizing ----------------
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;
    }
    resize();
    window.addEventListener("resize", resize);

    // ---------------- fixed-timestep physics step ----------------
    // The bike now spawns resting almost exactly on the ground (see
    // createBike call above), so it should never genuinely be airborne
    // before its first real jump. `hasLandedOnce` is a defensive
    // backstop, not the primary fix: it blocks the strong air-flip
    // torque from ever applying before the bike has touched ground at
    // least once, so even if some future change (or an edge case in
    // terrain generation) ever left the bike briefly airborne at spawn
    // again, holding gas immediately can't spin it into an instant
    // crash before it's had a real landing.
    let wasGrounded = false;
    let hasLandedOnce = false;
    let lastAirborneVy = 0; // velocity.y as of the last tick we were still airborne - see landing detection below
    let landingShake = 0; // decays each frame; added on top of the speed-based camera shake
    let lastScoreMilestone = 0;
    const trail = [];
    let dustParticles = [];
    let rearSpinAngle = 0; // cosmetic-only rotation for the rear wheel's drawn spoke line

    function stepPhysics(dtMs) {
      elapsedRef += dtMs / 1000;

      const grounded = groundContacts > 0;
      if (grounded) hasLandedOnce = true;

      const milestone = Math.floor(elapsedRef / 10);
      if (milestone > lastScoreMilestone) {
        lastScoreMilestone = milestone;
        playScore();
      }

      // Landing detection - by the time `grounded` flips true here, the
      // collision may already have changed bike.chassis.velocity.y this
      // tick, so we use whatever velocity was recorded on the LAST tick
      // we were still genuinely airborne (lastAirborneVy) as the impact
      // speed instead.
      if (!wasGrounded && grounded) {
        const impact = Math.abs(lastAirborneVy);
        playLand(impact / HARD_LANDING_VY);
        if (impact > HARD_LANDING_VY) {
          dustParticles.push(
            ...createLandingDust(bike.rearWheel.position.x, bike.rearWheel.position.y, impact / HARD_LANDING_VY)
          );
          landingShake = Math.min(CAMERA_SHAKE_MAX_PX * 2.5, impact * 0.4);
        }
      }

      const speedFraction = Math.min(1, Math.max(0, bike.chassis.velocity.x / MAX_SPEED));
      updateEngine(grounded && gasRef.current, speedFraction);

      // A double-tap jump is a pure vertical velocity kick - horizontal
      // velocity is deliberately left completely untouched. That's the
      // entire mechanism behind "keep moving forward if you were already
      // moving, stay put if you were standing still": we simply never
      // change vx here, so whatever it already was carries straight
      // through the jump.
      if (jumpRequested) {
        jumpRequested = false;
        if (grounded) {
          Body.setVelocity(bike.chassis, { x: bike.chassis.velocity.x, y: -JUMP_VELOCITY });
          playJump();
        }
      }

      if (grounded) {
        if (gasRef.current) {
          Body.applyForce(bike.chassis, bike.chassis.position, { x: FORWARD_FORCE, y: 0 });
          rearSpinAngle += REAR_SPIN_RATE * dtMs * (0.4 + speedFraction);
        }
        // The front wheel is never touched - it's drawn from its real
        // physics angle, turning only from its own friction/contact
        // with the ground, exactly like a real motorcycle's undriven
        // front wheel. The rear wheel's spin is purely cosmetic (see
        // REAR_SPIN_RATE above) - it never touches the real physics
        // body, so it can never feed back into chassis stability.
        if (bike.chassis.velocity.x > MAX_SPEED) {
          Body.setVelocity(bike.chassis, { x: MAX_SPEED, y: bike.chassis.velocity.y });
        }
      } else if (gasRef.current && hasLandedOnce) {
        Body.setAngularVelocity(
          bike.chassis,
          Math.min(bike.chassis.angularVelocity + AIR_PITCH_TORQUE * dtMs, AIR_PITCH_MAX_SPIN)
        );
      } else {
        // Not holding gas in the air: just damp out any existing spin so
        // the bike settles into coasting at whatever angle it currently
        // has - it does NOT get pulled back toward level.
        Body.setAngularVelocity(bike.chassis, bike.chassis.angularVelocity * (1 - AUTO_LEVEL_DAMPING));
      }

      wasGrounded = grounded;
      if (!grounded) lastAirborneVy = bike.chassis.velocity.y;

      trail.push({ x: bike.rearWheel.position.x, y: bike.rearWheel.position.y });
      if (trail.length > TRAIL_LENGTH) trail.shift();

      generateAhead(terrain, bike.chassis.position.x + 1600, elapsedRef);
      buildNewTerrain();
      pruneOldTerrain(bike.chassis.position.x);
      updateMovingTraps(elapsedRef);

      Engine.update(engine, dtMs);

      if (bike.chassis.position.y > terrain.baseline + FALL_DEATH_OFFSET) {
        triggerCrash(elapsedRef);
      }
    }

    // ---------------- main loop ----------------
    let rafId;
    let lastTime = performance.now();
    let accumulator = 0;
    let cameraX = bike.chassis.position.x;
    let cameraY = bike.chassis.position.y;
    let zoom = 1;
    const speedLines = [];

    function tick(now) {
      const frameTime = Math.min(now - lastTime, 250);
      lastTime = now;

      if (!crashed) {
        accumulator += frameTime;
        let steps = 0;
        while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
          stepPhysics(FIXED_DT);
          accumulator -= FIXED_DT;
          steps++;
        }
      } else {
        const explosionAge = now - explosionStartedAt;
        for (const p of explosionParticles) {
          p.age = explosionAge;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.15;
        }
        if (explosionAge > EXPLOSION_DURATION && !gameOverFired) {
          gameOverFired = true;
          onGameOverRef.current(pendingScore);
        }
      }

      // Dust particles age regardless of crashed state (a landing right
      // before a crash should still finish its little puff).
      dustParticles = dustParticles.filter((p) => {
        p.age += frameTime;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        return p.age < p.life;
      });
      landingShake = Math.max(0, landingShake - frameTime * 0.02);

      const speedFraction = Math.min(1, Math.max(0, bike.chassis.velocity.x / MAX_SPEED));

      // Speed lines: cheap motion-blur stand-in, only above a threshold.
      if (speedFraction > 0.55 && Math.random() < speedFraction * 0.5) {
        speedLines.push({
          y: Math.random() * container.clientHeight,
          length: 40 + Math.random() * 70 * speedFraction,
          life: 140 + Math.random() * 100,
          age: 0,
        });
      }
      for (let i = speedLines.length - 1; i >= 0; i--) {
        speedLines[i].age += frameTime;
        if (speedLines[i].age > speedLines[i].life) speedLines.splice(i, 1);
      }

      const viewWidth = container.clientWidth;
      const viewHeight = container.clientHeight;

      const targetZoom = 1 - speedFraction * CAMERA_MAX_ZOOM_OUT;
      zoom += (targetZoom - zoom) * CAMERA_ZOOM_SMOOTHING;

      const targetX = bike.chassis.position.x - (viewWidth * CAMERA_LEAD_X) / zoom;
      const targetY = bike.chassis.position.y - (viewHeight * 0.5) / zoom;
      cameraX += (targetX - cameraX) * CAMERA_FOLLOW_X;
      cameraY += (targetY - cameraY) * CAMERA_FOLLOW_Y;

      // Shake: a steady light jitter above ~70% top speed, plus a
      // separate decaying pulse from a hard landing - both expressed in
      // screen pixels, then converted to world units so they read the
      // same regardless of the current zoom level.
      const speedShakeMag =
        speedFraction > CAMERA_SHAKE_START_FRACTION
          ? ((speedFraction - CAMERA_SHAKE_START_FRACTION) / (1 - CAMERA_SHAKE_START_FRACTION)) * CAMERA_SHAKE_MAX_PX
          : 0;
      const totalShake = speedShakeMag + landingShake;
      const shakeX = totalShake > 0 ? (Math.random() - 0.5) * totalShake : 0;
      const shakeY = totalShake > 0 ? (Math.random() - 0.5) * totalShake : 0;
      const renderCameraX = cameraX + shakeX / zoom;
      const renderCameraY = cameraY + shakeY / zoom;

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground(ctx, canvas.width, canvas.height);

      ctx.save();
      ctx.scale(dpr, dpr);
      drawSkyline(ctx, renderCameraX, viewWidth, viewHeight);
      ctx.restore();

      ctx.save();
      ctx.scale(dpr * zoom, dpr * zoom);
      ctx.translate(-renderCameraX, -renderCameraY);

      const fillBottomY = renderCameraY + viewHeight / zoom + 800;
      drawGround(ctx, terrain, renderCameraX, viewWidth / zoom, fillBottomY);

      for (const trap of terrain.traps) {
        const runtime = trapRuntime.get(trap);
        if (trap.x !== undefined && trap.x < renderCameraX - 200) continue;
        if (trap.x1 !== undefined && trap.x2 < renderCameraX - 200) continue;
        if (trap.anchorX !== undefined && trap.anchorX < renderCameraX - 400) continue;

        if (trap.type === "spike") drawSpike(ctx, trap);
        else if (trap.type === "pitfloor") drawPitFloor(ctx, trap);
        else if (trap.type === "platform" && runtime) drawPlatform(ctx, runtime.body);
        else if (trap.type === "pendulum" && runtime) drawPendulum(ctx, trap, runtime.body);
        else if (trap.type === "blade") drawBlade(ctx, trap, elapsedRef);
      }

      drawExplosion(ctx, dustParticles);
      if (crashed) {
        drawExplosion(ctx, explosionParticles);
      } else {
        drawTrail(ctx, trail);
        drawBike(ctx, bike, rearSpinAngle);
      }
      ctx.restore();

      ctx.save();
      ctx.scale(dpr, dpr);
      drawSpeedLines(ctx, speedLines, viewWidth);
      drawHud(ctx, Math.floor(elapsedRef), canvas.width / dpr);
      ctx.restore();

      ctx.restore();

      if (!gameOverFired) rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      gameOverFired = true;
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resize);
      Events.off(engine, "collisionStart", onCollisionStart);
      Events.off(engine, "collisionEnd", onCollisionEnd);
      Composite.clear(world, false);
      Engine.clear(engine);
      stopEngine();
    };
  }, []);

  return (
    <div className="rider-game__stage" ref={containerRef}>
      <canvas ref={canvasRef} className="rider-game__canvas" />
      <button type="button" className="rider-game__quit" onClick={onQuit}>
        ✕
      </button>
      <p className="rider-game__hint">Hold to accelerate · double-tap to jump</p>
    </div>
  );
}
