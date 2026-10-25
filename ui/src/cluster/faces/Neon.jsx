import { useRef } from 'react';
import { ArcFill, polar, useSmooth } from '../Dial.jsx';
import { Icon } from '../../icons.jsx';
import { IndicatorRow, InfoPanel, Offline, RPM_MAX, SPEED_MAX, WarningRow, clockText } from '../shared.jsx';

const SPD = { cx: 520, cy: 360 };
const REV = { cx: 1400, cy: 360 };
const DOTS = 31;

/** A ring of dots that light up to the current value. Only dots that change are touched. */
function DotRing({ cx, cy, r, value, max }) {
  const ref = useRef(null);
  const lit = useRef(-1);
  useSmooth(value, (v) => {
    const n = Math.round((Math.min(max, Math.max(0, v)) / max) * (DOTS - 1));
    if (n === lit.current || !ref.current) return;
    const dots = ref.current.children;
    for (let i = 0; i < DOTS; i++) dots[i].classList.toggle('on', i <= n);
    lit.current = n;
  });
  return (
    <g ref={ref} className="neon-dots">
      {Array.from({ length: DOTS }, (_, i) => {
        const [x, y] = polar(cx, cy, r, -135 + (270 * i) / (DOTS - 1));
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="11" className="dot-glow" />
            <circle cx={x} cy={y} r="4.5" className="dot" />
          </g>
        );
      })}
    </g>
  );
}

function NeonDial({ c, id, value, max, sub, subMax, subWarn }) {
  return (
    <g className={`neon-dial ${id}`}>
      <circle cx={c.cx} cy={c.cy} r="256" className="neon-metal" />
      <circle cx={c.cx} cy={c.cy} r="244" className="neon-ring" stroke={`url(#neon-${id}-ring)`} />
      <DotRing {...c} r={212} value={value} max={max} />
      <circle cx={c.cx} cy={c.cy} r="156" fill={`url(#neon-${id}-disc)`} className="neon-disc" />
      <ArcFill value={value} max={max} {...c} r={180} className="neon-needle" needle={[158, 200]} track={false} />
      <ArcFill value={sub} max={subMax} {...c} r={186} from={152} sweep={56} className={`neon-sub ${subWarn ? 'warn' : ''}`} />
    </g>
  );
}

/** Neon: orange speed, blue revs, rings of dots, a small fuel ring and clock at the sides. */
export default function Neon({ data, now }) {
  const minutes = now.getMinutes() + now.getSeconds() / 60;
  const hours = (now.getHours() % 12) + minutes / 60;
  return (
    <div className="face face-neon">
      <svg className="face-svg" viewBox="0 0 1920 720">
        <defs>
          <linearGradient id="neon-speed-ring" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff8a1a" />
            <stop offset="1" stopColor="#e3121e" />
          </linearGradient>
          <linearGradient id="neon-rev-ring" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#35b8ff" />
            <stop offset="1" stopColor="#1f4fff" />
          </linearGradient>
          <radialGradient id="neon-speed-disc">
            <stop offset="0.55" stopColor="#0d0b0a" />
            <stop offset="1" stopColor="#4a1606" />
          </radialGradient>
          <radialGradient id="neon-rev-disc">
            <stop offset="0.55" stopColor="#090c10" />
            <stop offset="1" stopColor="#06294a" />
          </radialGradient>
          <linearGradient id="neon-fuel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1ea0ff" />
            <stop offset="1" stopColor="#ffd21a" />
          </linearGradient>
        </defs>

        {/* Faint street grid in the middle */}
        <g className="neon-grid">
          <path d="M860 720 940 470M1060 720 980 470M800 600h320M830 520h260M760 690h400" />
        </g>
        <path d="M960 720V500" className="neon-route" />

        <NeonDial c={SPD} id="speed" value={data.needleSpeed} max={SPEED_MAX} sub={data.coolant} subMax={130} subWarn={data.coolant > 112} />
        <NeonDial c={REV} id="rev" value={data.needleRpm} max={RPM_MAX} sub={data.fuel} subMax={100} subWarn={data.fuel < 12} />

        {/* Fuel ring (left) and clock (right) */}
        <circle cx="150" cy="520" r="92" className="neon-small" />
        <ArcFill value={data.fuel} max={100} cx={150} cy={520} r={74} from={-180} sweep={360} className="neon-fuel" />
        <circle cx="1770" cy="520" r="92" className="neon-small" />
        <circle cx="1770" cy="520" r="76" className="neon-clock-face" />
        {Array.from({ length: 12 }, (_, i) => {
          const [x1, y1] = polar(1770, 520, 72, i * 30);
          const [x2, y2] = polar(1770, 520, 64, i * 30);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="neon-clock-tick" />;
        })}
        <line x1="1770" y1="520" x2="1770" y2="478" className="neon-hand hour" transform={`rotate(${hours * 30} 1770 520)`} />
        <line x1="1770" y1="520" x2="1770" y2="462" className="neon-hand" transform={`rotate(${minutes * 6} 1770 520)`} />
      </svg>

      <div className="neon-center speed" style={{ left: SPD.cx, top: SPD.cy }}>
        <small>km/h</small>
        <strong>{Math.round(data.speed)}</strong>
        <span>
          <Icon name="thermo" size={22} />
        </span>
      </div>
      <div className="neon-center rev" style={{ left: REV.cx, top: REV.cy }}>
        <small>1/min × 1000</small>
        <strong>{(data.rpm / 1000).toFixed(1)}</strong>
        <span>
          <Icon name="fuel" size={22} />
        </span>
      </div>
      <div className="neon-fuel-text">
        <Icon name="fuel" size={26} />
        {data.fuel !== undefined ? `${Math.round(data.fuel)}%` : '–'}
      </div>

      <div className="neon-middle">
        <IndicatorRow lamps={data.lamps} />
        {data.music?.title ? (
          <div className="neon-music">
            <strong>{data.music.title}</strong>
            <span>{data.music.artist ?? ''}</span>
          </div>
        ) : (
          <div className="neon-music">
            <strong>{clockText(now)}</strong>
            <span>{data.outside !== undefined ? `${data.outside}°C outside` : ''}</span>
          </div>
        )}
        <div className="neon-gear">{data.gear ?? '–'}</div>
        <div className="neon-trip">{data.trip?.distanceKm ?? 0} km</div>
        <div className="cluster-info">
          <InfoPanel data={data} music={false} trip={false} />
        </div>
        <WarningRow lamps={data.lamps} />
        <Offline connected={data.connected} />
      </div>
    </div>
  );
}
