import { useEffect, useState } from 'react';
import { HUB_HTTP, command, useTopic } from '../../hub.js';
import { Icon } from '../../icons.jsx';
import { next, playTracks, previous, toggle, usePlayer } from '../../player.js';
import { usePref } from '../../prefs.js';

/* Data and small parts shared by the home screens. Each home only decides the look. */

/** What is playing: our player first, then music from the phone (CarPlay). */
export function useMusic() {
  const player = usePlayer();
  const carplay = useTopic('carplay.media');
  const radio = player.kind === 'radio';
  if (!player.kind) {
    return {
      player,
      empty: true,
      radio: false,
      phone: Boolean(carplay?.title),
      title: carplay?.title ?? 'Nothing playing',
      sub: carplay?.title ? carplay.artist ?? 'On your phone' : 'Tap for music and radio',
      art: null,
      progress: 0,
      target: carplay?.title ? 'fulllink' : 'media',
    };
  }
  return {
    player,
    empty: false,
    radio,
    title: (radio ? player.station?.name : player.track?.title) ?? '–',
    sub: player.error ?? (radio ? player.station?.tags || 'Internet radio' : player.track?.artist) ?? '',
    art: radio ? player.station?.favicon : player.track ? `${HUB_HTTP}/media/art/${player.track.id}` : null,
    progress: !radio && player.duration ? player.position / player.duration : 0,
    target: radio ? 'radio' : 'media',
  };
}

/** A colour that belongs to a song (made from its name), for "album colour" backgrounds. */
export function songHue(text = '') {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function useCar() {
  const doors = useTopic('vehicle.doors', {});
  return {
    speed: useTopic('vehicle.speed'),
    rpm: useTopic('vehicle.rpm'),
    gear: useTopic('vehicle.gear'),
    coolant: useTopic('vehicle.coolant'),
    fuel: useTopic('vehicle.fuel'),
    outside: useTopic('vehicle.outsideTemp'),
    locked: useTopic('vehicle.locked'),
    open: Object.values(doors).some(Boolean),
    codes: useTopic('diag.codes', []),
    trip: useTopic('trip.sinceStart'),
    odometer: useTopic('vehicle.odometer'),
  };
}

export const fmt = (v, digits = 0) => (v === undefined || v === null ? '–' : Number(v).toFixed(digits));

/** E46 330i tank is 63 litres; ~9 l/100 km mixed. A rough range for the widgets. */
export const rangeKm = (fuel) => (fuel === undefined ? '–' : Math.round(((fuel / 100) * 63 * 100) / 9));

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function useClockText() {
  const now = useNow();
  const [clock24] = usePref('clock24', true);
  return {
    now,
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !clock24 }),
    date: now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }),
    greeting: now.getHours() < 5 ? 'Good night' : now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening',
  };
}

/** A few songs from the first music source (USB or laptop), for song lists. */
export function useSongs(limit = 6) {
  const sources = useTopic('media.sources', []);
  const first = sources.find((s) => s.tracks > 0);
  const [songs, setSongs] = useState([]);
  useEffect(() => {
    if (!first) return undefined;
    let alive = true;
    fetch(`${HUB_HTTP}/media/library?source=${encodeURIComponent(first.id)}`)
      .then((r) => r.json())
      .then((list) => alive && setSongs(list))
      .catch(() => alive && setSongs([]));
    return () => {
      alive = false;
    };
  }, [first?.id, first?.tracks]);
  return { songs: songs.slice(0, limit), all: songs, play: (i) => playTracks(songs, i) };
}

/** Previous / play-pause / next. */
export function Controls({ music, className = '', size = 22 }) {
  const playing = music.player.playing;
  return (
    <div className={`hc-controls ${className}`}>
      <button onClick={previous} disabled={music.empty || music.radio} aria-label="Previous">
        <Icon name="prev" size={size} filled />
      </button>
      <button className="hc-play" onClick={toggle} disabled={music.empty} aria-label={playing ? 'Pause' : 'Play'}>
        <Icon name={playing ? 'pause' : 'play'} size={size} filled />
      </button>
      <button onClick={() => next()} disabled={music.empty || music.radio} aria-label="Next">
        <Icon name="next" size={size} filled />
      </button>
    </div>
  );
}

export const volumeStep = (delta) => command('audio.volumeStep', { delta }).catch(() => {});
