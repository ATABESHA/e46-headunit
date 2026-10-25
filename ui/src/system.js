import { setPref } from './prefs.js';

/**
 * Restart the whole app (both screens) so a new version takes effect.
 * Inside Electron this reopens the app; in a browser it just reloads the page.
 */
export function restartApp() {
  setPref('update.restartPending', false);
  if (window.e46?.restartApp) window.e46.restartApp();
  else window.location.reload();
}

/** Restart later: happens by itself when the car's key is turned off. */
export function restartWhenCarOff() {
  setPref('update.restartPending', true);
}
