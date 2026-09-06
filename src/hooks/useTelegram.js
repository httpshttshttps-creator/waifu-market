import { useEffect, useMemo } from "react";

/**
 * Thin wrapper around window.Telegram.WebApp.
 *
 * Why not call the @tma.js/sdk-react hooks directly here? That package's
 * API reshuffles fairly often between major versions. The `telegram-web-app.js`
 * script tag in index.html is the one surface Telegram guarantees stays
 * stable, so runtime calls (haptics, theme, the user object) go through it
 * directly, while main.jsx still does the official SDK init(). When we
 * revisit this together we can migrate individual calls to `useSignal` /
 * `hapticFeedback` / `mainButton` from @tma.js/sdk-react one at a time.
 *
 * @param {{ header: string, background: string }} [chrome] - hex colors
 *   for Telegram's own header/background bar. Only pass this from ONE
 *   call site (App.jsx) - it's keyed to the active app theme so the
 *   native chrome always matches --ink. Other components (BottomNav,
 *   etc.) should call useTelegram() with no argument and just get
 *   haptics/user/etc.; they skip the chrome effect entirely, so two
 *   components never race to set the header color to different values.
 */
export function useTelegram(chrome) {
  const webApp = useMemo(() => (typeof window !== "undefined" ? window.Telegram?.WebApp : undefined), []);

  useEffect(() => {
    if (!webApp) return;
    webApp.ready();
    webApp.expand();
  }, [webApp]);

  // Match Telegram's own header/background chrome to the active theme
  // instead of the default gray bar, so the close (✕) button and bot
  // name sit on the same color as the app underneath it. Re-runs
  // whenever the theme (and therefore `chrome`) changes. Older clients
  // that don't support setHeaderColor/setBackgroundColor just no-op.
  useEffect(() => {
    if (!webApp || !chrome) return;
    try {
      webApp.setHeaderColor(chrome.header);
      webApp.setBackgroundColor(chrome.background);
    } catch {
      /* unsupported client version - ignore */
    }
  }, [webApp, chrome?.header, chrome?.background]);

  const user = webApp?.initDataUnsafe?.user ?? null;

  function haptic(style = "light") {
    try {
      webApp?.HapticFeedback?.impactOccurred(style);
    } catch {
      /* not running inside Telegram - ignore */
    }
  }

  function notify(type = "success") {
    try {
      webApp?.HapticFeedback?.notificationOccurred(type);
    } catch {
      /* not running inside Telegram - ignore */
    }
  }

  return {
    webApp,
    user,
    isTelegram: Boolean(webApp),
    colorScheme: webApp?.colorScheme ?? "dark",
    haptic,
    notify,
  };
}
