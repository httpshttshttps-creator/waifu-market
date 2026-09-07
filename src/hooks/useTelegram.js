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
 */
export function useTelegram() {
  const webApp = useMemo(() => (typeof window !== "undefined" ? window.Telegram?.WebApp : undefined), []);

  useEffect(() => {
    if (!webApp) return;
    webApp.ready();
    webApp.expand();

    // Match Telegram's own header/background chrome to our theme instead
    // of the default gray bar, so the close (✕) button and bot name sit
    // on the same color as the app underneath it. Keep this in sync with
    // --ink in index.css if that palette ever changes. Older clients that
    // don't support setHeaderColor/setBackgroundColor just no-op here.
    try {
      webApp.setHeaderColor("#170707");
      webApp.setBackgroundColor("#170707");
    } catch {
      /* unsupported client version - ignore */
    }
  }, [webApp]);

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
