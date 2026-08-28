// Small set of synthesized sound effects for the Rider game, using the
// Web Audio API directly - no external audio files to bundle or license.
// Browsers require a user gesture before audio can play, so callers must
// call resumeAudio() from inside a real pointerdown/click handler first.

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

export function resumeAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") ctx.resume();
}

function tone({ freq = 440, freqEnd = null, duration = 0.12, type = "sine", volume = 0.2 }) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (freqEnd !== null) {
    osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + duration);
  }
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function noiseBurst({ duration = 0.15, volume = 0.3 }) {
  const ctx = getCtx();
  if (!ctx) return;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  noise.connect(gain).connect(ctx.destination);
  noise.start();
}

export function playJump() {
  tone({ freq: 340, freqEnd: 640, duration: 0.14, type: "triangle", volume: 0.16 });
}

export function playLand(intensity = 1) {
  noiseBurst({ duration: 0.1, volume: 0.22 * Math.min(1.6, intensity) });
}

export function playCrash() {
  noiseBurst({ duration: 0.32, volume: 0.4 });
  tone({ freq: 130, freqEnd: 35, duration: 0.32, type: "sawtooth", volume: 0.22 });
}

export function playScore() {
  tone({ freq: 820, freqEnd: 1180, duration: 0.11, type: "sine", volume: 0.13 });
}

// Continuous engine hum - a single oscillator whose pitch/volume is
// nudged toward a target each call rather than recreated, so it can be
// updated every physics tick cheaply.
let engineOsc = null;
let engineGain = null;

export function updateEngine(active, speedFraction) {
  const ctx = getCtx();
  if (!ctx) return;

  if (active && !engineOsc) {
    engineOsc = ctx.createOscillator();
    engineGain = ctx.createGain();
    engineOsc.type = "sawtooth";
    engineGain.gain.value = 0.0001;
    engineOsc.connect(engineGain).connect(ctx.destination);
    engineOsc.start();
  }

  if (!engineOsc) return;

  if (active) {
    const freq = 65 + speedFraction * 170;
    const volume = 0.045 + speedFraction * 0.05;
    engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.06);
    engineGain.gain.setTargetAtTime(volume, ctx.currentTime, 0.06);
  } else {
    engineGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
  }
}

export function stopEngine() {
  if (engineOsc) {
    try {
      engineOsc.stop();
    } catch {
      // already stopped - fine
    }
  }
  engineOsc = null;
  engineGain = null;
}
