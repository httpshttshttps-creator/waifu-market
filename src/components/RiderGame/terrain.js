// Procedural, endless terrain generator for the Rider mini-game.
//
// Jumping is now a discrete player action (double-tap - see GameCanvas),
// not something the terrain has to set up via launch ramps. That means
// gaps and obstacles no longer need a preceding ramp to be clearable -
// they just need to be sized within reach of the bike's fixed jump arc,
// which GameCanvas controls independently of terrain shape. Ramps still
// exist for texture/visual variety (rolling hills, mountain-chain
// peaks), but they're no longer functionally required to clear anything.
//
// The world is built as a sequence of "spans" (continuous rideable ground,
// as a polyline of {x,y} points) separated by gaps. Every gap has a spiked
// floor underneath it (a "pitfloor" trap) - there is no bottomless void,
// so mistiming a jump always ends in a concrete, visible hit instead of
// an endless fall. The ground fill drawn under each span (see
// GameCanvas) extends far below the camera regardless, so a gap always
// reads as a canyon with rock walls, never as empty space.
//
// Terrain is generated ahead of the bike and pruned once it scrolls far
// behind the camera, so a run can go on forever without the amount of
// live physics geometry growing without bound. Variety comes from
// picking among several "feature" generators with randomized parameters
// (and a difficulty ramp over time), so consecutive playthroughs - and
// even a single long run - don't fall into an obviously repeating loop.

export const GROUND_STEP = 24; // px between generated ground points
export const GAP_PRUNE_MARGIN = 900; // keep this much world behind the camera
export const PIT_DEPTH = 260; // how far below baseline a gap's spike floor sits
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

// Adds a ramp (positive rise = uphill, negative = downhill) over
// `length` px, subdivided into GROUND_STEP-sized points so it still
// reads as a smooth line at the stroke width we draw at. The rise is
// clamped to a climbable angle (~28 degrees) regardless of what the
// caller asks for, and additionally clamped per-point relative to
// whatever point actually precedes it (not just this ramp's own start),
// so the joint where one ramp meets the next can never be a sharp
// instant corner either - a rigid two-wheel bike bridging a sharp
// peak/valley corner "high-centers" on it even when each leg's own
// average slope is individually fine.
const MAX_RAMP_SLOPE_RATIO = 0.53; // rise/length ceiling, ~28 degrees

