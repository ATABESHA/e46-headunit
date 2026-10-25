import { useSyncExternalStore } from 'react';

// Connection from the screen app to the core service. Reconnects by itself,
// so the screen keeps working if the core restarts.
const HUB_URL = import.meta.env.VITE_HUB_URL ?? 'ws://127.0.0.1:8765';
/** Base address for files from the core (music, artwork, CarPlay video). */
export const HUB_HTTP = HUB_URL.replace(/^ws/, 'http');
const COMMAND_TIMEOUT_MS = 8000;

let ws = null;
let state = {};
let connected = false;
let nextId = 1;
const pending = new Map();
const listeners = new Set();

function notify() {
  listeners.forEach((l) => l());
}

function connect() {
  ws = new WebSocket(HUB_URL);

  ws.onopen = () => {
    connected = true;
    notify();
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'snapshot') {
      state = msg.state;
      notify();
    } else if (msg.type === 'state') {
      state = { ...state, [msg.topic]: msg.value };
      notify();
    } else if (msg.type === 'result') {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.ok) p.resolve(msg.value);
      else p.reject(new Error(msg.error));
    }
  };

  ws.onclose = () => {
    connected = false;
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error('Lost connection to core'));
    }
    pending.clear();
    notify();
    setTimeout(connect, 1000);
  };
}

connect();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Send a command to the core. Resolves with the answer, rejects on error. */
export function command(topic, value) {
  if (!connected) return Promise.reject(new Error('Not connected to core'));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Command "${topic}" timed out`));
    }, COMMAND_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ type: 'command', id, topic, value }));
  });
}

/** Current value of one topic; the component re-renders when it changes. */
export function useTopic(topic, fallback) {
  const value = useSyncExternalStore(subscribe, () => state[topic]);
  return value === undefined ? fallback : value;
}

export function useConnected() {
  return useSyncExternalStore(subscribe, () => connected);
}
