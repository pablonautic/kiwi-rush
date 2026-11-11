import { Game } from './Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
new Game(canvas).start();

// ---- mobile / installed-app niceties (all optional: failures are ignored) ----

const isTouch = window.matchMedia('(pointer: coarse)').matches;
const isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches;

/** On phones, go fullscreen on the first tap (needs a user gesture) unless already running as an app. */
if (isTouch && !isInstalled) {
  window.addEventListener(
    'pointerup',
    () => {
      document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => undefined);
    },
    { once: true },
  );
}

/** Keep the screen awake while playing (re-acquired when the tab becomes visible again). */
let wakeLock: WakeLockSentinel | null = null;
const keepAwake = (): void => {
  navigator.wakeLock?.request('screen').then((l) => (wakeLock = l)).catch(() => undefined);
};
window.addEventListener('pointerup', keepAwake, { once: true });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && wakeLock?.released) keepAwake();
});

/** Offline support: only when served over http(s), never from file://. */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => undefined);
  });
}
