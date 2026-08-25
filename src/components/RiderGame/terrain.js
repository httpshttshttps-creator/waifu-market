// Procedural, endless terrain generator for the Rider mini-game.
//
// The world is built as a sequence of "spans" (continuous rideable ground,
// as a polyline of {x,y} points) separated by gaps (pits - no ground at
// all). Alongside the ground, a set of "traps" is generated: some static
// (spikes, a low tunnel ceiling), some genuinely moving (a swinging
// pendulum, a rising/falling platform, a spinning blade).
//
// Terrain is generated in front of the bike and pruned once it scrolls
// far behind the camera, so a run can go on forever without the amount
// of live physics geometry growing without bound. Variety comes from
// picking among several "feature" generators with randomized parameters
// (and a difficulty ramp over time), so consecutive playthroughs - and
// even a single long run - don't fall into an obviously repeating loop.

export const GROUND_STEP = 24; // px between generated ground points
export const GAP_PRUNE_MARGIN = 900; // keep this much world behind the camera

// A gentle floor + ceiling on how steep a single ground step may be,
// so the procedural hills never produce an un-rideable vertical wall.
const MAX_SLOPE_PER_STEP = 11;

function clampSlope(prevY, nextY) {
  const delta = nextY - prevY;
  if (delta > MAX_SLOPE_PER_STEP) return prevY + MAX_SLOPE_PER_STEP;
  if (delta < -MAX_SLOPE_PER_STEP) return prevY - MAX_SLOPE_PER_STEP;
  return nextY;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// ---------------- feature generators ----------------
// Each takes the generator state and a difficulty t in [0,1] and appends
// points to the current span (state.points), possibly starting a new span
// after a gap, and may push trap descriptors into state.traps.

function featureRollingHills(state, t) {
  const amplitude1 = rand(24, 46 + t * 30);
  const wavelength1 = rand(220, 420);
  const amplitude2 = rand(8, 18);
  const wavelength2 = rand(70, 140);
  const phase = rand(0, Math.PI * 2);
  const length = rand(500, 1000);

  const startX = state.cursorX;
  const baseY = state.cursorY;
  let x = state.cursorX;
  while (x < startX + length) {
    x += GROUND_STEP;
    const wave =
      Math.sin((x - startX) / wavelength1 + phase) * amplitude1 +
      Math.sin((x - startX) / wavelength2) * amplitude2;
    const targetY = state.baseline + wave;
    const y = clampSlope(state.cursorY, targetY);
    state.points.push({ x, y });
    state.cursorX = x;
    state.cursorY = y;
  }
  void baseY;
}

function featureGapJump(state, t) {
  // Ramp up, then a gap the player must clear by launching off the ramp,
  // then a landing ramp on the far side.
  const rampLen = rand(140, 210);
  const rampRise = rand(50, 90);
  const gapWidth = rand(150, 220 + t * 90);

  let x = state.cursorX;
  const liftoffY = state.cursorY - rampRise;
  const steps = Math.max(1, Math.round(rampLen / GROUND_STEP));
  for (let i = 1; i <= steps; i++) {
    x = state.cursorX + i * GROUND_STEP;
    const y = state.cursorY - (rampRise * i) / steps;
    state.points.push({ x, y });
  }
  state.cursorX = x;
  state.cursorY = liftoffY;

  // gap - end this span, jump the cursor ahead with no ground points
  state.endSpan();
  state.cursorX += gapWidth;
  state.cursorY = state.baseline + rand(-10, 10);
  state.startSpan(state.cursorX, state.cursorY);

  // short landing ramp back down to baseline
  const landLen = rand(120, 180);
  const landSteps = Math.max(1, Math.round(landLen / GROUND_STEP));
  for (let i = 1; i <= landSteps; i++) {
    const x2 = state.cursorX + i * GROUND_STEP;
    const y2 = state.baseline + rand(-6, 6);
    state.points.push({ x: x2, y: y2 });
    state.cursorX = x2;
    state.cursorY = y2;
  }
}

function featureSpikeRow(state, t) {
  // A small launch bump, then N spikes mounted directly on flat ground -
  // has to be jumped over using speed carried from the bump.
  const bumpRise = rand(26, 40);
  let x = state.cursorX;
  for (const frac of [0.3, 0.7, 1]) {
    x = state.cursorX + frac * 90;
    const y = state.cursorY - bumpRise * Math.sin(frac * Math.PI);
    state.points.push({ x, y });
  }
  state.cursorX = x;
  state.cursorY = state.baseline;

  const flatLen = rand(70, 110);
  x = state.cursorX + flatLen;
  state.points.push({ x, y: state.baseline });
  state.cursorX = x;
  state.cursorY = state.baseline;

  const spikeCount = 1 + Math.floor(rand(0, 2 + t * 2.2));
  const spikeGap = rand(30, 42);
  for (let i = 0; i < spikeCount; i++) {
    const spikeX = state.cursorX + 30 + i * (26 + spikeGap);
    state.traps.push({ type: "spike", x: spikeX, y: state.baseline, width: 24, height: 30 });
    const flatX = spikeX + 26;
    if (flatX > state.cursorX) {
      state.points.push({ x: flatX, y: state.baseline });
      state.cursorX = flatX;
    }
  }

  const tailX = state.cursorX + rand(60, 100);
  state.points.push({ x: tailX, y: state.baseline });
  state.cursorX = tailX;
  state.cursorY = state.baseline;
}

function featureMovingPlatformGap(state, t) {
  const rampLen = 150;
  const rampRise = 40;
  const gapWidth = rand(220, 320 + t * 60);

  let x = state.cursorX;
  const steps = Math.max(1, Math.round(rampLen / GROUND_STEP));
  for (let i = 1; i <= steps; i++) {
    x = state.cursorX + i * GROUND_STEP;
    const y = state.cursorY - (rampRise * i) / steps;
    state.points.push({ x, y });
  }
  state.cursorX = x;
  state.cursorY -= rampRise;

  const platformX = state.cursorX + gapWidth / 2;
  const platformBaseY = state.baseline - rand(10, 40);
  state.traps.push({
    type: "platform",
    x: platformX,
    y: platformBaseY,
    width: 90,
    height: 14,
    travel: rand(35, 70),
    speed: rand(0.9, 1.6 + t * 0.6),
    axis: "y",
  });

  state.endSpan();
  state.cursorX += gapWidth;
  state.cursorY = state.baseline;
  state.startSpan(state.cursorX, state.cursorY);

  const landSteps = Math.max(1, Math.round(140 / GROUND_STEP));
  for (let i = 1; i <= landSteps; i++) {
    const x2 = state.cursorX + i * GROUND_STEP;
    state.points.push({ x: x2, y: state.baseline });
    state.cursorX = x2;
    state.cursorY = state.baseline;
  }
}

function featurePendulum(state, t) {
  featureRollingHills(state, Math.min(t, 0.3));
  const anchorX = state.cursorX - rand(150, 260);
  const length = rand(90, 140);
  state.traps.push({
    type: "pendulum",
    anchorX,
    anchorY: state.baseline - 260,
    length,
    speed: rand(0.7, 1.1 + t * 0.5),
    phase: rand(0, Math.PI * 2),
    radius: 16,
  });
}

function featureRotatingBlade(state, t) {
  const rampLen = 130;
  const rampRise = 34;
  let x = state.cursorX;
  const steps = Math.max(1, Math.round(rampLen / GROUND_STEP));
  for (let i = 1; i <= steps; i++) {
    x = state.cursorX + i * GROUND_STEP;
    const y = state.cursorY - (rampRise * i) / steps;
    state.points.push({ x, y });
    state.cursorX = x;
    state.cursorY = y;
  }

  const flatLen = rand(180, 260);
  const endX = state.cursorX + flatLen;
  state.points.push({ x: endX, y: state.baseline - rampRise * 0.3 });
  state.cursorX = endX;
  state.cursorY = state.baseline - rampRise * 0.3;

  state.traps.push({
    type: "blade",
    x: state.cursorX - flatLen / 2,
    y: state.baseline - rampRise - 46,
    radius: 30,
    speed: rand(2.2, 3.4 + t * 1.2),
  });

  const settleX = state.cursorX + 120;
  state.points.push({ x: settleX, y: state.baseline });
  state.cursorX = settleX;
  state.cursorY = state.baseline;
}

function featureLowTunnel(state, t) {
  const startX = state.cursorX;
  featureRollingHills(state, Math.min(t, 0.2));
  const length = state.cursorX - startX;
  state.traps.push({
    type: "tunnel",
    x1: startX,
    x2: startX + length,
    clearance: rand(130, 160),
  });
}

const FEATURES = [
  { type: "hills", weight: 5, run: featureRollingHills },
  { type: "gap", weight: 3, run: featureGapJump },
  { type: "spikes", weight: 3, run: featureSpikeRow },
  { type: "platform", weight: 2, run: featureMovingPlatformGap },
  { type: "pendulum", weight: 2, run: featurePendulum },
  { type: "blade", weight: 2, run: featureRotatingBlade },
  { type: "tunnel", weight: 2, run: featureLowTunnel },
];

function pickFeature(lastType) {
  const pool = FEATURES.filter((f) => f.type !== lastType || Math.random() < 0.15);
  const totalWeight = pool.reduce((sum, f) => sum + f.weight, 0);
  let roll = rand(0, totalWeight);
  for (const feature of pool) {
    roll -= feature.weight;
    if (roll <= 0) return feature;
  }
  return pool[0];
}

export function createTerrainState(baseline) {
  const state = {
    baseline,
    cursorX: 0,
    cursorY: baseline,
    spans: [],
    points: [],
    traps: [],
    lastFeature: null,
    startSpan(x, y) {
      state.points = [{ x, y }];
      state.spans.push(state.points);
    },
    endSpan() {
      // no-op marker kept for readability at call sites
    },
  };
  state.startSpan(0, baseline);
  return state;
}

// Generates more terrain until the span cursor has reached at least
// targetX, using a difficulty ramp (0 at run start, ~1 after ~90s).
export function generateAhead(state, targetX, elapsedSeconds) {
  const t = Math.min(1, elapsedSeconds / 90);
  while (state.cursorX < targetX) {
    const feature = pickFeature(state.lastFeature);
    feature.run(state, t);
    state.lastFeature = feature.type;
  }
}

// Removes spans/traps that have fully scrolled behind minX - margin.
// Returns the removed traps so callers can clean up their physics bodies.
export function pruneBehind(state, minX) {
  const cutoff = minX - GAP_PRUNE_MARGIN;
  state.spans = state.spans.filter((span) => span[span.length - 1].x > cutoff);

  const keptTraps = [];
  const removedTraps = [];
  for (const trap of state.traps) {
    const rightEdge = trap.x2 ?? trap.x ?? trap.anchorX ?? 0;
    if (rightEdge > cutoff) keptTraps.push(trap);
    else removedTraps.push(trap);
  }
  state.traps = keptTraps;
  return removedTraps;
}
