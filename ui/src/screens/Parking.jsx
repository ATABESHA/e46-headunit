import { useEffect, useRef, useState } from 'react';
import { useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';

const SENSORS = [
  { key: 'rearLeft', from: -60, to: -30 },
  { key: 'rearMidLeft', from: -30, to: 0 },
  { key: 'rearMidRight', from: 0, to: 30 },
  { key: 'rearRight', from: 30, to: 60 },
];
const LEVEL_COLORS = ['', 'var(--good)', 'var(--warn)', 'var(--bad)'];

/** 0 = nothing seen, 1 = far, 2 = close, 3 = very close */
export function level(cm) {
  if (cm === null || cm === undefined) return 0;
  if (cm <= 30) return 3;
  if (cm <= 70) return 2;
  if (cm <= 150) return 1;
  return 0;
}

// Ring segment behind the bumper. Angle 0 = straight back.
function arc(cx, cy, r1, r2, a1, a2) {
  const p = (r, a) => {
    const rad = (a * Math.PI) / 180;
    return `${(cx + r * Math.sin(rad)).toFixed(1)} ${(cy + r * Math.cos(rad)).toFixed(1)}`;
  };
  return `M${p(r1, a1)} L${p(r2, a1)} A${r2} ${r2} 0 0 0 ${p(r2, a2)} L${p(r1, a2)} A${r1} ${r1} 0 0 1 ${p(r1, a1)} Z`;
}

// Beeps faster as the car gets closer; one long tone when very close.
function useParkingBeep(closest, enabled) {
  const ctxRef = useRef(null);
  useEffect(() => {
    const lvl = level(closest);
    if (!enabled || lvl === 0) return undefined;
    const ctx = (ctxRef.current ??= new AudioContext());
    const beep = (seconds) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 1800;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + seconds);
    };
    if (lvl === 3) {
      beep(0.5);
      const timer = setInterval(() => beep(0.5), 450);
      return () => clearInterval(timer);
    }
    const every = lvl === 2 ? 300 : 700;
    beep(0.08);
    const timer = setInterval(() => beep(0.08), every);
    return () => clearInterval(timer);
  }, [level(closest), enabled]);
}

export default function Parking({ onClose }) {
  const distances = useTopic('parking.distances', {});
  const [sound, setSound] = useState(true);
  const values = SENSORS.map((s) => distances[s.key]).filter((v) => typeof v === 'number');
  const closest = values.length ? Math.min(...values) : null;
  useParkingBeep(closest, sound);

  const cx = 160;
  const cy = 150;

  return (
    <div className="parking">
      <div className="card camera">
        <Icon name="camera" size={48} />
        <p>Reverse camera</p>
        <small>Appears here once a USB camera is connected</small>
      </div>

      <div className="card sensors">
        <div className="card-head">
          <h2>Rear sensors</h2>
          <div className="button-row">
            <button className="icon-btn" onClick={() => setSound((s) => !s)} aria-label={sound ? 'Mute' : 'Unmute'}>
              <Icon name={sound ? 'sound' : 'mute'} />
            </button>
            {onClose && (
              <button className="icon-btn" onClick={onClose} aria-label="Close">
                <Icon name="close" />
              </button>
            )}
          </div>
        </div>

        <svg className="sensor-view" viewBox="0 0 320 300">
          <rect className="car-body" x="110" y="-120" width="100" height="270" rx="34" />
          <rect className="car-glass" x="124" y="70" width="72" height="40" rx="8" />
          {SENSORS.map((s) => {
            const lvl = level(distances[s.key]);
            return [0, 1, 2].map((band) => {
              // Outer bands light first; all three lit = very close.
              const lit = lvl > 0 && band >= 3 - lvl;
              const r1 = 22 + band * 34;
              return (
                <path
                  key={`${s.key}-${band}`}
                  d={arc(cx, cy, r1, r1 + 26, s.from + 1.5, s.to - 1.5)}
                  fill={lit ? LEVEL_COLORS[lvl] : 'var(--surface-3)'}
                />
              );
            });
          })}
        </svg>

        <div className={`closest level-${level(closest)}`}>
          {closest === null ? 'Clear' : `${closest} cm`}
        </div>
      </div>
    </div>
  );
}
