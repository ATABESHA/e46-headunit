import { useEffect, useState } from 'react';
import { useConnected, useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';
import { INDICATORS, Lamp, WARNINGS } from './Lamps.jsx';

/*
 * Everything the cluster faces share: car data, the start-up needle sweep,
 * the lamps, and the middle info (calls, Check Control, music, trip).
 * A face only decides how it looks.
 */

export const SPEED_MAX = 260;
export const RPM_MAX = 7000;
export const RPM_RED = 6500;

/** Needles sweep to the end and back at start-up, like a real cluster. */
function useSweep() {
  const [phase, setPhase] = useState('up');
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('down'), 750);
    const t2 = setTimeout(() => setPhase(null), 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  return phase;
}

export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export const clockText = (now) => now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export function useClusterData() {
  const sweep = useSweep();
  const connected = useConnected();
  const speed = useTopic('vehicle.speed', 0);
  const rpm = useTopic('vehicle.rpm', 0);
  const carLamps = useTopic('vehicle.lamps', {});
  // Bulb check: every warning light is on while the needles sweep.
  const lamps = sweep ? Object.fromEntries([...WARNINGS, ...INDICATORS].map((n) => [n, true])) : carLamps;
  const target = (v, max) => (sweep === 'up' ? max : sweep === 'down' ? 0 : v);
  const nowPlaying = useTopic('media.nowPlaying');
  const carplay = useTopic('carplay.media');

  return {
    connected,
    sweep,
    speed,
    rpm,
    // What the needles should point at (the sweep overrides the car).
    needleSpeed: target(speed, SPEED_MAX),
    needleRpm: target(rpm, RPM_MAX),
    coolant: useTopic('vehicle.coolant'),
    fuel: useTopic('vehicle.fuel'),
    gear: useTopic('vehicle.gear'),
    odometer: useTopic('vehicle.odometer'),
    outside: useTopic('vehicle.outsideTemp'),
    trip: useTopic('trip.sinceStart'),
    lamps,
    music: carplay?.title ? { title: carplay.title, artist: carplay.artist ?? carplay.app, kind: 'media' } : nowPlaying,
  };
}

export function IndicatorRow({ lamps, className = '' }) {
  return (
    <div className={`indicator-row ${className}`}>
      <Lamp name="turnLeft" on={lamps.turnLeft} />
      <div className="indicator-group">
        {INDICATORS.map((n) => (
          <Lamp key={n} name={n} on={lamps[n]} />
        ))}
      </div>
      <Lamp name="turnRight" on={lamps.turnRight} />
    </div>
  );
}

/**
 * Warning lights. There are 14, so like a modern cluster only the lit ones
 * are shown (all: true shows the unlit ones too, dimmed).
 */
export function WarningRow({ lamps, className = '', all = false }) {
  return (
    <div className={`warning-row ${className}`}>
      {WARNINGS.filter((n) => all || lamps[n]).map((n) => (
        <Lamp key={n} name={n} on={lamps[n]} />
      ))}
    </div>
  );
}

function CallInfo({ call }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const secs = call.startedAt ? Math.floor((Date.now() - call.startedAt) / 1000) : 0;
  const status = { incoming: 'Incoming call', outgoing: 'Calling…', active: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, ended: 'Call ended', failed: 'Call failed' }[call.state];
  return (
    <div className="info-card call">
      <Icon name="call" size={40} />
      <strong>{call.name ?? call.number}</strong>
      <span>{status}</span>
    </div>
  );
}

/** "Check Control" messages, like the original E46. */
export function useMessages() {
  const doors = useTopic('vehicle.doors', {});
  const codes = useTopic('diag.codes', []);
  const fuel = useTopic('vehicle.fuel');
  const messages = [];
  const openDoors = Object.entries(doors).filter(([, open]) => open).map(([d]) => d);
  if (openDoors.length) messages.push(['warning', openDoors.includes('trunk') && openDoors.length === 1 ? 'Trunk open' : 'Door open']);
  if (fuel !== undefined && fuel < 12) messages.push(['fuel', 'Fuel low']);
  if (codes.some((c) => c.status === 'active')) messages.push(['wrench', 'Fault detected']);
  return messages;
}

export function MusicCard({ music }) {
  if (!music?.title) return null;
  return (
    <div className="info-card media">
      <Icon name={music.kind === 'radio' ? 'radio' : 'media'} size={30} />
      <div>
        <strong>{music.title}</strong>
        {music.artist && <span>{music.artist}</span>}
      </div>
    </div>
  );
}

export function TripLine({ trip }) {
  return (
    <div className="trip-line">
      <span>
        <small>Trip</small>
        {trip?.distanceKm ?? 0} km
      </span>
      <span>
        <small>Average</small>
        {trip?.avgSpeed ?? 0} km/h
      </span>
      <span>
        <small>Time</small>
        {Math.floor((trip?.durationS ?? 0) / 60)} min
      </span>
    </div>
  );
}

/** Middle of the cluster: calls first, then warnings, then music + trip. */
export function InfoPanel({ data, music = true, trip = true }) {
  const call = useTopic('phone.call');
  const messages = useMessages();
  if (call) return <CallInfo call={call} />;
  return (
    <div className="info-stack">
      {messages.map(([icon, text]) => (
        <div key={text} className="check-control">
          <Icon name={icon} size={26} />
          {text}
        </div>
      ))}
      {music && <MusicCard music={data.music} />}
      {/* Navigation directions will be shown here later. */}
      {trip && <TripLine trip={data.trip} />}
    </div>
  );
}

/** Small "now playing" pill, used at the top of some faces. */
export function MusicPill({ music }) {
  if (!music?.title) return null;
  return (
    <div className="music-pill">
      <Icon name={music.kind === 'radio' ? 'radio' : 'media'} size={22} />
      <strong>{music.title}</strong>
      {music.artist && <span>{music.artist}</span>}
    </div>
  );
}

export function Offline({ connected }) {
  return connected ? null : <div className="cluster-offline">No car data</div>;
}

/** Gear strip for the manual gearbox: R N 1 2 3 4 5, the current one lit. */
export function GearStrip({ gear }) {
  return (
    <div className="gear-strip">
      {['R', 'N', '1', '2', '3', '4', '5'].map((g) => (
        <span key={g} className={String(gear) === g ? 'on' : ''}>
          {g}
        </span>
      ))}
    </div>
  );
}
