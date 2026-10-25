import { useSyncExternalStore } from 'react';

// Screen preferences remembered on this laptop (style, camera, screen size …).
const PREFIX = 'e46.';
const listeners = new Set();
const cache = new Map();

function read(key, fallback) {
  if (cache.has(key)) return cache.get(key);
  let value = fallback;
  let raw = null;
  try {
    raw = localStorage.getItem(PREFIX + key);
    if (raw !== null) value = JSON.parse(raw);
  } catch {
    // Older versions saved plain text (e.g. the style name); keep it.
    if (raw !== null) value = raw;
  }
  cache.set(key, value);
  return value;
}

export function getPref(key, fallback) {
  return read(key, fallback);
}

export function setPref(key, value) {
  cache.set(key, value);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Not remembered, but still applied for this session.
  }
  listeners.forEach((l) => l());
}

export function usePref(key, fallback) {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => read(key, fallback),
  );
  return [value, (v) => setPref(key, v)];
}
