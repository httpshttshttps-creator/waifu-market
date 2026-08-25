// Procedural, endless terrain generator for the Rider mini-game.
//
// The world is built as a sequence of "spans" (continuous rideable ground,
// as a polyline of {x,y} points) separated by gaps. Every gap has a spiked
// floor underneath it (a "pitfloor" trap) - there is no bottomless void,
// so falling short of a jump always ends in a concrete, visible hit
// instead of an endless fall.
//
// Alongside the ground, a set of "traps" is generated: some static
// (spikes, a low tunnel ceiling), some genuinely moving (a swinging
// pendulum, a rising/falling platform, a spinning blade). Ramps that lead
// into a gap or obstacle also register a "boost" zone - leaving the
// ground inside one guarantees a strong minimum launch, tuned per
// obstacle so every gap/jump is reliably clearable, not just physically
// possible if you happen to carry perfect speed.
//
// Terrain is generated ahead of the bike and pruned once it scrolls far
// behind the camera, so a run can go on forever without the amount of
// live physics geometry growing without bound. Variety comes from
// picking among several "feature" generators with randomized parameters
// (and a difficulty ramp over time), so consecutive playthroughs - and
// even a single long run - don't fall into an obviously repeating loop.

export const GROUND_STEP = 24; // px between generated ground points
export const GAP_PRUNE_MARGIN = 900; // keep this much world behind the camera
export const PIT_DEPTH = 240; // how far below baseline a gap's spike floor sits
export const SAFE_START_LENGTH = 560; // guaranteed flat, trap-free run-up at spawn

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

// Adds a straight/flat run of ground points from the current cursor.
function appendFlat(state, length) {
  const steps = Math.max(1, Math.round(length / GROUND_STEP));
  for (let i = 1; i <= steps; i++) {
    const x = state.cursorX + GROUND_STEP;
    state.points.push({ x, y: state.baseline });
    state.cursorX = x;
    state.cursorY = state.baseline;
  }
}

// Adds a ramp (positive rise = uphill/launch ramp) over `length` px.
function appendRamp(state, length, rise) {
  const steps = Math.max(1, Math.round(length / GROUND_STEP));
  const startY = state.cursorY;
  let x = state.cursorX;
  for (let i = 1; i <= steps; i++) {
    x = state.cursorX + i * (length / steps);
    const y = startY - (rise * i) / steps;
    state.points.push({ x, y });
  }
  state.cursorX = x;
  state.cursorY = startY - rise;
}

// Opens a gap of `width` px, flooring it with spikes so it's never a
// bottomless void, then starts a new span on the far side at `landY`.
function openGap(state, width, landY) {
  const gapStartX = state.cursorX;
  const gapEndX = state.cursorX + width;

  state.traps.push({
    type: "pitfloor",
    x1: gapStartX,
    x2: gapEndX,
    y: state.baseline + PIT_DEPTH,
  });

  state.cursorX = gapEndX;
  state.cursorY = landY;
  state.startSpan(state.cursorX, state.cursorY);
}

// Registers a guaranteed-minimum launch for leaving the ground anywhere
// in [x1, x2] - see GameCanvas's grounded->airborne transition handling.
function addBoost(state, x1, x2, power) {
  state.boosts.push({ x1, x2, power });
}

// ---------------- feature generators ----------------
// Each takes the generator state and a difficulty t in [0,1] and appends
// points to the current span (state.points), possibly starting a new span
// after a gap, and may push trap/boost descriptors.

function featureRollingHills(state, t) {
  const amplitude1 = rand(20, 40 + t * 22);
  const wavelength1 = rand(260, 460);
  const amplitude2 = rand(6, 14);
  const wavelength2 = rand(90, 160);
  const phase = rand(0, Math.PI * 2);
  const length = rand(500, 1000);

  const startX = state.cursorX;
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
}

// Sharp, angular mountain-peak terrain - straight ramp segments meeting
// at distinct vertices (uphill/downhill legs), rather than smooth curves.
// Every uphill leg gets its own boost zone, so cresting any peak here
// gives real air, not just the scripted gap/spike/blade features.
function featureAngularPeaks(state, t) {
  const peakCount = 2 + Math.floor(rand(0, 2 + t));
  for (let i = 0; i < peakCount; i++) {
    const upLen = rand(110, 220);
    const upRise = rand(70, 150 + t * 60);
    const boostStart = state.cursorX + upLen * 0.4;
    appendRamp(state, upLen, upRise);
    addBoost(state, boostStart, state.cursorX, 20 + upRise / 6);

    const downLen = rand(110, 220);
    const downDrop = rand(50, 120 + t * 50);
    appendRamp(state, downLen, -downDrop);
  }
  appendFlat(state, rand(60, 140));
}

