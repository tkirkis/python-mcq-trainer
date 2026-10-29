import { registerSW } from 'virtual:pwa-register';

/** Registers the service worker that precaches the app shell, question bank and lessons. */
export function registerPwa() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  registerSW({
    immediate: true,
    onOfflineReady() {
      (window as unknown as { __pwaOfflineReady?: boolean }).__pwaOfflineReady = true;
    },
  });
}
