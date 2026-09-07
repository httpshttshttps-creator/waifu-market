import { useTelegram } from "../hooks/useTelegram.js";
import navHomeSeraphim from "../assets/nav-home-seraphim.png";
import navRideSeraphim from "../assets/nav-ride-seraphim.png";
import navMarketSeraphim from "../assets/nav-market-seraphim.png";
import navLeaderboardSeraphim from "../assets/nav-leaderboard-seraphim.png";
import navArenaSeraphim from "../assets/nav-arena-seraphim.png";

// Classic theme's original vector icon for the home tab.
function HomeIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 11.5 12 4l8 7.5"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 10v8.5a1 1 0 0 0 1 1h3.5v-5a1.5 1.5 0 0 1 1.5-1.5v0a1.5 1.5 0 0 1 1.5 1.5v5H17a1 1 0 0 0 1-1V10"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Seraphim-only replacement icons - artwork only, no baked-in text, so
// they all keep the normal text label below (same as classic theme),
// just set in the seraphim display font (see `[data-seraphim-icon]` in
// index.css). Only ever used when theme === "seraphim" (see TABS/render
// logic below), so the classic theme never sees these.
function SeraphimHomeIcon() {
  return <img src={navHomeSeraphim} alt="" className="bottom-nav__tab-icon--seraphim" />;
}

function SeraphimRideIcon() {
  return <img src={navRideSeraphim} alt="" className="bottom-nav__tab-icon--seraphim" />;
}

function SeraphimMarketIcon() {
  return <img src={navMarketSeraphim} alt="" className="bottom-nav__tab-icon--seraphim" />;
}

function SeraphimLeaderboardIcon() {
  return <img src={navLeaderboardSeraphim} alt="" className="bottom-nav__tab-icon--seraphim" />;
}

function SeraphimArenaIcon() {
  return <img src={navArenaSeraphim} alt="" className="bottom-nav__tab-icon--seraphim" />;
}

function MarketIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4.5 8.5 6 4h12l1.5 4.5"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 8.5h15V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V8.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        strokeLinejoin="round"
      />
      <path
        d="M9 11.5a2.5 2.5 0 0 0 5 0"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrophyIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 4h10v4a5 5 0 0 1-10 0V4Z"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        strokeLinejoin="round"
      />
      <path
        d="M7 5H4v1a4 4 0 0 0 4 4M17 5h3v1a4 4 0 0 1-4 4"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        strokeLinecap="round"
      />
      <path d="M12 13v3M9 20h6M10 20v-2.5h4V20" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" />
    </svg>
  );
}

function GameIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="7" cy="15.5" r="2.6" stroke="currentColor" strokeWidth={active ? 2.4 : 2} />
      <circle cx="17" cy="15.5" r="2.6" stroke="currentColor" strokeWidth={active ? 2.4 : 2} />
      <path
        d="M9.2 15.5h5.6M9.5 15 12 8h3.5l2 3"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArenaIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 4.5 12 7l6-2.5-1 5-5 9.5-5-9.5-1-5Z"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        strokeLinejoin="round"
      />
      <path d="M9 20h6" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" />
    </svg>
  );
}

const TABS = [
  // seraphimIcon: only used when the active theme is "seraphim" (see
  // render below). Every seraphim tab now shows its normal text label
  // underneath (in the seraphim display font, see `[data-seraphim-icon]
  // span` in index.css) - same layout as the classic theme, just with
  // different artwork and font for the icon+label pair.
  // Classic theme always uses `Icon` + the text label, completely untouched.
  { id: "home", label: "Home", Icon: HomeIcon, seraphimIcon: SeraphimHomeIcon },
  { id: "market", label: "Market", Icon: MarketIcon, seraphimIcon: SeraphimMarketIcon },
  { id: "game", label: "Ride", Icon: GameIcon, seraphimIcon: SeraphimRideIcon },
  { id: "leaderboard", label: "Leaderboard & Tasks", Icon: TrophyIcon, seraphimIcon: SeraphimLeaderboardIcon },
  { id: "arena", label: "Arena", Icon: ArenaIcon, seraphimIcon: SeraphimArenaIcon },
];

// Exported so App.jsx can tell which way a tab switch "moved" (for the
// directional tab-build slide animation) without duplicating this list.
export const TAB_ORDER = TABS.map((tab) => tab.id);

export default function BottomNav({ active, onChange, theme = "default" }) {
  const { haptic } = useTelegram();

  function handleChange(tabId) {
    if (tabId !== active) haptic?.("light");
    onChange(tabId);
  }

  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const useSeraphimIcon = theme === "seraphim" && Boolean(tab.seraphimIcon);
        const hideLabel = useSeraphimIcon && tab.seraphimHideLabel;
        const IconComponent = useSeraphimIcon ? tab.seraphimIcon : tab.Icon;
        return (
          <button
            key={tab.id}
            type="button"
            className="bottom-nav__item"
            data-active={isActive}
            data-seraphim-icon={useSeraphimIcon || undefined}
            data-image-only={hideLabel || undefined}
            aria-label={hideLabel ? tab.label : undefined}
            onClick={() => handleChange(tab.id)}
          >
            <IconComponent active={isActive} />
            {!hideLabel && <span>{tab.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
