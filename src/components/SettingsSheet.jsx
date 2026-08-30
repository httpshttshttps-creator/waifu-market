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
    tagline: "Heavenly gold & white marble",
    swatch: ["#fff8e7", "#e8b923"],
  },
  {
    id: "tenebris",
    name: "Tenebris",
    tagline: "Coming soon",
    swatch: ["#0a0612", "#5b3aa8"],
    comingSoon: true,
  },
];

export default function SettingsSheet({ open, isPremium, theme, onSelectTheme, onClose }) {
  if (!open) return null;

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="confirm-sheet settings-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="confirm-sheet__handle" />

        <p className="settings-sheet__title">⚙️ Settings</p>

        <div className="settings-sheet__section">
          <p className="settings-sheet__section-label">Theme</p>

          {!isPremium && (
            <p className="settings-sheet__lock-note">
              ⭐️ Premium unlocks Seraphim and Tenebris. Check <code>/premium</code> in the bot chat.
            </p>
          )}

          <div className="theme-grid">
            {THEMES.map((t) => {
              const locked = t.id !== "default" && !isPremium;
              const disabled = locked || t.comingSoon;
              return (
                <button
                  key={t.id}
                  type="button"
                  className="theme-option"
                  data-active={theme === t.id || undefined}
                  data-locked={disabled || undefined}
                  disabled={disabled}
                  onClick={() => onSelectTheme(t.id)}
                >
                  <span
                    className="theme-option__swatch"
                    style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` }}
                  >
                    {disabled && <span className="theme-option__lock">{t.comingSoon ? "⏳" : "🔒"}</span>}
                    {theme === t.id && <span className="theme-option__check">✓</span>}
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
