/*
 * Demo mode: the whole system in one browser page, no core service needed.
 * The car simulator and the simulated phone from the core run right here,
 * so the designs can be tried on any computer (Windows, Mac, phone) by just
 * opening the page. Turned on by building with `npm run build:demo -w ui`,
 * or by adding ?demo to the address.
 *
 * Not in the demo: music library, radio, CarPlay and system volume (they
 * need the core on the car computer).
 */
import simulator from '../../core/src/plugins/simulator.js';
import phone from '../../core/src/plugins/phone.js';

/** The same small API as the core's hub (core/src/hub.js), without Node. */
class BrowserHub {
  constructor(onState) {
    this.state = new Map();
    this.handlers = new Map();
    this.onState = onState;
    this.noticeId = 0;
  }

  set(topic, value) {
    const prev = this.state.get(topic);
    if (prev !== undefined && JSON.stringify(prev) === JSON.stringify(value)) return;
    this.state.set(topic, value);
    this.onState(topic, value);
  }

  get(topic) {
    return this.state.get(topic);
  }

  snapshot() {
    return Object.fromEntries(this.state);
  }

  notify(level, text) {
    this.set('system.notice', { id: ++this.noticeId, level, text, at: Date.now() });
  }

  onCommand(topic, handler) {
    this.handlers.set(topic, handler);
    return () => this.handlers.delete(topic);
  }

  async command(topic, value) {
    const handler = this.handlers.get(topic);
    if (!handler) throw new Error(`"${topic}" is not available in the demo`);
    return handler(value);
  }

  route() {
    return () => {};
  }

  socket() {
    return () => {};
  }
}

/** Trip computer, like core/src/plugins/trip.js (without saving to disk). */
function trip(hub) {
  let t = { distanceKm: 0, durationS: 0, maxSpeed: 0 };
  const publish = () => {
    const avg = t.durationS ? t.distanceKm / (t.durationS / 3600) : 0;
    const view = { distanceKm: Math.round(t.distanceKm * 10) / 10, durationS: Math.round(t.durationS), avgSpeed: Math.round(avg), maxSpeed: t.maxSpeed };
    hub.set('trip.sinceStart', view);
    hub.set('trip.longTerm', view);
  };
  hub.onCommand('trip.reset', () => {
    t = { distanceKm: 0, durationS: 0, maxSpeed: 0 };
    publish();
  });
  setInterval(() => {
    if (hub.get('vehicle.ignition') !== 'run') return;
    const speed = Number(hub.get('vehicle.speed')) || 0;
    t = { distanceKm: t.distanceKm + speed / 3600, durationS: t.durationS + 1, maxSpeed: Math.max(t.maxSpeed, speed) };
    publish();
  }, 1000);
  publish();
}

/** Volume buttons work on the page's own sound. */
function volume(hub) {
  let v = { level: 50, muted: false, available: false };
  const apply = (patch) => {
    v = { ...v, ...patch, level: Math.min(100, Math.max(0, Math.round(patch.level ?? v.level))) };
    hub.set('audio.volume', v);
    return v;
  };
  hub.onCommand('audio.setVolume', ({ level } = {}) => apply({ level: Number(level) }));
  hub.onCommand('audio.volumeStep', ({ delta = 5 } = {}) => apply({ level: v.level + Number(delta), muted: false }));
  hub.onCommand('audio.mute', ({ muted } = {}) => apply({ muted: muted ?? !v.muted }));
  let sound = { bass: 0, mid: 0, treble: 0, balance: 0 };
  hub.set('audio.sound', sound);
  hub.onCommand('audio.setSound', (patch = {}) => {
    sound = { ...sound, ...patch };
    hub.set('audio.sound', sound);
    return sound;
  });
  apply({});
}

export function startDemo(onState) {
  const hub = new BrowserHub(onState);
  simulator(hub);
  phone(hub);
  trip(hub);
  volume(hub);
  hub.set('carplay.state', { status: 'no-adapter', message: 'Full Link needs the car computer (not in the demo).' });
  hub.set('media.sources', []);
  hub.set('system.version', { commit: 'demo', date: null, message: 'Browser demo: updates are done on the car computer.' });
  return hub;
}
