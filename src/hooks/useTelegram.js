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

  // CSS `100dvh` tracks the OS browser's own address-bar collapse, but
  // Telegram Mini Apps run inside Telegram's own webview, which resizes
  // the visible area on ITS terms (keyboard, Telegram's UI chrome,
  // fullscreen toggles) - that doesn't always line up with a real
  // browser resize/dvh recompute, especially on Android. That mismatch
  // is what made full-screen bits (the Ride game's canvas) look
  // shifted/not fixed in place. Telegram exposes the real number via
  // webApp.viewportStableHeight, kept live through the 'viewportChanged'
  // event - mirror it into a --tg-vh CSS var so anything that needs the
  // TRUE visible height can use var(--tg-vh, 100dvh) instead of relying
  // on dvh alone. Also nudge a plain window resize so anything (like the
  // game canvas) that only listens for that event still picks it up.
  useEffect(() => {
    function applyViewportHeight() {
      const height = webApp?.viewportStableHeight || webApp?.viewportHeight || window.innerHeight;
      document.documentElement.style.setProperty("--tg-vh", `${height}px`);
      window.dispatchEvent(new Event("resize"));
    }

    applyViewportHeight();

    if (webApp?.onEvent) {
      webApp.onEvent("viewportChanged", applyViewportHeight);
      return () => webApp.offEvent?.("viewportChanged", applyViewportHeight);
    }

    // Not running inside Telegram (e.g. local dev in a regular browser) -
    // window resize is the closest equivalent.
    window.addEventListener("resize", applyViewportHeight);
    return () => window.removeEventListener("resize", applyViewportHeight);
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
