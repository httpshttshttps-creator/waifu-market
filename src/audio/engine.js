// Audio engine: owns the AudioContext, the on/off settings, autoplay
// unlocking, pausing while the app is in the background, and the UI-wide
// sounds (button taps, sheets opening/closing). The sounds themselves live
// in synth.js, the Ride music in music.js.
//
// Browsers only let audio start after a user gesture, and Telegram's
// webview can be strict about that. So everything here is safe to call
// before the context is unlocked: sounds triggered right on a tap are
// queued for the instant it unlocks, anything else is dropped rather than
// piling up and blasting out later.

import { createGraph } from "./graph.js";
import { SFX, noiseBuffer } from "./synth.js";
import { createMusic } from "./music.js";

const STORAGE_KEY = "vyro.audio.v1";
const GESTURE_WINDOW_MS = 450;
const MUSIC_LEVEL = 0.45;

let audio = null; // { ctx, graph }
let music = null;
let musicWanted = false;
let musicIntensity = 0.5;
let lastGestureAt = 0;
let wasRunningBeforeHide = false;
let initialized = false;

const settingListeners = new Set();
const stateListeners = new Set();

function readSettings() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return { sfx: raw.sfx !== false, music: raw.music !== false };
  } catch {
    return { sfx: true, music: true };
  }
}

let settings = { sfx: true, music: true };

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable - just don't persist */
  }
}

function ensure() {
  if (audio) return audio;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    const ctx = new Ctor({ latencyHint: "interactive" });
    const graph = createGraph(ctx);
    audio = { ctx, graph };
    ctx.addEventListener?.("statechange", () => stateListeners.forEach((cb) => cb(ctx.state)));
    applyGains();
  } catch {
    audio = null;
  }
  return audio;
}

function applyGains() {
  if (!audio) return;
  const { ctx, graph } = audio;
  const now = ctx.currentTime;
  const set = (node, v) => node.gain.setTargetAtTime(v, now, 0.03);
  set(graph.sfxBus, settings.sfx ? 1 : 0);
  set(graph.sfxSend, settings.sfx ? 1 : 0);
  // Music sits well under the effects (jumps, the engine, taps).
  set(graph.musicBus, settings.music ? MUSIC_LEVEL : 0);
  set(graph.musicSend, settings.music ? MUSIC_LEVEL : 0);
}

function tryResume() {
  if (!audio) return;
  if (audio.ctx.state === "suspended") {
    audio.ctx.resume().catch(() => {});
  }
}

// ---------------------------------------------------------------- public

export function unlock() {
  const a = ensure();
  if (!a) return "unsupported";
  tryResume();
  return a.ctx.state;
}

export function isRunning() {
  return audio?.ctx.state === "running";
}

// Lets a component react to the context becoming (un)locked.
export function onAudioStateChange(cb) {
  stateListeners.add(cb);
  return () => stateListeners.delete(cb);
}

export function getSettings() {
  return { ...settings };
}

export function setSetting(key, value) {
  settings = { ...settings, [key]: Boolean(value) };
  persist();
  if (value) unlock();
  applyGains();
  if (key === "music") {
    if (!value) music?.stop(0.25);
    else if (musicWanted) startMusic();
  }
  settingListeners.forEach((cb) => cb({ ...settings }));
}

export function subscribeSettings(cb) {
  settingListeners.add(cb);
  return () => settingListeners.delete(cb);
}

// The context + sfx output, for sounds that manage their own nodes (the
// Ride engine hum). Null when audio is unsupported or switched off.
export function getAudio() {
  if (!settings.sfx) return null;
  const a = ensure();
  return a ? { ctx: a.ctx, out: a.graph.sfxOut, bus: a.graph.sfxBus } : null;
}

export function play(name, options = {}) {
  if (!settings.sfx) return;
  const fn = SFX[name];
  if (!fn) return;
  const a = ensure();
  if (!a) return;
  const { ctx, graph } = a;
  if (ctx.state !== "running") {
    // Not unlocked (or suspended): only keep the sound if it comes straight
    // from a tap - it then plays the moment the context resumes. Anything
    // else is dropped so it doesn't queue up and burst out later.
    if (options.onlyIfRunning) return;
    if (performance.now() - lastGestureAt > GESTURE_WINDOW_MS) return;
    tryResume();
  }
  try {
    fn(ctx, graph.sfxOut, ctx.currentTime + 0.005 + (options.delay ?? 0), options);
  } catch (err) {
    // A sound failing (odd webview, bad node state) must never take the app
    // down with it - drop the sound and carry on.
    console.warn(`Sound "${name}" failed`, err);
  }
}