function featureGapJump(state, t) {
  const rampLen = rand(150, 210);
  const rampRise = rand(60, 95);
  const gapWidth = rand(150, 210 + t * 70);

  const boostStart = state.cursorX + rampLen * 0.55;
  appendRamp(state, rampLen, rampRise);
  addBoost(state, boostStart, state.cursorX, 34 + gapWidth / 12);

  openGap(state, gapWidth, state.baseline + rand(-6, 6));
  appendRamp(state, 90, -28); // gentle downward-sloped landing ramp
  appendFlat(state, rand(90, 140));
}

function featureSpikeRow(state, t) {
  // A launch bump, then N spikes mounted directly on flat ground - has
  // to be jumped over using the boost from the bump.
  const bumpLen = 100;
  const bumpRise = rand(30, 42);
  const boostStart = state.cursorX + bumpLen * 0.5;
  appendRamp(state, bumpLen * 0.5, bumpRise);
  appendRamp(state, bumpLen * 0.5, -bumpRise);

  const spikeCount = 1 + Math.floor(rand(0, 2 + t * 2));
  addBoost(state, boostStart, state.cursorX + 30, 26 + spikeCount * 5);

  appendFlat(state, 40);
  for (let i = 0; i < spikeCount; i++) {
    const spikeX = state.cursorX + 24;
    state.traps.push({ type: "spike", x: spikeX, y: state.baseline, width: 26, height: 32 });
    state.cursorX = spikeX + 24;
    state.cursorY = state.baseline;
    state.points.push({ x: state.cursorX, y: state.baseline });
  }

  appendFlat(state, rand(70, 110));
}

function featureMovingPlatformGap(state, t) {
  const rampLen = 150;
  const rampRise = 44;
  const gapWidth = rand(230, 300 + t * 50);

  const boostStart = state.cursorX + rampLen * 0.5;
  appendRamp(state, rampLen, rampRise);
  addBoost(state, boostStart, state.cursorX, 32 + gapWidth / 14);

  const platformX = state.cursorX + gapWidth / 2;
  const platformBaseY = state.baseline - rand(20, 50);
  state.traps.push({
    type: "platform",
    x: platformX,
    y: platformBaseY,
    width: 96,
    height: 16,
    travel: rand(30, 60),
    speed: rand(0.9, 1.5 + t * 0.5),
  });

  openGap(state, gapWidth, state.baseline);
  appendFlat(state, 140);
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
    speed: rand(0.7, 1.1 + t * 0.4),
    phase: rand(0, Math.PI * 2),
    radius: 16,
  });
}

function featureRotatingBlade(state, t) {
  const rampLen = 140;
  const rampRise = 40;
  const boostStart = state.cursorX + rampLen * 0.5;
  appendRamp(state, rampLen, rampRise);
  addBoost(state, boostStart, state.cursorX, 38);

  const flatLen = rand(200, 280);
  const bladeX = state.cursorX + flatLen / 2;
  const bladeY = state.cursorY - 70;

  appendFlat(state, flatLen);

  state.traps.push({
    type: "blade",
    x: bladeX,
    y: bladeY,
    radius: 28,
    speed: rand(2, 3.2 + t * 1),
  });

  appendRamp(state, 90, -rampRise * 0.6);
  appendFlat(state, 100);
}

function featureLowTunnel(state, t) {
  const startX = state.cursorX;
  featureRollingHills(state, Math.min(t, 0.15));
  const length = state.cursorX - startX;
  state.traps.push({
    type: "tunnel",
    x1: startX,
    x2: startX + length,
    clearance: rand(150, 180),
  });
}

const FEATURES = [
  { type: "hills", weight: 4, run: featureRollingHills },
  { type: "peaks", weight: 4, run: featureAngularPeaks },
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
    boosts: [],
    lastFeature: null,
    startSpan(x, y) {
      state.points = [{ x, y }];
      state.spans.push(state.points);
    },
  };
  state.startSpan(0, baseline);
  // Guaranteed flat, trap-free run-up so a run never starts by dropping
  // the player straight onto an obstacle before they can react.
  appendFlat(state, SAFE_START_LENGTH);
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

// Removes spans/traps/boosts that have fully scrolled behind minX -
// margin. Returns the removed traps so callers can clean up their
// physics bodies.
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

  state.boosts = state.boosts.filter((boost) => boost.x2 > cutoff);

  return removedTraps;
}
