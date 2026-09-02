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
    tagline: "Coming soon",
    swatch: ["#fff8e7", "#e8b923"],
    comingSoon: true,
  },
  {
    id: "tenebris",
    name: "Tenebris",
    tagline: "Coming soon",
    swatch: ["#0a0612", "#5b3aa8"],
    comingSoon: true,
  },
];

export default function SettingsSheet({ open, onClose }) {
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
              const active = t.id === "default";
              return (
                <button
                  key={t.id}
                  type="button"
                  className="theme-option"
                  data-active={active || undefined}
                  data-locked={t.comingSoon || undefined}
                  disabled={t.comingSoon}
                >
                  <span
                    className="theme-option__swatch"
                    style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` }}
                  >
                    {t.comingSoon && <span className="theme-option__lock">⏳</span>}
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
