import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useConnected, useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';
import { getPref } from '../prefs.js';
import { Dial, SubGauge } from './Dial.jsx';
import { INDICATORS, Lamp, WARNINGS } from './Lamps.jsx';
import { FxBackground, PerfHud, useFx } from '../fx.jsx';

// Designed for a 1920 x 720 cluster screen (common 12.3" size), scaled to any window.
const DESIGN = { width: 1920, height: 720 };

/** Follows the style chosen on the head unit (Settings → Display). */
function useSharedTheme() {
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = getPref('theme', 'media');
    };
    apply();
    // Another window (the head unit) changed the setting.
    const onStorage = (e) => {
      if (e.key === 'e46.theme') {
        try {
          document.documentElement.dataset.theme = JSON.parse(e.newValue);
        } catch {
          document.documentElement.dataset.theme = e.newValue;
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
}

function useFit(ref) {
  useLayoutEffect(() => {
    const apply = () => {
      const scale = Math.min(window.innerWidth / DESIGN.width, window.innerHeight / DESIGN.height);
      const el = ref.current;
      el.style.transform = `translate(${(window.innerWidth - DESIGN.width * scale) / 2}px, ${(window.innerHeight - DESIGN.height * scale) / 2}px) scale(${scale})`;
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [ref]);
}

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

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
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

/** Middle of the cluster: calls first, then warnings, then music + trip. */
function InfoPanel() {
  const call = useTopic('phone.call');
  const doors = useTopic('vehicle.doors', {});
  const codes = useTopic('diag.codes', []);
  const fuel = useTopic('vehicle.fuel');
  const nowPlaying = useTopic('media.nowPlaying');
  const carplay = useTopic('carplay.media');
  const trip = useTopic('trip.sinceStart');

  if (call) return <CallInfo call={call} />;

  // "Check Control" messages, like the original E46.
  const messages = [];
  const openDoors = Object.entries(doors).filter(([, open]) => open).map(([d]) => d);
  if (openDoors.length) messages.push(['warning', openDoors.includes('trunk') && openDoors.length === 1 ? 'Trunk open' : 'Door open']);
  if (fuel !== undefined && fuel < 12) messages.push(['fuel', 'Fuel low']);
  if (codes.some((c) => c.status === 'active')) messages.push(['wrench', 'Fault detected']);

  const music = carplay?.title ? { title: carplay.title, artist: carplay.artist ?? carplay.app } : nowPlaying;

  return (
    <div className="info-stack">
      {messages.map(([icon, text]) => (
        <div key={text} className="check-control">
          <Icon name={icon} size={26} />
          {text}
        </div>
      ))}
      {music?.title && (
        <div className="info-card media">
          <Icon name={music.kind === 'radio' ? 'radio' : 'media'} size={30} />
          <div>
            <strong>{music.title}</strong>
            {music.artist && <span>{music.artist}</span>}
          </div>
        </div>
      )}
      {/* Navigation directions will be shown here later. */}
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
    </div>
  );
}

export default function Cluster() {
  useSharedTheme();
  const [fx] = useFx();
  const ref = useRef(null);
  useFit(ref);
  const sweep = useSweep();
  const now = useClock();
  const connected = useConnected();

  const speed = useTopic('vehicle.speed', 0);
  const rpm = useTopic('vehicle.rpm', 0);
  const coolant = useTopic('vehicle.coolant');
  const fuel = useTopic('vehicle.fuel');
  const gear = useTopic('vehicle.gear');
  const odometer = useTopic('vehicle.odometer');
  const outside = useTopic('vehicle.outsideTemp');
  const carLamps = useTopic('vehicle.lamps', {});
  // Bulb check: every warning light is on while the needles sweep.
  const lamps = sweep ? Object.fromEntries([...WARNINGS, ...INDICATORS].map((n) => [n, true])) : carLamps;

  const SPEED_MAX = 260;
  const RPM_MAX = 7000;
  const target = (v, max) => (sweep === 'up' ? max : sweep === 'down' ? 0 : v);

  return (
    <div className="cluster-viewport">
      <div className="cluster" ref={ref}>
        <FxBackground level={fx} />
        <Dial
          className="rev"
          value={target(rpm, RPM_MAX)}
          max={RPM_MAX}
          major={1000}
          minor={250}
          labelDivisor={1000}
          redFrom={6500}
          unit="×1000 rpm"
          sub={<SubGauge value={coolant} min={50} max={130} warnAbove={112} left="C" right="H" />}
        >
          <div className="gear">{gear ?? '–'}</div>
        </Dial>

        <div className="cluster-middle">
          <div className="indicator-row">
            <Lamp name="turnLeft" on={lamps.turnLeft} />
            <div className="indicator-group">
              {INDICATORS.map((n) => (
                <Lamp key={n} name={n} on={lamps[n]} />
              ))}
            </div>
            <Lamp name="turnRight" on={lamps.turnRight} />
          </div>
          <div className="cluster-info">
            <InfoPanel />
          </div>
          <div className="warning-row">
            {WARNINGS.map((n) => (
              <Lamp key={n} name={n} on={lamps[n]} />
            ))}
          </div>
          <div className="cluster-bottom">
            <span>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            <span>{odometer !== undefined ? `${odometer.toLocaleString()} km` : ''}</span>
            <span>{outside !== undefined ? `${outside}°C` : ''}</span>
          </div>
          {!connected && <div className="cluster-offline">No car data</div>}
        </div>

        <Dial
          className="speed"
          value={target(speed, SPEED_MAX)}
          max={SPEED_MAX}
          major={20}
          minor={10}
          labelSize={27}
          unit="km/h"
          sub={<SubGauge value={fuel} min={0} max={100} warnBelow={12} left="E" right="F" />}
        >
          <div className="digital-speed">{Math.round(speed)}</div>
        </Dial>
      </div>
      <PerfHud label="Cluster" />
    </div>
  );
}