// ------------------------------------------------------------------ music

export function startMusic() {
  musicWanted = true;
  if (!settings.music) return;
  try {
    const a = ensure();
    if (!a) return;
    if (!music) music = createMusic(a.ctx, a.graph.musicOut, noiseBuffer(a.ctx));
    tryResume();
    music.setIntensity(musicIntensity, 0.05);
    music.start();
  } catch (err) {
    console.warn("Music failed to start", err);
  }
}

export function stopMusic(fadeSeconds = 0.6) {
  musicWanted = false;
  try {
    music?.stop(fadeSeconds);
  } catch {
    /* already gone - fine */
  }
}

export function setMusicIntensity(value, rampSeconds = 0.5) {
  musicIntensity = value;
  try {
    music?.setIntensity(value, rampSeconds);
  } catch {
    /* ignore */
  }
}

export function duckMusic(seconds = 0.8, depth = 0.15) {
  try {
    music?.duck(seconds, depth);
  } catch {
    /* ignore */
  }
}

// -------------------------------------------------------------- UI sounds

const CLICKABLE = "button, [role='button'], a[href], summary, [data-click-sound]";
const BACK_BUTTONS = ".chat-topbar__back, .chat-topbar__close, .rider-game__exit, [aria-label='Close'], [aria-label='Back']";

function soundForTarget(target) {
  const el = target?.closest?.(CLICKABLE);
  if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return null;
  if (el.closest("[data-click-sound='none']")) return null;
  if (el.classList.contains("chat-composer__send")) return null; // it plays "sent" itself
  if (el.classList.contains("bottom-nav__item")) {
    const index = Array.prototype.indexOf.call(el.parentElement?.children ?? [], el);
    return ["nav", { index: Math.max(0, index) }];
  }
  if (el.matches(BACK_BUTTONS) || el.classList.contains("sheet-button--cancel")) return ["back", {}];
  if (el.classList.contains("sheet-button--confirm")) return ["confirm", {}];
  return ["tap", {}];
}

function isSheet(node) {
  return (
    node.nodeType === 1 &&
    node.classList.contains("sheet-overlay") &&
    !node.classList.contains("rider-game__result-overlay")
  );
}

function installUiSounds() {
  // A finger going down on a button is not a press yet - it may be the start
  // of a scroll (dragging through the Leaderboard touches dozens of
  // buttons). So the pointer-down only unlocks audio; the sound plays on
  // "click", which the browser only fires for a completed tap/press.
  document.addEventListener(
    "pointerdown",
    () => {
      lastGestureAt = performance.now();
      unlock();
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    "click",
    (event) => {
      if (!event.isTrusted) return; // ignore programmatic .click() calls
      lastGestureAt = performance.now();
      unlock();
      const hit = soundForTarget(event.target);
      if (hit) play(hit[0], hit[1]);
    },
    { capture: true }
  );

  // Keyboard / assistive activation has no pointerdown (its click is
  // handled above).
  document.addEventListener(
    "keydown",
    () => {
      lastGestureAt = performance.now();
      unlock();
    },
    { capture: true, passive: true }
  );
  document.addEventListener(
    "touchend",
    () => {
      lastGestureAt = performance.now();
      unlock();
    },
    { capture: true, passive: true }
  );

  // Sheets slide up/down all over the app - detect them from the DOM
  // instead of wiring a sound into every sheet component.
  if (typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (isSheet(node)) play("sheetOpen");
        });
        record.removedNodes.forEach((node) => {
          if (isSheet(node)) play("sheetClose");
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

export function initAudio() {
  if (initialized) return;
  initialized = true;
  settings = readSettings();
  ensure();
  installUiSounds();

  // Silence while the app is in the background (Telegram minimized, screen
  // off, another app on top), resume when it's back.
  document.addEventListener("visibilitychange", () => {
    if (!audio) return;
    if (document.hidden) {
      wasRunningBeforeHide = audio.ctx.state === "running";
      audio.ctx.suspend().catch(() => {});
    } else if (wasRunningBeforeHide) {
      audio.ctx.resume().catch(() => {});
    }
  });
}
