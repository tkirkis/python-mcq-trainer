import { registerSW } from 'virtual:pwa-register';

/**
 * Registers the service worker that precaches the app shell, question bank and lessons.
 * In autoUpdate mode a new version takes over (and the page reloads) as soon as it is downloaded;
 * we also look for a new version every hour and whenever the app comes back to the foreground,
 * because an installed phone app can stay open for days.
 */
export function registerPwa() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => {
        if (navigator.onLine) void reg.update().catch(() => undefined);
      };
      setInterval(check, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
    onOfflineReady() {
      (window as unknown as { __pwaOfflineReady?: boolean }).__pwaOfflineReady = true;
    },
  });
}
