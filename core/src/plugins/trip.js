/**
 * Trip computer, calculated from vehicle.speed (works with the simulator now
 * and with real car data later).
 *
 * Topics:
 *   trip.sinceStart  { distanceKm, durationS, avgSpeed, maxSpeed }   resets at every start-up
 *   trip.longTerm    { distanceKm, durationS, avgSpeed, maxSpeed, since }   reset by hand
 *
 * Commands:
 *   trip.reset { which: "sinceStart" | "longTerm" }
 */
import { openStore } from '../store.js';

const empty = () => ({ distanceKm: 0, durationS: 0, avgSpeed: 0, maxSpeed: 0 });
const round1 = (v) => Math.round(v * 10) / 10;

export default async function trip(hub, options = {}) {
  const tickMs = options.tickMs ?? 1000;
  const store = await openStore('trip', { longTerm: { ...empty(), since: new Date().toISOString() } });
  let sinceStart = empty();
  let longTerm = store.get('longTerm');
  let lastSave = Date.now();

  const add = (t, speed, seconds) => {
    const distanceKm = t.distanceKm + (speed * seconds) / 3600;
    const durationS = t.durationS + seconds;
    return {
      ...t,
      distanceKm,
      durationS,
      avgSpeed: durationS ? distanceKm / (durationS / 3600) : 0,
      maxSpeed: Math.max(t.maxSpeed, speed),
    };
  };

  const view = (t) => ({ ...t, distanceKm: round1(t.distanceKm), avgSpeed: Math.round(t.avgSpeed), durationS: Math.round(t.durationS) });

  const publish = () => {
    hub.set('trip.sinceStart', view(sinceStart));
    hub.set('trip.longTerm', view(longTerm));
  };

  function tick() {
    const speed = Number(hub.get('vehicle.speed')) || 0;
    const running = hub.get('vehicle.ignition') === 'run';
    if (!running) return;
    const seconds = tickMs / 1000;
    sinceStart = add(sinceStart, speed, seconds);
    longTerm = add(longTerm, speed, seconds);
    publish();
    if (Date.now() - lastSave > 60_000) {
      lastSave = Date.now();
      store.set('longTerm', longTerm);
    }
  }

  const unregister = hub.onCommand('trip.reset', async ({ which = 'sinceStart' } = {}) => {
    if (which === 'longTerm') {
      longTerm = { ...empty(), since: new Date().toISOString() };
      await store.set('longTerm', longTerm);
    } else {
      sinceStart = empty();
    }
    publish();
  });

  publish();
  const timer = setInterval(tick, tickMs);

  return {
    async stop() {
      clearInterval(timer);
      unregister();
      await store.set('longTerm', longTerm);
    },
  };
}
