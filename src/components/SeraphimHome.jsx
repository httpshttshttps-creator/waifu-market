import OwnedGrid from "./OwnedGrid.jsx";

// Home tab for the Seraphim theme - built to match the reference mockup
// exactly. The hero art (sky/gate/stairs/pill/nav chrome) is the actual
// reference image with just the two spots that need LIVE data (the
// player name, and the balance/card-count numbers) softly blurred out
// in a static asset pass, then real text is overlaid in exactly those
// spots below - see BOX below for the pixel measurements that positioning
// is derived from (measured directly against the 934px-wide source art).
//
// Two crops of the same cleaned artwork are used: the "full" one (with
// the empty-collection message + castle scene) when the player owns no
// cards yet, and a short "compact" one (title + balance pill only) when
// they do, immediately followed by their real card grid.
const HERO_WIDTH = 934;
const HERO_FULL_HEIGHT = 1440;
const HERO_COMPACT_HEIGHT = 418;

const BOX = {
  gear: { left: 728, top: 42, width: 148, height: 148 },
  title: { left: 0, top: 122, width: 560, height: 96 },
  pillLeft: { left: 158, top: 264, width: 242, height: 118 },
  pillRight: { left: 496, top: 264, width: 238, height: 118 },
  browseButton: { left: 205, top: 655, width: 525, height: 150 },
};

function boxStyle(box, heroHeight) {
  return {
    position: "absolute",
    left: `${(box.left / HERO_WIDTH) * 100}%`,
    top: `${(box.top / heroHeight) * 100}%`,
    width: `${(box.width / HERO_WIDTH) * 100}%`,
    height: `${(box.height / heroHeight) * 100}%`,
  };
}

export default function SeraphimHome({
  name,
  balance,
  cardCount,
  cards,
  sellPrices,
  onSell,
  onBrowseMarket,
  onOpenSettings,
}) {
  const isEmpty = cardCount === 0;
  const heroHeight = isEmpty ? HERO_FULL_HEIGHT : HERO_COMPACT_HEIGHT;
  const heroImage = isEmpty
    ? "/themes/seraphim/home-hero-full.jpg"
    : "/themes/seraphim/home-hero-compact.jpg";

  return (
    <div className="seraphim-home">
      <div
        className="seraphim-home__hero"
        style={{ aspectRatio: `${HERO_WIDTH} / ${heroHeight}`, backgroundImage: `url(${heroImage})` }}
      >
        <button
          type="button"
          className="seraphim-home__gear"
          style={boxStyle(BOX.gear, heroHeight)}
          onClick={onOpenSettings}
          aria-label="Settings"
        />

        <div className="seraphim-home__title" style={boxStyle(BOX.title, heroHeight)}>
          <h1 className="seraphim-home__name">{name} ✦</h1>
        </div>

        <div className="seraphim-home__pill-stat" style={boxStyle(BOX.pillLeft, heroHeight)}>
          <span className="seraphim-home__pill-value">{balance} VɎ</span>
          <span className="seraphim-home__pill-label">BALANCE</span>
        </div>

        <div className="seraphim-home__pill-stat" style={boxStyle(BOX.pillRight, heroHeight)}>
          <span className="seraphim-home__pill-value">{cardCount}</span>
          <span className="seraphim-home__pill-label">CARDS OWNED</span>
        </div>

        {isEmpty && (
          <button
            type="button"
            className="seraphim-home__browse"
            style={boxStyle(BOX.browseButton, heroHeight)}
            onClick={onBrowseMarket}
            aria-label="Browse the Market"
          />
        )}
      </div>

      {!isEmpty && (
        <div className="card-grid--seraphim">
          <OwnedGrid cards={cards} sellPrices={sellPrices} onSell={onSell} onBrowseMarket={onBrowseMarket} />
        </div>
      )}
    </div>
  );
}
