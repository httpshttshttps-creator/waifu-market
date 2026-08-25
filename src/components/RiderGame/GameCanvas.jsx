import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { createTerrainState, generateAhead, pruneBehind, GAP_PRUNE_MARGIN } from "./terrain.js";

const { Engine, Body, Bodies, Composite, Constraint, Events } = Matter;

// Collision categories - kept simple: the bike's wheels are only allowed
// to rest on "ground" (real terrain AND the safe moving platforms), while
// touching anything in "trap" ends the run immediately. The chassis
// touching either ground or a trap also ends the run (you can't land on
// your frame).
const CATEGORY_GROUND = 0x0002;
const CATEGORY_BIKE = 0x0004;
const CATEGORY_TRAP = 0x0008;

// Tuned by feel to match a "Rider"-style reference: floaty gravity, big
// dramatic hang time on every ramp crest, modest controllable forward
// speed. Propulsion and jump strength are deliberately decoupled: a
// generic launch boost fires on ANY grounded->airborne transition (so
// cresting an ordinary hill always gives real air), and obstacle-specific
// "boost" zones from terrain.js layer on top of that to guarantee gaps
// and hazards are always clearable.
const GRAVITY_Y = 0.72;
const FORWARD_FORCE = 0.0032;
const MAX_SPEED = 8.5;
const REAR_WHEEL_SPIN = 0.5;
const FRONT_WHEEL_SPIN = 0.35;
const AIR_PITCH_TORQUE = 0.0016;
const AUTO_LEVEL_GAIN = 0.05;
const AUTO_LEVEL_DAMPING = 0.02;
const FALL_DEATH_OFFSET = 900; // generous last-resort net; the real catch is the pit's spike floor
const CAMERA_LEAD_X = 0.32;
const CAMERA_LEAD_Y = 0.5;
const FIXED_DT = 1000 / 60; // fixed physics step for smooth, frame-rate-independent motion
const MAX_STEPS_PER_FRAME = 5; // avoid a "spiral of death" after a tab switch/lag spike
const EXPLOSION_DURATION = 750;
const GENERIC_LAUNCH_BOOST = 16; // baseline pop when leaving ground outside any scripted zone
const TRAIL_LENGTH = 16; // rear-wheel light-trail particle count

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
  const wheelRadius = 11;
  const wheelBase = 34;
  const rideHeight = 10;

  const chassis = Bodies.rectangle(x, y, 42, 10, {
    collisionFilter: { group, category: CATEGORY_BIKE, mask: CATEGORY_GROUND | CATEGORY_TRAP },
    density: 0.0028,
    friction: 0.3,
    frictionAir: 0.014,
    label: "chassis",
  });

  const rearWheel = Bodies.circle(x - wheelBase / 2, y + rideHeight, wheelRadius, {
    collisionFilter: { group, category: CATEGORY_BIKE, mask: CATEGORY_GROUND | CATEGORY_TRAP },
    friction: 0.96,
    frictionStatic: 1.4,
    density: 0.012,
    label: "wheel",
  });

  const frontWheel = Bodies.circle(x + wheelBase / 2, y + rideHeight, wheelRadius, {
    collisionFilter: { group, category: CATEGORY_BIKE, mask: CATEGORY_GROUND | CATEGORY_TRAP },
    friction: 0.96,
    frictionStatic: 1.4,
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
    friction: 0.92,
    collisionFilter: { category: CATEGORY_GROUND, mask: CATEGORY_BIKE },
    label: "ground",
  });
}

function buildTrapBody(trap, baseline) {
  switch (trap.type) {
    case "spike":
      // Hitbox closely matches the drawn triangle - grazing it should count.
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
        friction: 0.9,
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
    case "tunnel": {
      const midX = (trap.x1 + trap.x2) / 2;
      const length = trap.x2 - trap.x1;
      const ceilingThickness = 40;
      return Bodies.rectangle(midX, baseline - trap.clearance - ceilingThickness / 2, length, ceilingThickness, {
        isStatic: true,
        collisionFilter: { category: CATEGORY_TRAP, mask: CATEGORY_BIKE },
        label: "trap",
      });
    }
    default:
      return null;
  }
}

// ---------------- rendering ----------------

function drawBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#3a0f1f");
  gradient.addColorStop(1, "#1c0812");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

// Cheap low-poly "mountain skyline" silhouette, parallax-scrolled slower
// than the foreground so it reads as distant background, not more track.
// Drawn in plain screen space (no camera translate) - only horizontal
// scroll is derived from cameraX, for a cheap parallax effect.
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

