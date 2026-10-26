import { useRef } from 'react';
import { ArcFill, Scale } from '../Dial.jsx';
import { RollingNumber, useSpeedFrame } from '../Rolling.jsx';
import { IndicatorRow, InfoPanel, Offline, RPM_MAX, SPEED_MAX, WarningRow, clockText } from '../shared.jsx';

const C = { cx: 960, cy: 360 };

/** Petals of light around the dial: one grey layer and one blue layer on top that fades in with speed. */
function Petals({ className, style }) {
  return (
    <div className={`aura-petals ${className}`} style={style}>
      <svg viewBox="-100 -100 200 200">
        <defs>
          <radialGradient id={`aura-${className}`} cx="0.5" cy="0.2" r="0.75">
            <stop offset="0" className="aura-stop" stopOpacity="0.32" />
            <stop offset="1" className="aura-stop" stopOpacity="0" />
          </radialGradient>
        </defs>
        {Array.from({ length: 12 }, (_, i) => (
          <ellipse key={i} cx="0" cy="-74" rx="15" ry="24" fill={`url(#aura-${className})`} transform={`rotate(${i * 30})`} />
        ))}
      </svg>
    </div>
  );
}

/** The car seen from behind, in its lane. The lane lines move with the speed. */
function Lane({ speed }) {
  const ref = useRef(null);
  const offset = useRef(0);
  useSpeedFrame(speed, (v, dt) => {
    if (!ref.current || v < 0.5) return;
    offset.current = (offset.current + v * dt * 2.2) % 60;
    ref.current.style.setProperty('--travel', `${offset.current.toFixed(1)}px`);
  });
  return (
    <svg className="aura-lane" viewBox="0 0 420 420" ref={ref}>
      <defs>
        <linearGradient id="aura-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fb2ff" stopOpacity="0" />
          <stop offset="1" stopColor="#7fb2ff" stopOpacity="0.16" />
        </linearGradient>
      </defs>
      <path d="M150 40h120l140 380H10Z" fill="url(#aura-road)" />
      <path d="M150 40 10 420M270 40l140 380" className="aura-edge" />
      <path d="M190 40 140 420M230 40l50 380" className="aura-dash" />
      {/* E46 from behind */}
      <g transform="translate(150 250)">
        <ellipse cx="60" cy="98" rx="70" ry="10" fill="#000" opacity="0.5" />
        <path d="M14 40c2-18 12-34 24-38h44c12 4 22 20 24 38Z" className="aura-car-glass" />
        <path d="M4 44c0-6 6-8 10-8h92c4 0 10 2 10 8v38c0 6-4 10-10 10H14c-6 0-10-4-10-10Z" className="aura-car" />
        <rect x="8" y="50" width="30" height="12" rx="3" className="aura-tail" />
        <rect x="82" y="50" width="30" height="12" rx="3" className="aura-tail" />
        <rect x="44" y="66" width="32" height="10" rx="1.5" fill="#e8eaee" />
      </g>
    </svg>
  );
}

const GEARS = ['R', 'N', '1', '2', '3', '4', '5'];

/** Aura: one big dial whose petals of light turn from grey to blue as you speed up. */
export default function Aura({ data, now }) {
  const level = Math.min(1, data.needleSpeed / 160);
  return (
    <div className="face face-aura">
      <div className="aura-spot" style={{ left: C.cx, top: C.cy }}>
        <Petals className="grey" />
        <Petals className="blue" style={{ opacity: level }} />
      </div>

      <svg className="face-svg" viewBox="0 0 1920 720">
        <circle {...C} r="262" className="aura-disc" />
        <Scale {...C} r={300} max={SPEED_MAX} major={20} minor={10} labelR={340} labelEvery={40} className="aura-scale" />
        <ArcFill value={data.needleSpeed} max={SPEED_MAX} {...C} r={306} className="aura-arc" />
        <ArcFill value={data.needleRpm} max={RPM_MAX} {...C} r={244} className="aura-rpm" />
      </svg>

      <div className="aura-center" style={{ left: C.cx, top: C.cy }}>
        <RollingNumber value={data.speed} />
        <small>km/h</small>
        <span>{(data.rpm / 1000).toFixed(1)} ×1000 rpm</span>
      </div>

      <div className="aura-left">
        <Lane speed={data.speed} />
      </div>

      <div className="aura-gears">
        {GEARS.map((g) => (
          <span key={g} className={String(data.gear) === g ? 'on' : ''}>
            {g}
          </span>
        ))}
      </div>

      <div className="aura-right">
        <div className="cluster-info">
          <InfoPanel data={data} />
        </div>
      </div>

      <div className="aura-top">
        <IndicatorRow lamps={data.lamps} />
      </div>
      <div className="aura-bottom">
        <span>{data.fuel !== undefined ? `Fuel ${Math.round(data.fuel)}%` : ''}</span>
        <WarningRow lamps={data.lamps} />
        <span>
          {data.outside !== undefined ? `${data.outside}°C · ` : ''}
          {clockText(now)}
        </span>
      </div>
      <Offline connected={data.connected} />
    </div>
  );
}