function appendRamp(state, length, rise) {
  const maxRise = length * MAX_RAMP_SLOPE_RATIO;
  const clampedRise = Math.max(-maxRise, Math.min(maxRise, rise));
  const steps = Math.max(1, Math.round(length / GROUND_STEP));
  const startY = state.cursorY;
  let x = state.cursorX;
  for (let i = 1; i <= steps; i++) {
    x = state.cursorX + i * (length / steps);
    const targetY = startY - (clampedRise * i) / steps;
    const y = clampSlope(state.cursorY, targetY);
    state.points.push({ x, y });
    state.cursorX = x;
    state.cursorY = y;
  }
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

// ---------------- feature generators ----------------
// Each takes the generator state and a difficulty t in [0,1] and appends
// points to the current span (state.points), possibly starting a new span
// after a gap, and may push trap descriptors.

// The main filler terrain: a chain of straight uphill/downhill ramps
// meeting at distinct peaks and valleys (mountain-range silhouette, not
// smooth waves) - purely texture now, no launch function to serve.
function featureTerrainChain(state, t) {
  const legCount = 3 + Math.floor(rand(0, 3));
  for (let i = 0; i < legCount; i++) {
    const goingUp = Math.random() < 0.55;
    const length = rand(130, 240);
    // Gentle on purpose: at the bike's speed, a steep peak here would
    // launch it into the air on its own (pure inertia carrying it off
    // the crest) even without a double-tap - the ONLY way to get air
    // should be the deliberate jump action, not terrain shape.
    const rise = goingUp ? rand(14, 30 + t * 10) : -rand(14, 30 + t * 10);
    appendRamp(state, length, rise);
  }
  appendFlat(state, rand(50, 120));
}

// A gentler, smoother rolling stretch for texture variety between the
// sharper mountain-chain sections.
function featureRollingHills(state, t) {
  const amplitude = rand(12, 22 + t * 8); // kept gentle - even smooth waves can launch the bike at this speed
  const wavelength = rand(280, 460);
  const phase = rand(0, Math.PI * 2);
  const length = rand(400, 700);

  const startX = state.cursorX;
  let x = state.cursorX;
  while (x < startX + length) {
    x += GROUND_STEP;
    const wave = Math.sin((x - startX) / wavelength + phase) * amplitude;
    const targetY = state.baseline + wave;
    const y = clampSlope(state.cursorY, targetY);
    state.points.push({ x, y });
    state.cursorX = x;
    state.cursorY = y;
  }
}

// A flat-approach gap - no launch ramp needed, clearing it is entirely
// down to timing the (fixed) double-tap jump. Sized a bit wider than the
// old ramp-assisted version since jump timing is now fully reliable.
function featureGapJump(state, t) {
  const gapWidth = rand(170, 230 + t * 90);
  appendFlat(state, rand(60, 100));
  openGap(state, gapWidth, state.baseline);
  appendFlat(state, rand(90, 140));
}

function featureSpikeRow(state, t) {
  const spikeCount = 1 + Math.floor(rand(0, 3 + t * 1.5));
  appendFlat(state, rand(60, 100));
  for (let i = 0; i < spikeCount; i++) {
    const spikeX = state.cursorX + 24;
    state.traps.push({ type: "spike", x: spikeX, y: state.baseline, width: 26, height: 30 });
    state.cursorX = spikeX + 24;
    state.cursorY = state.baseline;
    state.points.push({ x: state.cursorX, y: state.baseline });
  }
  appendFlat(state, rand(80, 120));
}

// A wide gap bridged only by a moving platform - jump onto it and time
// a second jump off, or clear the whole thing in one jump if you're
// confident. Wider than before, so the platform is more often the
// actual intended path rather than an optional shortcut.
function featureMovingPlatformGap(state, t) {
  const gapWidth = rand(240, 300 + t * 60);
  appendFlat(state, rand(60, 100));

  const platformX = state.cursorX + gapWidth / 2;
  const platformBaseY = state.baseline - rand(20, 50);
  state.traps.push({
    type: "platform",
    x: platformX,
    y: platformBaseY,
    width: 100,
    height: 16,
    travel: rand(30, 55),
    speed: rand(0.9, 1.4 + t * 0.4),
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
    speed: rand(0.8, 1.3 + t * 0.45),
    phase: rand(0, Math.PI * 2),
    radius: 16,
  });
}

// An elevated hazard mounted over flat ground - has to be jumped clear
// of with good timing, no ramp to lean on.
function featureSpikyBall(state, t) {
  const flatLen = rand(200, 260);
  const ballX = state.cursorX + flatLen / 2;
  const ballY = state.baseline - rand(70, 95);

  appendFlat(state, flatLen);

  state.traps.push({
    type: "blade",
    x: ballX,
    y: ballY,
    radius: 26,
    speed: rand(1.8, 2.8 + t * 0.8),
  });

  appendFlat(state, 100);
}

const FEATURES = [
  { type: "chain", weight: 6, run: featureTerrainChain },
  { type: "hills", weight: 3, run: featureRollingHills },
  { type: "gap", weight: 3, run: featureGapJump },
  { type: "spikes", weight: 3, run: featureSpikeRow },
  { type: "platform", weight: 2, run: featureMovingPlatformGap },
  { type: "pendulum", weight: 2, run: featurePendulum },
  { type: "ball", weight: 2, run: featureSpikyBall },
];

function pickFeature(lastType) {
  const pool = FEATURES.filter((f) => f.type !== lastType || Math.random() < 0.2);
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

// Removes spans/traps that have fully scrolled behind minX - margin.
// Returns the removed traps so callers can clean up their physics
// bodies.
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
