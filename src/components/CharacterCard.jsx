import { useState } from "react";
import { getRarityTier } from "../data/rarities.js";

export default function CharacterCard({ character, owned, canAfford, onBuy }) {
  const [imageFailed, setImageFailed] = useState(false);
  const tier = getRarityTier(character.rarity);
  const [artFrom, artTo] = character.gradient;
  const chipBackground = tier.chipBackground ?? tier.accent;
  const showImage = character.imageUrl && !imageFailed;

  const style = {
    "--card-accent": tier.accent,
    "--art-from": artFrom,
    "--art-to": artTo,
  };

  return (
    <article className="character-card" data-glow={tier.glowLevel || undefined} style={style}>
      <div className="character-card__art">
        {owned && <span className="owned-badge">✓ owned</span>}
        {showImage ? (
          <img
            className="character-card__photo"
            src={character.imageUrl}
            alt={character.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="character-card__monogram">{character.name.charAt(0)}</span>
        )}
      </div>

      <div className="character-card__body">
        <h3 className="character-card__name">{character.name}</h3>
        <div className="character-card__meta">
          <span className="rarity-chip" style={{ background: chipBackground }}>
            {tier.label}
          </span>
          <span className="character-card__series">{character.series}</span>
        </div>
        <p className="character-card__seller">
          Seller <span>{character.seller}</span>
        </p>
      </div>

      <div className="character-card__footer">
        <span className="price-ticket">💲 {character.price} VɎ</span>
        <button
          type="button"
          className="buy-button"
          data-owned={owned}
          data-affordable={canAfford}
          onClick={() => !owned && onBuy(character)}
        >
          {owned ? "Owned" : "Buy"}
        </button>
      </div>
    </article>
  );
}
