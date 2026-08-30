import { useTelegram } from "../hooks/useTelegram.js";

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

// ---- Seraphim tab icons ----

function SeraphimGateIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 20V9c0-3 2.5-6 8-6s8 3 8 6v11" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" />
      <path d="M2 10c1.5-1 3-1 4-.3M22 10c-1.5-1-3-1-4-.3" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" />
      <path d="M8 20V11a4 4 0 0 1 8 0v9" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" />
    </svg>
  );
}

function SeraphimScaleIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v16" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" />
      <path d="M5 6h14M5 6 2.5 11a2.5 2.5 0 0 0 5 0L5 6ZM19 6l-2.5 5a2.5 2.5 0 0 0 5 0L19 6Z" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinejoin="round" />
      <path d="M8 20h8" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" />
    </svg>
  );
}

function SeraphimWheelIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth={active ? 2.4 : 2} />
      <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <path d="M12 5v2M12 17v2M5 12h2M17 12h2M7 7l1.4 1.4M15.6 15.6 17 17M17 7l-1.4 1.4M8.4 15.6 7 17" stroke="currentColor" strokeWidth={active ? 1.8 : 1.4} strokeLinecap="round" />
    </svg>
  );
}

function SeraphimTrophyIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinejoin="round" />
      <path d="M7 5H4v1a4 4 0 0 0 4 4M17 5h3v1a4 4 0 0 1-4 4" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" />
      <path d="M12 13v3M9 20h6M10 20v-2.5h4V20" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" />
      <path d="m12 1.5.6 1.3 1.4.2-1 1 .2 1.4-1.2-.7-1.2.7.2-1.4-1-1 1.4-.2Z" fill="currentColor" />
    </svg>
  );
}

function SeraphimArenaIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 9c0-2 1.5-3.5 3-3.5S9 7 9 9v2c0 1-.5 2-2 2s-3-1-3-3V9Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinejoin="round"
      />
      <path
        d="M20 9c0-2-1.5-3.5-3-3.5S15 7 15 9v2c0 1 .5 2 2 2s3-1 3-3V9Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinejoin="round"
      />
      <path d="M9 10h6M8 13c1 2 2 3 4 3s3-1 4-3" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" />
      <path d="M10 19h4" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" />
    </svg>
  );
}

const TABS = [
  { id: "home", label: "Home", Icon: HomeIcon, SeraphimIcon: SeraphimGateIcon },
  { id: "market", label: "Market", Icon: MarketIcon, SeraphimIcon: SeraphimScaleIcon },
  { id: "game", label: "Ride", Icon: GameIcon, SeraphimIcon: SeraphimWheelIcon },
  { id: "leaderboard", label: "Leaderboard & Tasks", Icon: TrophyIcon, SeraphimIcon: SeraphimTrophyIcon },
  { id: "arena", label: "Arena", Icon: ArenaIcon, SeraphimIcon: SeraphimArenaIcon },
];

export default function BottomNav({ active, onChange, theme }) {
  const { haptic } = useTelegram();

  function handleChange(tabId) {
    if (tabId !== active) haptic?.("light");
    onChange(tabId);
  }

  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const IconComponent = theme === "seraphim" ? tab.SeraphimIcon : tab.Icon;
        return (
          <button
            key={tab.id}
            type="button"
            className="bottom-nav__item"
            data-active={isActive}
            onClick={() => handleChange(tab.id)}
          >
            <IconComponent active={isActive} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
