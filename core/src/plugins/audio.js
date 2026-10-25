/**
 * Volume and sound settings.
 *
 * Volume is the laptop's system volume (PipeWire, via `wpctl`), so it also
 * changes CarPlay and everything else. Keyboard volume keys are picked up too.
 *
 * Topics:
 *   audio.volume  { level 0-100, muted, available }
 *   audio.sound   { bass, mid, treble, balance }   -10..+10 each
 *
 * Commands:
 *   audio.setVolume { level }   audio.volumeStep { delta }   audio.mute { muted? }
 *   audio.setSound  { bass?, mid?, treble?, balance? }
 */
import { execFile } from 'node:child_process';
import { openStore } from '../store.js';

const SINK = '@DEFAULT_AUDIO_SINK@';
const SOUND_KEYS = ['bass', 'mid', 'treble', 'balance'];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function wpctl(args) {
  return new Promise((resolve, reject) => {
    execFile('wpctl', args, { timeout: 3000 }, (err, stdout) => (err ? reject(err) : resolve(stdout.trim())));
  });
}

export default async function audio(hub, options = {}) {
  const run = options.wpctl ?? wpctl;
  const store = await openStore('sound', { bass: 0, mid: 0, treble: 0, balance: 0 });
  let volume = { level: 50, muted: false, available: false };

  hub.set('audio.sound', Object.fromEntries(SOUND_KEYS.map((k) => [k, store.get(k)])));

  async function read() {
    try {
      // Example output: "Volume: 0.45" or "Volume: 0.45 [MUTED]"
      const out = await run(['get-volume', SINK]);
      const level = Math.round(parseFloat(out.split(':')[1]) * 100);
      volume = { level: Number.isFinite(level) ? level : volume.level, muted: out.includes('MUTED'), available: true };
    } catch {
      volume = { ...volume, available: false }; // No PipeWire (e.g. tests): volume is only shown
    }
    hub.set('audio.volume', { ...volume });
  }

  async function setLevel(level) {
    const next = clamp(Math.round(level), 0, 100);
    if (volume.available) {
      await run(['set-volume', SINK, (next / 100).toFixed(2)]);
      if (volume.muted && next > 0) await run(['set-mute', SINK, '0']);
      await read();
    } else {
      volume = { ...volume, level: next, muted: false };
      hub.set('audio.volume', { ...volume });
    }
    return volume;
  }

  const unregister = [
    hub.onCommand('audio.setVolume', ({ level } = {}) => setLevel(Number(level))),
    hub.onCommand('audio.volumeStep', ({ delta = 5 } = {}) => setLevel(volume.level + Number(delta))),
    hub.onCommand('audio.mute', async ({ muted } = {}) => {
      const next = muted ?? !volume.muted;
      if (volume.available) {
        await run(['set-mute', SINK, next ? '1' : '0']);
        await read();
      } else {
        volume = { ...volume, muted: next };
        hub.set('audio.volume', { ...volume });
      }
      return volume;
    }),
    hub.onCommand('audio.setSound', async (value = {}) => {
      for (const key of SOUND_KEYS) {
        if (value[key] !== undefined) await store.set(key, clamp(Math.round(Number(value[key]) || 0), -10, 10));
      }
      const sound = Object.fromEntries(SOUND_KEYS.map((k) => [k, store.get(k)]));
      hub.set('audio.sound', sound);
      return sound;
    }),
  ];

  await read();
  // Notice volume changes made elsewhere (keyboard keys, CarPlay).
  const timer = setInterval(read, options.pollMs ?? 1500);

  return {
    stop() {
      clearInterval(timer);
      unregister.forEach((fn) => fn());
    },
  };
}
