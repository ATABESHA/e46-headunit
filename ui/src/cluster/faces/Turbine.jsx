import { useEffect, useMemo, useRef } from 'react';
import { ArcFill, arcPath, polar } from '../Dial.jsx';
import { Icon } from '../../icons.jsx';
import { IndicatorRow, InfoPanel, Offline, RPM_MAX, WarningRow, clockText } from '../shared.jsx';

const BLADES = 26;
// The rev scale is part of a very large circle below the screen, so it curves up the left side.
const ARC = { cx: 960, cy: 1010, r: 880, from: -64, sweep: 26 };

function bladePath(theta) {
  const p = (r, a) => polar(0, 0, r, theta + a).map((n) => n.toFixed(1)).join(' ');
  return `M${p(146, 0)} Q${p(250, 0)} ${p(284, 32)} Q${p(232, 25)} ${p(212, 15)} Q${p(174, 6)} ${p(146, 0)}Z`;
}

/** One ring of curved blades, drawn once. */
function Blades({ id }) {
  const d = useMemo(() => Array.from({ length: BLADES }, (_, i) => bladePath((360 * i) / BLADES)), []);
  return (
    <svg viewBox="-300 -300 600 600" className={`turbine-layer ${id}`}>
      <defs>
        <radialGradient id={`turbine-${id}`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="290">
          <stop offset="0.5" style={{ stopColor: 'var(--blade-dark)' }} />
          <stop offset="0.82" style={{ stopColor: 'var(--blade)' }} />
          <stop offset="1" style={{ stopColor: 'var(--blade-tip)' }} />
        </radialGradient>
      </defs>
      {d.map((path, i) => (
        <path key={i} d={path} style={{ fill: 'var(--blade-fill)' }} stroke={`url(#turbine-${id})`} strokeWidth="2.2" />
      ))}
    </svg>
  );
}

/**
 * Turbine: a ring of blades around the speed that spins faster the faster you
 * go, and turns from blue to red at high revs. Spinning a ready-made layer is
 * done by the graphics chip alone, so it stays smooth on old hardware.
 */
export default function Turbine({ data, now }) {
  const spinRef = useRef(null);
  const speedRef = useRef(0);
  speedRef.current = data.needleSpeed;

  useEffect(() => {
    let frame;
    let angle = 0;
    let last = performance.now();
    const step = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      angle = (angle + dt * (6 + speedRef.current * 1.3)) % 360;
      if (spinRef.current) spinRef.current.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  const heat = Math.min(1, Math.max(0, (data.needleRpm - 4200) / 1600));
  const labels = [];
  for (let v = 0; v <= RPM_MAX; v += 1000) {
    const [x, y] = polar(ARC.cx, ARC.cy, ARC.r + 44, ARC.from + (ARC.sweep * v) / RPM_MAX);
    labels.push(
      <text key={v} x={x} y={y} className={`turbine-label ${v >= 6000 ? 'red' : ''}`}>
        {v / 1000}
      </text>,
    );
  }

  return (
    <div className="face face-turbine">
      <svg className="face-svg" viewBox="0 0 1920 720">
        {/* Cockpit outline */}
        <path d="M40 300C300 90 620 40 960 40s660 50 920 260" className="turbine-frame" />
        <path d="M90 330C340 140 640 96 960 96s620 44 870 234" className="turbine-frame faint" />
        {/* Rev scale */}
        <ArcFill value={data.needleRpm} max={RPM_MAX} {...ARC} className={`turbine-rev ${heat > 0.5 ? 'hot' : ''}`} />
        <path d={arcPath(ARC.cx, ARC.cy, ARC.r + 16, ARC.from + (ARC.sweep * 6000) / RPM_MAX, ARC.from + ARC.sweep)} className="turbine-red" />
        {labels}
      </svg>

      <div className="turbine" style={{ '--heat': heat }}>
        <div className="turbine-spin" ref={spinRef}>
          <Blades id="cold" />
          <Blades id="hot" />
        </div>
        <div className="turbine-core">
          <strong>{Math.round(data.speed)}</strong>
          <small>km/h</small>
          <span className="turbine-gear">{data.gear ?? '–'}</span>
        </div>
      </div>

      <div className="turbine-top">
        <span>{data.outside !== undefined ? `${data.outside}°C` : ''}</span>
        <span>{clockText(now)}</span>
      </div>
      <IndicatorRow lamps={data.lamps} className="turbine-lamps" />

      <div className="turbine-left">
        <span className="turbine-rpm">
          <strong>{(data.rpm / 1000).toFixed(1)}</strong> ×1000 rpm
        </span>
        <span>
          <Icon name="fuel" size={22} />
          <i className="bar">
            <i style={{ width: `${data.fuel ?? 0}%` }} />
          </i>
          {data.fuel !== undefined ? `${Math.round(data.fuel)}%` : '–'}
        </span>
        <span>
          <Icon name="thermo" size={22} /> {data.coolant ?? '–'}°C
        </span>
      </div>

      <div className="turbine-panel">
        <div className="cluster-info">
          <InfoPanel data={data} />
        </div>
      </div>

      <div className="turbine-bottom">
        <WarningRow lamps={data.lamps} />
        <span>{data.odometer !== undefined ? `${data.odometer.toLocaleString()} km` : ''}</span>
      </div>
      <Offline connected={data.connected} />
    </div>
  );
}
