/*
 * Finger rules for the touch screen, used by everything that is dragged.
 *
 *   HOLD_MS   how long to keep a finger down before a long press counts
 *   SLOP_PX   a finger always wobbles a little: moving less than this still
 *             counts as holding still (more than this = the user is scrolling)
 *   TAP_MS    two taps closer than this are a double tap
 */
export const HOLD_MS = 450;
export const SLOP_PX = 12;
export const TAP_MS = 350;

/** Short buzz where the screen supports it (phones, some touch screens). */
export const buzz = (ms = 12) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // not supported
  }
};

/**
 * The app is scaled to fit the screen (transform: scale), but finger
 * positions are in screen pixels. This turns screen pixels into design pixels.
 */
export const scaleOf = (el) => el.getBoundingClientRect().width / el.offsetWidth || 1;
