import { useRef } from 'react';
import { ArcFill, Scale } from '../Dial.jsx';
import { useSpeedFrame } from '../Rolling.jsx';
import { Icon } from '../../icons.jsx';
import MapView from '../../MapView.jsx';
import { IndicatorRow, InfoPanel, Offline, RPM_MAX, RPM_RED, TripLine, WarningRow, clockText } from '../shared.jsx';

const T = { cx: 960, cy: 360 };
// The rev scale is a slice of a very big circle, so it curves gently on the left.
const TACH = { cx: 980, cy: 360, r: 660 };

const BLADES = Array.from({ length: 22 }, (_, i) => i * (360 / 22));

/**
 * Vortex: a turbine in the middle. Its blades spin faster as you drive faster
 * and the whole ring changes from cool blue through violet to hot red. Revs on a long curved
 * scale on the left, round album cover and a map on the right.
 */
export default function Vortex({ data, now }) {
  const faceRef = useRef(null);
  const bladesRef = useRef(null);
  const angle = useRef(0);
  const shown = useRef(0);
  useSpeedFrame(data.needleSpeed, (v, dt) => {
    shown.current += (v - shown.current) * Math.min(1, dt * 4);
    angle.current = (angle.current + (8 + shown.current * 3.2) * dt) % 360;
    bladesRef.current?.setAttribute('transform', `rotate(${angle.current.toFixed(2)})`);
    const heat = Math.min(1, shown.current / 200);
    faceRef.current?.style.setProperty('--vortex', `hsl(${Math.round(212 + 148 * heat)} 95% ${58 - heat * 4}%)`);
  });
  const music = data.music;

  return (
    <div className="face face-vortex" ref={faceRef}>
      <svg className="face-svg" viewBox="0 0 1920 720">
        <defs>
          <radialGradient id="vortex-glow">
            <stop offset="0.55" style={{ stopColor: 'var(--vortex)', stopOpacity: 0 }} />
            <stop offset="0.8" style={{ stopColor: 'var(--vortex)', stopOpacity: 0.35 }} />
            <stop offset="1" style={{ stopColor: 'var(--vortex)', stopOpacity: 0 }} />
          </radialGradient>
          <linearGradient id="vortex-blade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--vortex)', stopOpacity: 0.95 }} />
            <stop offset="1" style={{ stopColor: 'var(--vortex)', stopOpacity: 0.1 }} />
          </linearGradient>
        </defs>

        <circle {...T} r="330" fill="url(#vortex-glow)" />
        <g transform={`translate(${T.cx} ${T.cy})`}>
          <g ref={bladesRef}>
            {BLADES.map((a) => (
              <path key={a} transform={`rotate(${a})`} d="M-6 -128C30 -160 44 -206 30 -262L14 -262C24 -210 12 -168 -22 -134Z" fill="url(#vortex-blade)" />
            ))}
          </g>
          <circle r="276" className="vortex-ring" />
          <circle r="124" className="vortex-hub" />
        </g>

        <Scale {...TACH} max={RPM_MAX} major={1000} minor={250} from={238} sweep={64} labelR={TACH.r - 52} labelDivisor={1000} redFrom={RPM_RED} majorLen={26} minorLen={12} className="vortex-scale" />
        <ArcFill value={data.needleRpm} max={RPM_MAX} {...TACH} r={TACH.r + 14} from={238} sweep={64} className={`vortex-tach ${data.rpm >= RPM_RED ? 'red' : ''}`} />
      </svg>

      <div className="vortex-center" style={{ left: T.cx, top: T.cy }}>
        <strong>{Math.round(data.speed)}</strong>
        <small>km/h</small>
      </div>

      <div className="vortex-left">
        <span className="vortex-gear">{data.gear ?? '–'}</span>
        <strong>{Math.round(data.rpm)}</strong>
        <small>rpm</small>
        <div className="vortex-mini">
          <span>
            <Icon name="fuel" size={20} /> {data.fuel !== undefined ? `${Math.round(data.fuel)}%` : '–'}
          </span>
          <span className={data.coolant > 112 ? 'warn' : ''}>
            <Icon name="thermo" size={20} /> {data.coolant ?? '–'}°
          </span>
        </div>
      </div>

      <div className="vortex-music">
        <div className={`vortex-disc ${music?.title ? 'on' : ''}`}>
          <Icon name={music?.kind === 'radio' ? 'radio' : 'media'} size={54} />
        </div>
        <strong>{music?.title ?? 'No music'}</strong>
        <span>{music?.artist ?? ''}</span>
        <div className="vortex-info">
          <InfoPanel data={data} music={false} trip={false} />
        </div>
      </div>

      <MapView speed={data.speed} className="vortex-map" />

      <div className="vortex-top">
        <IndicatorRow lamps={data.lamps} />
      </div>
      <div className="vortex-bottom">
        <TripLine trip={data.trip} />
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