function drawGround(ctx, terrain, cameraX, width) {
  ctx.save();
  ctx.lineWidth = 7;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = "#f2c14e";
  ctx.shadowBlur = 28;
  ctx.strokeStyle = "#ffedb0";

  for (const span of terrain.spans) {
    if (span.length < 2) continue;
    const last = span[span.length - 1];
    const first = span[0];
    if (last.x < cameraX - 50 || first.x > cameraX + width + 50) continue;

    // Finite-depth "torn cliff" fill under the ribbon (jagged bottom
    // edge, not an endless void) - matches the reference's floating
    // track-piece look.
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#170a12";
    ctx.beginPath();
    ctx.moveTo(span[0].x, span[0].y);
    for (let i = 1; i < span.length; i++) ctx.lineTo(span[i].x, span[i].y);
    const cliffDepth = 140;
    let jagX = last.x;
    while (jagX > first.x) {
      const toothY = last.y + cliffDepth + (Math.sin(jagX * 0.15) * 10);
      ctx.lineTo(jagX, toothY);
      jagX -= 18;
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(span[0].x, span[0].y);
    for (let i = 1; i < span.length; i++) ctx.lineTo(span[i].x, span[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpike(ctx, trap) {
  ctx.save();
  ctx.shadowColor = "#ff4d4d";
  ctx.shadowBlur = 24;
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
  ctx.shadowBlur = 22;
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
  ctx.shadowBlur = 20;
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
  ctx.shadowBlur = 26;
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
  ctx.shadowBlur = 26;
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

function drawTunnel(ctx, body) {
  ctx.save();
  ctx.shadowColor = "#8b5fe0";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "rgba(139, 95, 224, 0.28)";
  ctx.strokeStyle = "#b79dff";
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

function drawTrail(ctx, trailPoints) {
  if (trailPoints.length < 2) return;
  ctx.save();
  for (let i = 1; i < trailPoints.length; i++) {
    const p0 = trailPoints[i - 1];
    const p1 = trailPoints[i];
    const alpha = i / trailPoints.length;
    ctx.strokeStyle = `rgba(255, 110, 199, ${alpha * 0.55})`;
    ctx.shadowColor = "#ff6ec7";
    ctx.shadowBlur = 12;
    ctx.lineWidth = 4 * alpha;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBike(ctx, bike, gasHeld) {
  const { chassis, rearWheel, frontWheel, wheelRadius } = bike;

  ctx.save();
  ctx.strokeStyle = gasHeld ? "#ffffff" : "#bfe4ff";
  ctx.shadowColor = "#3aa0ff";
  ctx.shadowBlur = 20;
  ctx.lineWidth = 3;
  for (const wheel of [rearWheel, frontWheel]) {
    ctx.beginPath();
    ctx.arc(wheel.position.x, wheel.position.y, wheelRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wheel.position.x, wheel.position.y);
    ctx.lineTo(
      wheel.position.x + Math.cos(wheel.angle) * wheelRadius,
      wheel.position.y + Math.sin(wheel.angle) * wheelRadius
    );
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(chassis.position.x, chassis.position.y);
  ctx.rotate(chassis.angle);
  ctx.shadowColor = "#3aa0ff";
  ctx.shadowBlur = 22;
  ctx.strokeStyle = "#5fb8ff";
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-21, 0);
  ctx.lineTo(21, 0);
  ctx.stroke();

  ctx.strokeStyle = "#eaf6ff";
  ctx.shadowColor = "#eaf6ff";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(12, -12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(-3, -10);
  ctx.stroke();
  ctx.restore();
}

function drawExplosion(ctx, particles) {
  ctx.save();
  for (const p of particles) {
    const alpha = Math.max(0, 1 - p.age / p.life);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
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
  ctx.shadowColor = "#f2c14e";
  ctx.shadowBlur = 14;
  ctx.fillText(label, width / 2, 14 + 18);
  ctx.restore();
}

function createExplosionParticles(x, y) {
  const colors = ["#ff6ec7", "#4fe3ff", "#ffd989", "#ffffff"];
  const particles = [];
  for (let i = 0; i < 26; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 4,
      life: 400 + Math.random() * 350,
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
    const bike = createBike(160, baseline - 100);
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
        const body = buildTrapBody(trap, terrain.baseline);
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
    function onPointerDown(event) {
      event.preventDefault();
      gasRef.current = true;
    }
    function onPointerUp() {
      gasRef.current = false;
    }
    function onKeyDown(event) {
      if (event.code === "Space" || event.code === "ArrowUp") gasRef.current = true;
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
    let wasGrounded = false;
    const trail = [];

    function stepPhysics(dtMs) {
      elapsedRef += dtMs / 1000;

      const grounded = groundContacts > 0;

      if (gasRef.current) {
        if (grounded) {
          Body.applyForce(bike.chassis, bike.chassis.position, { x: FORWARD_FORCE, y: 0 });
          Body.setAngularVelocity(bike.rearWheel, REAR_WHEEL_SPIN);
          Body.setAngularVelocity(bike.frontWheel, FRONT_WHEEL_SPIN);
        } else {
          Body.setAngularVelocity(
            bike.chassis,
            Math.min(bike.chassis.angularVelocity + AIR_PITCH_TORQUE * dtMs, 0.15)
          );
        }
      } else if (!grounded) {
        const correction =
          -bike.chassis.angle * AUTO_LEVEL_GAIN - bike.chassis.angularVelocity * AUTO_LEVEL_DAMPING;
        Body.setAngularVelocity(bike.chassis, bike.chassis.angularVelocity + correction);
      }

      if (bike.chassis.velocity.x > MAX_SPEED) {
        Body.setVelocity(bike.chassis, { x: MAX_SPEED, y: bike.chassis.velocity.y });
      }

      // Leaving the ground inside a boost zone guarantees a strong,
      // obstacle-tuned minimum launch (terrain.js's addBoost calls).
      // Cresting ANY ordinary ramp while gassing it also pops you up -
      // matches the reference's floaty, always-getting-air feel instead
      // of only the scripted obstacles having real jumps.
      if (wasGrounded && !grounded) {
        const bikeX = bike.chassis.position.x;
        const activeBoost = terrain.boosts.find((b) => bikeX >= b.x1 && bikeX <= b.x2);
        const power = activeBoost ? activeBoost.power : gasRef.current ? GENERIC_LAUNCH_BOOST : 0;
        if (power > 0) {
          const speedFraction = Math.min(1, Math.max(0, bike.chassis.velocity.x / MAX_SPEED));
          const kick = power * (0.65 + 0.35 * speedFraction);
          const targetVy = -kick;
          if (bike.chassis.velocity.y > targetVy) {
            Body.setVelocity(bike.chassis, { x: bike.chassis.velocity.x, y: targetVy });
          }
        }
      }
      wasGrounded = grounded;

      trail.push({ x: bike.rearWheel.position.x, y: bike.rearWheel.position.y });
      if (trail.length > TRAIL_LENGTH) trail.shift();

      generateAhead(terrain, bike.chassis.position.x + 1500, elapsedRef);
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

      const viewWidth = container.clientWidth;
      const viewHeight = container.clientHeight;
      const targetX = bike.chassis.position.x - viewWidth * CAMERA_LEAD_X;
      const targetY = bike.chassis.position.y - viewHeight * CAMERA_LEAD_Y;
      cameraX += (targetX - cameraX) * 0.08;
      cameraY += (targetY - cameraY) * 0.06;

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground(ctx, canvas.width, canvas.height);

      ctx.save();
      ctx.scale(dpr, dpr);
      drawSkyline(ctx, cameraX, viewWidth, viewHeight);
      ctx.restore();

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(-cameraX, -cameraY);
      drawGround(ctx, terrain, cameraX, viewWidth);

      for (const trap of terrain.traps) {
        const runtime = trapRuntime.get(trap);
        if (trap.x !== undefined && trap.x < cameraX - 200) continue;
        if (trap.x1 !== undefined && trap.x2 < cameraX - 200) continue;
        if (trap.anchorX !== undefined && trap.anchorX < cameraX - 400) continue;

        if (trap.type === "spike") drawSpike(ctx, trap);
        else if (trap.type === "pitfloor") drawPitFloor(ctx, trap);
        else if (trap.type === "platform" && runtime) drawPlatform(ctx, runtime.body);
        else if (trap.type === "pendulum" && runtime) drawPendulum(ctx, trap, runtime.body);
        else if (trap.type === "blade") drawBlade(ctx, trap, elapsedRef);
        else if (trap.type === "tunnel" && runtime) drawTunnel(ctx, runtime.body);
      }

      if (crashed) {
        drawExplosion(ctx, explosionParticles);
      } else {
        drawTrail(ctx, trail);
        drawBike(ctx, bike, gasRef.current);
      }
      ctx.restore();

      ctx.save();
      ctx.scale(dpr, dpr);
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
    };
  }, []);

  return (
    <div className="rider-game__stage" ref={containerRef}>
      <canvas ref={canvasRef} className="rider-game__canvas" />
      <button type="button" className="rider-game__quit" onClick={onQuit}>
        ✕
      </button>
      <p className="rider-game__hint">Hold anywhere to accelerate</p>
    </div>
  );
}
