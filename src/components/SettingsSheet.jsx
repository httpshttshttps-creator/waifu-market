const THEMES = [
  {
    id: "default",
    name: "Classic",
    tagline: "The original after-hours card stall",
    swatch: ["#241010", "#d62839"],
  },
  {
    id: "seraphim",
    name: "Seraphim",
    tagline: "Gilded & radiant - premium",
    swatch: ["#fff8e7", "#e8b923"],
    premium: true,
  },
  {
    id: "tenebris",
    name: "Tenebris",
    tagline: "Coming soon",
    swatch: ["#0a0612", "#5b3aa8"],
    comingSoon: true,
  },
];

export default function SettingsSheet({ open, onClose, theme = "default", onThemeChange }) {
  if (!open) return null;

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="confirm-sheet settings-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="confirm-sheet__handle" />

        <p className="settings-sheet__title">⚙️ Settings</p>

        <div className="settings-sheet__section">
          <p className="settings-sheet__section-label">Theme</p>

          <div className="theme-grid">
            {THEMES.map((t) => {
              const active = t.id === theme;
              return (
                <button
                  key={t.id}
                  type="button"
                  className="theme-option"
                  data-active={active || undefined}
                  data-locked={t.comingSoon || undefined}
                  data-premium={t.premium || undefined}
                  disabled={t.comingSoon}
                  onClick={() => {
                    if (!t.comingSoon) onThemeChange?.(t.id);
                  }}
                >
                  <span
                    className="theme-option__swatch"
                    style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` }}
                  >
                    {t.comingSoon && <span className="theme-option__lock">⏳</span>}
                    {!t.comingSoon && t.premium && !active && (
                      <span className="theme-option__lock theme-option__lock--premium">✦</span>
                    )}
                    {active && <span className="theme-option__check">✓</span>}
                  </span>
                  <span className="theme-option__name">{t.name}</span>
                  <span className="theme-option__tagline">{t.tagline}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="confirm-sheet__actions">
          <button type="button" className="sheet-button sheet-button--confirm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
