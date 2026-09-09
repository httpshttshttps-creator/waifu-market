import { useState } from "react";

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

// Accent recolors for the Classic theme - same layout/background, just a
// different accent hue for buttons, the active nav icon, user chat
// bubbles, etc. (see [data-accent] in index.css). Not full alternate
// themes like Seraphim/Tenebris above.
const ACCENTS = [
  { id: "red", name: "Red", preview: "linear-gradient(135deg, #241010, #d62839)" },
  { id: "blue", name: "Blue", preview: "linear-gradient(135deg, #101a24, #2f6fed)" },
  { id: "yellow", name: "Yellow", preview: "linear-gradient(135deg, #241f10, #eab308)" },
  { id: "green", name: "Green", preview: "linear-gradient(135deg, #0f2417, #16a34a)" },
  { id: "blackgold", name: "Black & Gold", preview: "linear-gradient(135deg, #07070a, #ffd94d)", shiny: true },
];

export default function SettingsSheet({ open, onClose, accent, onAccentChange }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

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
              const isClassic = t.id === "default";
              return (
                <button
                  key={t.id}
                  type="button"
                  className="theme-option"
                  data-active={active || undefined}
                  data-locked={t.comingSoon || undefined}
                  disabled={t.comingSoon}
                  onClick={isClassic ? () => setDrawerOpen((o) => !o) : undefined}
                >
                  <span
                    className="theme-option__swatch"
                    style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` }}
                  >
                    {t.comingSoon && <span className="theme-option__lock">⏳</span>}
                    {active && <span className="theme-option__check">✓</span>}
                  </span>
                  <span className="theme-option__name">
                    {t.name}
                    {isClassic && (
                      <span className="theme-option__chevron" data-open={drawerOpen || undefined}>
                        ⌄
                      </span>
                    )}
                  </span>
                  <span className="theme-option__tagline">{t.tagline}</span>
                </button>
              );
            })}
          </div>

          {drawerOpen && (
            <div className="theme-color-drawer">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="theme-color-swatch"
                  data-active={a.id === accent || undefined}
                  data-shiny={a.shiny || undefined}
                  style={{ background: a.preview }}
                  onClick={() => onAccentChange(a.id)}
                  aria-label={a.name}
                >
                  {a.id === accent && <span className="theme-color-swatch__check">✓</span>}
                </button>
              ))}
            </div>
          )}
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
