import { useEffect, useRef, useState } from "react";

// VYRO drops in as chunky 3D letters (see the .vyro-* rules in index.css).
// Each letter is a stack of LAYERS copies of the glyph pushed apart along Z,
// which reads as a solid extruded letter while it tumbles - plain DOM +
// CSS 3D, no WebGL/three.js needed.
const LAYERS = 16;

// Where each letter starts (off-screen above, close to the camera, mid-
// tumble) and the small tilt/offset it comes to rest at, so the word
// lands with a little playful wobble instead of a rigid line.
const LETTERS = [
  { ch: "V", x0: "-38vw", y0: "-74vh", z0: "320px", rx0: "-520deg", ry0: "380deg", rz0: "-160deg", rxf: "-4deg", ryf: "7deg", rzf: "-5deg", dy: "4px" },
  { ch: "Y", x0: "14vw", y0: "-88vh", z0: "260px", rx0: "430deg", ry0: "-470deg", rz0: "140deg", rxf: "5deg", ryf: "-6deg", rzf: "4deg", dy: "-5px" },
  { ch: "R", x0: "-10vw", y0: "-66vh", z0: "380px", rx0: "-380deg", ry0: "520deg", rz0: "200deg", rxf: "-3deg", ryf: "5deg", rzf: "-3deg", dy: "3px" },
  { ch: "O", x0: "36vw", y0: "-80vh", z0: "300px", rx0: "480deg", ry0: "-360deg", rz0: "-120deg", rxf: "6deg", ryf: "-7deg", rzf: "6deg", dy: "-3px" },
];

// The mini app stays on this screen until the whole VYRO animation has
// played: last letter lands ~1.8s after start, its glow finishes ~2.25s,
// plus a short hold so the finished logo is actually seen. Keep in sync
// with the timings in the .vyro-* CSS.
const INTRO_MS = 2600;
// Don't hold the animation back for more than this waiting on the web
// font - it starts with the fallback font instead.
const FONT_WAIT_MS = 700;

export default function BootScreen({ onIntroDone }) {
  const [play, setPlay] = useState(false);
  const doneRef = useRef(onIntroDone);
  doneRef.current = onIntroDone;

  useEffect(() => {
    let cancelled = false;
    let timer;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    function start() {
      if (cancelled) return;
      setPlay(true);
      timer = setTimeout(() => doneRef.current?.(), reduceMotion ? 400 : INTRO_MS);
    }

    if (reduceMotion || !document.fonts?.load) {
      start();
    } else {
      // Start once the display font is ready so the letters don't change
      // shape (and shift) halfway through the fall.
      const fontReady = Promise.all([
        document.fonts.load('800 1em "Bricolage Grotesque"', "VYRO"),
        document.fonts.ready,
      ]).catch(() => {});
      Promise.race([fontReady, new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS))]).then(start);
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="boot-screen">
      <div className="boot-vyro" data-play={play || undefined} role="img" aria-label="VYRO">
        <div className="boot-vyro__word" aria-hidden="true">
          {LETTERS.map(({ ch, ...pose }, i) => (
            <span className="vyro-slot" key={`${ch}${i}`} style={{ "--i": i }}>
              <span
                className="vyro-letter"
                style={Object.fromEntries(Object.entries(pose).map(([name, value]) => [`--${name}`, value]))}
              >
                <span className="vyro-sizer">{ch}</span>
                {Array.from({ length: LAYERS }, (_, k) => (
                  <span className="vyro-layer" data-front={k === 0 || undefined} style={{ "--k": k }} key={k}>
                    {ch}
                  </span>
                ))}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="boot-screen__icon">◈</div>
      <h1 className="brand-title boot-screen__title">𝐌𝐀𝐑𝐊𝐄𝐓</h1>
      <p className="boot-screen__hint">shuffling the deck…</p>
      <div className="boot-screen__bar">
        <div className="boot-screen__bar-fill" />
      </div>
    </div>
  );
}
