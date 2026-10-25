import { useSyncExternalStore } from 'react';
import { HUB_HTTP, command, publish } from './hub.js';

/**
 * One player for music and radio. It keeps playing while you switch screens.
 *
 * Sound goes through an equalizer (bass / mid / treble / balance from
 * Settings → Sound). Radio is passed through the core so the equalizer works
 * on it too; if a station refuses that, it plays directly without equalizer.
 */

const audio = new Audio();
audio.crossOrigin = 'anonymous';
audio.preload = 'auto';
const directAudio = new Audio(); // fallback for radio streams that can't go through the core

let ctx = null;
let eq = null;

function ensureGraph() {
  if (ctx) return;
  try {
    ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audio);
    const bass = Object.assign(ctx.createBiquadFilter(), { type: 'lowshelf' });
    bass.frequency.value = 120;
    const mid = Object.assign(ctx.createBiquadFilter(), { type: 'peaking' });
    mid.frequency.value = 1000;
    mid.Q.value = 0.8;
    const treble = Object.assign(ctx.createBiquadFilter(), { type: 'highshelf' });
    treble.frequency.value = 6000;
    const pan = ctx.createStereoPanner();
    source.connect(bass).connect(mid).connect(treble).connect(pan).connect(ctx.destination);
    eq = { bass, mid, treble, pan };
    applySound(lastSound);
  } catch (err) {
    console.warn('Equalizer not available:', err);
  }
}

let lastSound = { bass: 0, mid: 0, treble: 0, balance: 0 };
/** Values -10..+10. Gain in dB is 1.2 × value (so ±12 dB). */
export function applySound(sound) {
  if (!sound) return;
  lastSound = sound;
  if (!eq) return;
  eq.bass.gain.value = sound.bass * 1.2;
  eq.mid.gain.value = sound.mid * 1.2;
  eq.treble.gain.value = sound.treble * 1.2;
  eq.pan.pan.value = sound.balance / 10;
}

let state = {
  kind: null, // "media" | "radio" | null
  queue: [],
  index: -1,
  track: null,
  station: null,
  playing: false,
  loading: false,
  position: 0,
  duration: 0,
  shuffle: false,
  repeat: 'off', // "off" | "all" | "one"
  error: null,
};
const listeners = new Set();
// Tell the core what is playing, so the instrument cluster can show it too.
let lastShared = '';
function share() {
  const info = state.kind
    ? {
        kind: state.kind,
        title: state.kind === 'radio' ? state.station?.name : state.track?.title,
        artist: state.kind === 'radio' ? state.station?.tags || 'Radio' : state.track?.artist,
        playing: state.playing,
      }
    : null;
  const key = JSON.stringify(info);
  if (key !== lastShared) {
    lastShared = key;
    publish('media.nowPlaying', info);
  }
}

const set = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  share();
};

const active = () => (state.kind === 'radio' && state.direct ? directAudio : audio);

for (const el of [audio, directAudio]) {
  el.addEventListener('playing', () => el === active() && set({ playing: true, loading: false, error: null }));
  el.addEventListener('pause', () => el === active() && set({ playing: false }));
  el.addEventListener('waiting', () => el === active() && set({ loading: true }));
  el.addEventListener('timeupdate', () => el === active() && set({ position: el.currentTime, duration: Number.isFinite(el.duration) ? el.duration : 0 }));
}
audio.addEventListener('ended', () => next(true));
audio.addEventListener('error', () => {
  if (state.kind === 'radio' && !state.direct && state.station) {
    // The core could not pass this station through: play it directly instead.
    set({ direct: true });
    directAudio.src = state.station.url;
    directAudio.play().catch((err) => set({ error: err.message, loading: false }));
    return;
  }
  if (state.kind) set({ error: 'This file or station cannot be played', loading: false, playing: false });
});
directAudio.addEventListener('error', () => {
  if (state.kind === 'radio') set({ error: 'Station not available right now', loading: false, playing: false });
});

function load(src) {
  ensureGraph();
  ctx?.resume();
  directAudio.pause();
  directAudio.removeAttribute('src');
  audio.src = src;
  audio.play().catch(() => {}); // errors arrive through the "error" event
}

export function playTracks(queue, index) {
  const track = queue[index];
  if (!track) return;
  set({ kind: 'media', queue, index, track, station: null, direct: false, loading: true, error: null, position: 0, duration: track.duration ?? 0 });
  load(`${HUB_HTTP}/media/file/${track.id}`);
}

export function playStation(station) {
  set({ kind: 'radio', station, track: null, queue: [], index: -1, direct: false, loading: true, error: null, position: 0, duration: 0 });
  load(`${HUB_HTTP}/radio/stream?url=${encodeURIComponent(station.url)}`);
  command('radio.setLast', station).catch(() => {});
}

export function toggle() {
  const el = active();
  if (!state.kind) return;
  if (el.paused) {
    ctx?.resume();
    el.play().catch(() => {});
  } else {
    el.pause();
  }
}

export function stop() {
  audio.pause();
  directAudio.pause();
}

export function next(auto = false) {
  if (state.kind !== 'media' || !state.queue.length) return;
  if (auto && state.repeat === 'one') {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }
  let i;
  if (state.shuffle) i = Math.floor(Math.random() * state.queue.length);
  else i = state.index + 1;
  if (i >= state.queue.length) {
    if (state.repeat !== 'all' && auto) {
      set({ playing: false });
      return;
    }
    i = 0;
  }
  playTracks(state.queue, i);
}

export function previous() {
  if (state.kind !== 'media') return;
  // Like a car radio: first press restarts the song, a quick second press goes back.
  if (audio.currentTime > 3 || state.index === 0) {
    audio.currentTime = 0;
    return;
  }
  playTracks(state.queue, state.index - 1);
}

export function seek(seconds) {
  if (state.kind === 'media' && Number.isFinite(seconds)) audio.currentTime = seconds;
}

export const setShuffle = (shuffle) => set({ shuffle });
export const cycleRepeat = () => set({ repeat: { off: 'all', all: 'one', one: 'off' }[state.repeat] });

export function usePlayer() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
