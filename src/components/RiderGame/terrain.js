// Procedural, endless terrain generator for the Rider mini-game.
//
// The world is built as a sequence of "spans" (continuous rideable ground,
// as a polyline of {x,y} points) separated by gaps. Every gap has a spiked
// floor underneath it (a "pitfloor" trap) - there is no bottomless void,
// so falling short of a jump always ends in a concrete, visible hit
// instead of an endless fall. The ground fill drawn under each span (see
// GameCanvas) extends far below the camera regardless, so a gap always
// reads as a canyon with rock walls, never as empty space.
//
// Ramps that lead into a gap or obstacle register a "boost" zone. Unlike
// a naive "add vertical speed" hack, a boost here is a MULTIPLIER applied
// to the bike's actual velocity vector at the instant it leaves the
// ground - see GameCanvas's grounded->airborne handling. That preserves
// the direction the bike was already travelling (which follows the
// ramp's own slope), so a boosted launch goes further AND higher, never
// just straight up.
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

// Adds a ramp (positive rise = uphill/launch ramp, negative = downhill)
// over `length` px, subdivided into GROUND_STEP-sized points so it still
// reads as a smooth line at the stroke width we draw at. The rise is
// clamped to a climbable angle (~28 degrees) regardless of what the
// caller asks for - a bike with finite engine power can lose almost all
// its speed grinding up anything steeper, which made some jumps
// impossible no matter how fast you arrived.
const MAX_RAMP_SLOPE_RATIO = 0.53; // rise/length ceiling, ~28 degrees

function appendRamp(state, length, rise) {
  const maxRise = length * MAX_RAMP_SLOPE_RATIO;
  const clampedRise = Math.max(-maxRise, Math.min(maxRise, rise));
  const steps = Math.max(1, Math.round(length / GROUND_STEP));
  const startY = state.cursorY;
  let x = state.cursorX;
  for (let i = 1; i <= steps; i++) {
    x = state.cursorX + i * (length / steps);
    const y = startY - (clampedRise * i) / steps;
    state.points.push({ x, y });
  }
  state.cursorX = x;
  state.cursorY = startY - clampedRise;
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

// Registers a launch multiplier for leaving the ground anywhere in
// [x1, x2] - see GameCanvas's grounded->airborne transition handling.
// `multiplier` scales the bike's actual (vx, vy) at liftoff, so the
// launch always goes in the direction the bike was already travelling.
function addBoost(state, x1, x2, multiplier) {
  state.boosts.push({ x1, x2, multiplier });
}

// ---------------- feature generators ----------------
// Each takes the generator state and a difficulty t in [0,1] and appends
// points to the current span (state.points), possibly starting a new span
// after a gap, and may push trap/boost descriptors.

// The main filler terrain: a chain of straight uphill/downhill ramps
// meeting at distinct peaks and valleys (mountain-range silhouette, not
// smooth waves). Every uphill leg gets a mild boost zone, so cresting
// any ordinary peak while accelerating gives real, consistent air.
function featureTerrainChain(state, t) {
  const legCount = 3 + Math.floor(rand(0, 3));
  for (let i = 0; i < legCount; i++) {
    const goingUp = Math.random() < 0.55;
    const length = rand(130, 240);
    const rise = goingUp ? rand(50, 110 + t * 40) : -rand(40, 100 + t * 30);

    if (goingUp) {
      const boostStart = state.cursorX + length * 0.35;
      appendRamp(state, length, rise);
      addBoost(state, boostStart, state.cursorX, 1.25 + t * 0.15);
    } else {
      appendRamp(state, length, rise);
    }
  }
  appendFlat(state, rand(50, 120));
}

// A gentler, smoother rolling stretch for texture variety between the
// sharper mountain-chain sections.
function featureRollingHills(state, t) {
  const amplitude = rand(18, 34 + t * 14);
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

function featureGapJump(state, t) {
  const rampLen = rand(160, 220);
  const rampRise = rand(70, 110);
  const gapWidth = rand(140, 190 + t * 60);

  const boostStart = state.cursorX + rampLen * 0.4;
  appendRamp(state, rampLen, rampRise);
  addBoost(state, boostStart, state.cursorX, 1.8 + gapWidth / 500);

  openGap(state, gapWidth, state.baseline + rand(-6, 6));
  appendRamp(state, 90, -26); // gentle downward-sloped landing ramp
  appendFlat(state, rand(90, 140));
}

function featureSpikeRow(state, t) {
  // A launch bump, then N spikes mounted directly on flat ground - has
  // to be jumped over using the boost from the bump.
  const bumpLen = 110;
  const bumpRise = rand(34, 46);
  const boostStart = state.cursorX + bumpLen * 0.5;
  appendRamp(state, bumpLen * 0.5, bumpRise);
  appendRamp(state, bumpLen * 0.5, -bumpRise);

  const spikeCount = 1 + Math.floor(rand(0, 2 + t * 1.5));
  addBoost(state, boostStart, state.cursorX + 30, 1.55 + spikeCount * 0.12);

  appendFlat(state, 40);
  for (let i = 0; i < spikeCount; i++) {
    const spikeX = state.cursorX + 24;
    state.traps.push({ type: "spike", x: spikeX, y: state.baseline, width: 26, height: 30 });
    state.cursorX = spikeX + 24;
    state.cursorY = state.baseline;
    state.points.push({ x: state.cursorX, y: state.baseline });
  }

  appendFlat(state, rand(80, 120));
}

function featureMovingPlatformGap(state, t) {
  const rampLen = 160;
  const rampRise = 48;
  const gapWidth = rand(220, 280 + t * 40);

  const boostStart = state.cursorX + rampLen * 0.4;
  appendRamp(state, rampLen, rampRise);
  addBoost(state, boostStart, state.cursorX, 1.9 + gapWidth / 400);

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
    speed: rand(0.7, 1.1 + t * 0.4),
    phase: rand(0, Math.PI * 2),
    radius: 16,
  });
}

function featureSpikyBall(state, t) {
  const rampLen = 150;
  const rampRise = 44;
  const boostStart = state.cursorX + rampLen * 0.4;
  appendRamp(state, rampLen, rampRise);
  addBoost(state, boostStart, state.cursorX, 2.0 + t * 0.2);

  const flatLen = rand(200, 260);
  const ballX = state.cursorX + flatLen / 2;
  const ballY = state.cursorY - 75;

  appendFlat(state, flatLen);

  state.traps.push({
    type: "blade",
    x: ballX,
    y: ballY,
    radius: 26,
    speed: rand(1.6, 2.6 + t * 0.8),
  });

  appendRamp(state, 90, -rampRise * 0.6);
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
