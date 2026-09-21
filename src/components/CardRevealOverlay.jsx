import { useEffect, useRef, useState } from "react";
import { getRarityTier } from "../data/rarities.js";
import CardMedia from "./CardMedia.jsx";
import { play } from "../audio/engine.js";
import { playRevealFx } from "../fx/revealFx.js";

// The pull. Sequence (ms): the card flies up face-down, spinning in; for the
// better rarities it shakes with suspense; at ~760 it flips over, a burst of
// sparkles (and a shockwave/flash for the rare ones) goes off in the rarity's
// colour and the details rise in one by one. Timings live in the
// .reveal-* CSS and must stay in step with FLIP_AT and the "reveal" sound.
const FLIP_AT = 760;
const BURST_AT = FLIP_AT + 180;

export default function CardRevealOverlay({ character, onDismiss }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const canvasRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!character) return undefined;
    setImageFailed(false);
    const tier = getRarityTier(character.rarity);
    // The rarer the pull, the bigger the sparkle run.
    play("reveal", { tier: tier.glowLevel });
    // mount closed, then flip open next frame so the background fade plays
    const raf = requestAnimationFrame(() => setVisible(true));

    let stopFx = null;
    const burst = setTimeout(() => {
      const canvas = canvasRef.current;
      const card = cardRef.current;
      if (!canvas || !card || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
      const rect = card.getBoundingClientRect();
      stopFx = playRevealFx(canvas, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        accent: tier.accent,
        tier: tier.glowLevel,
        rainbow: Boolean(tier.chipBackground),
      });
    }, BURST_AT);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(burst);
      stopFx?.();
      setVisible(false);
    };
  }, [character]);

  if (!character) return null;

  const tier = getRarityTier(character.rarity);
  const chipBackground = tier.chipBackground ?? tier.accent;
  const [artFrom, artTo] = character.gradient ?? ["#3A2E63", "#7B4FA6"];
  const showImage = character.imageUrl && !imageFailed;

  const style = {
    "--card-accent": tier.accent,
    "--art-from": artFrom,
    "--art-to": artTo,
  };

  return (
    <div
      className="reveal-overlay"
      data-visible={visible || undefined}
      data-tier={tier.glowLevel}
      style={style}
      onClick={onDismiss}
    >
      <div className="reveal-rays" aria-hidden="true" />
      <div className="reveal-flash" aria-hidden="true" />
      <canvas ref={canvasRef} className="reveal-fx" aria-hidden="true" />

      <div className="reveal-stage" ref={cardRef}>
        <div className="reveal-flip" onClick={(event) => event.stopPropagation()}>
          <div className="reveal-face reveal-face--back" aria-hidden="true">
            <span className="reveal-back__emblem">◈</span>
            <span className="reveal-back__brand">VYRO</span>
          </div>

          <div className="reveal-face reveal-card" data-glow={tier.glowLevel || undefined}>
            <p className="reveal-card__eyebrow">✦ New Card ✦</p>

            <div className="reveal-card__art">
              {showImage ? (
                <CardMedia
                  className="character-card__photo"
                  src={character.imageUrl}
                  mediaType={character.mediaType}
                  alt={character.name}
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <span className="character-card__monogram">{character.name.charAt(0)}</span>
              )}
            </div>

            <h2 className="reveal-card__name">{character.name}</h2>
            <span className="rarity-chip reveal-card__rarity" style={{ background: chipBackground }}>
              {tier.label}
            </span>
            <p className="reveal-card__series">{character.series}</p>

            <button type="button" className="sheet-button sheet-button--confirm reveal-card__dismiss" onClick={onDismiss}>
              Nice! ✦
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
