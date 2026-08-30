import { useEffect, useRef, useState } from "react";
import { getRarityTier } from "../data/rarities.js";
import CardMedia from "./CardMedia.jsx";

// Seraphim's summon cinematic, in beats (ms, cumulative):
//   0    - screen goes dark, a single gold point of light appears
//   400  - light expands into a sacred circle, glyphs spin
//   900  - six wings open from the center, screen washes white
//   1400 - hundreds of gold particles burst out, a light pillar descends
//   1900 - the character's silhouette becomes visible inside the light
//   2400 - the light explodes and the real card appears (rarity frame lights up)
// Omnara gets two extra beats: a full whiteout with giant wings/halos and
// a "SERAPHIM'S BLESSING" title, before the same gold-explosion reveal.
const STAGE_TIMINGS = [0, 400, 900, 1400, 1900, 2400];
const OMNARA_EXTRA_TIMINGS = [2400, 3000, 3600];

export default function CardRevealOverlay({ character, onDismiss, theme }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [seraphimStage, setSeraphimStage] = useState(-1);
  const timeoutsRef = useRef([]);

  const isSeraphim = theme === "seraphim";
  const isOmnara = (character?.rarity || "").toLowerCase() === "omnara";

  useEffect(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (!character) return;

    setImageFailed(false);

    if (!isSeraphim) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }

    // Seraphim Summon: step through the cinematic stages, then reveal.
    setSeraphimStage(0);
    setVisible(false);
    const timings = isOmnara ? [...STAGE_TIMINGS, ...OMNARA_EXTRA_TIMINGS] : STAGE_TIMINGS;
    timings.forEach((delay, index) => {
      if (index === 0) return;
      const t = setTimeout(() => setSeraphimStage(index), delay);
      timeoutsRef.current.push(t);
    });
    const revealDelay = timings[timings.length - 1];
    const t = setTimeout(() => setVisible(true), revealDelay);
    timeoutsRef.current.push(t);

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [character, isSeraphim, isOmnara]);

  if (!character) return null;

  const tier = getRarityTier(character.rarity);
  const chipBackground = tier.chipBackground ?? tier.accent;
  const [artFrom, artTo] = character.gradient ?? ["#3A2E63", "#7B4FA6"];
  const showImage = character.imageUrl && !imageFailed;
  const rarityKey = (character.rarity || "").toLowerCase();

  const style = {
    "--card-accent": tier.accent,
    "--art-from": artFrom,
    "--art-to": artTo,
  };

  const summoning = isSeraphim && !visible;

  return (
    <div className="reveal-overlay" data-visible={visible || undefined} onClick={visible ? onDismiss : undefined}>
      {summoning && (
        <div className="seraphim-summon" data-stage={seraphimStage} data-omnara={isOmnara || undefined}>
          <div className="seraphim-summon__dot" />
          <div className="seraphim-summon__circle" />
          <div className="seraphim-summon__glyphs" />
          <div className="seraphim-summon__wing seraphim-summon__wing--1" />
          <div className="seraphim-summon__wing seraphim-summon__wing--2" />
          <div className="seraphim-summon__wing seraphim-summon__wing--3" />
          <div className="seraphim-summon__wing seraphim-summon__wing--4" />
          <div className="seraphim-summon__wing seraphim-summon__wing--5" />
          <div className="seraphim-summon__wing seraphim-summon__wing--6" />
          <div className="seraphim-summon__pillar" />
          <div className="seraphim-summon__particles" />
          {seraphimStage >= 4 && showImage && (
            <div className="seraphim-summon__silhouette">
              <CardMedia
                className="seraphim-summon__silhouette-img"
                src={character.imageUrl}
                mediaType={character.mediaType}
                alt=""
              />
            </div>
          )}
          {isOmnara && seraphimStage >= 6 && (
            <p className="seraphim-summon__blessing">SERAPHIM'S BLESSING</p>
          )}
          <div className="seraphim-summon__whiteout" />
        </div>
      )}

      <div
        className="reveal-card"
        data-glow={tier.glowLevel || undefined}
        data-rarity={rarityKey}
        data-seraphim={isSeraphim || undefined}
        style={style}
        onClick={(event) => event.stopPropagation()}
      >
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
  );
}
