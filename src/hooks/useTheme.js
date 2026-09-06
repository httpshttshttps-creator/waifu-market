import { useEffect, useState } from "react";

const STORAGE_KEY = "wm-theme";

// Telegram chrome (header/background bar) color per theme - kept next
// to the theme list itself since useTelegram() needs it and it has to
// match each theme's --ink exactly or the native header reads as a
// different color than the page underneath it.
export const THEME_CHROME = {
  default: { header: "#170707", background: "#170707" },
  seraphim: { header: "#fdf7e8", background: "#fdf7e8" },
};

function readStoredTheme() {
  if (typeof window === "undefined") return "default";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const theme = stored && THEME_CHROME[stored] ? stored : "default";
    // Stamp <html data-theme> synchronously, during the useState
    // initializer (before the first paint) rather than waiting for the
    // effect below - otherwise a returning Seraphim user would see one
    // frame of the default dark theme flash before it switches over.
    document.documentElement.setAttribute("data-theme", theme);
    return theme;
  } catch {
    // private/incognito mode can throw on localStorage access - just
    // fall back to the default theme for this session.
    return "default";
  }
}

/**
 * Owns which visual theme ("default" | "seraphim") is active and keeps
 * <html data-theme="..."> in sync, which is what index.css's
 * `:root[data-theme="seraphim"] { ... }` block hooks into. Persisted to
 * localStorage so the choice survives closing and reopening the Mini App.
 */
export function useTheme() {
  const [theme, setThemeState] = useState(readStoredTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable - theme just won't persist across sessions */
    }
  }, [theme]);

  function setTheme(nextTheme) {
    if (THEME_CHROME[nextTheme]) setThemeState(nextTheme);
  }

  return [theme, setTheme];
}
