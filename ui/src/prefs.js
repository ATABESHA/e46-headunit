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

// A change made in the other window (head unit <-> cluster) applies here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key?.startsWith(PREFIX)) return;
    cache.delete(e.key.slice(PREFIX.length));
    listeners.forEach((l) => l());
  });
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

/** Forget every preference whose name starts with `prefix` (e.g. "layout."). */
export function clearPrefs(prefix) {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX + prefix)) localStorage.removeItem(key);
    }
  } catch {
    // Storage not available: the cache below still resets.
  }
  for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
  listeners.forEach((l) => l());
}
