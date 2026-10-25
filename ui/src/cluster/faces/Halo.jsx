import { ArcFill, SubGauge } from '../Dial.jsx';
import { Icon } from '../../icons.jsx';
import { IndicatorRow, InfoPanel, Offline, RPM_MAX, RPM_RED, SPEED_MAX, WarningRow, clockText } from '../shared.jsx';

const SPD = { cx: 960, cy: 350 };
const REV = { cx: 360, cy: 370 };

/**
 * The soft light around a ring. It's painted once (gradients, no blur) and
 * only its brightness changes, so the graphics chip barely notices it.
 * The petals turn very slowly as one layer (free for the graphics chip).
 */
function Glow({ size, level, petals = true }) {
  return (
    <div className="halo-glow" style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, opacity: 0.35 + 0.65 * level }}>
      <svg viewBox="-100 -100 200 200">
        <defs>
          <radialGradient id="halo-ring">
            <stop offset="0.6" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
            <stop offset="0.7" style={{ stopColor: "var(--accent)", stopOpacity: 0.55 }} />
            <stop offset="0.79" style={{ stopColor: "var(--accent)", stopOpacity: 0.18 }} />
            <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
          </radialGradient>
          <radialGradient id="halo-petal" cx="0.5" cy="0.35" r="0.6">
            <stop offset="0" style={{ stopColor: "var(--accent)", stopOpacity: 0.34 }} />
            <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        <circle r="100" fill="url(#halo-ring)" />
        {petals && (
          <g className="halo-petals">
            {[-100, -60, -20, 20, 60, 100].map((a) => (
              <ellipse key={a} cx="0" cy="-60" rx="22" ry="36" fill="url(#halo-petal)" transform={`rotate(${a})`} />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

/** Halo: a big glowing ring around the speed, a smaller one for the revs. */
export default function Halo({ data, now }) {
  const speedLevel = Math.min(1, data.needleSpeed / 200);
  const revLevel = Math.min(1, data.needleRpm / RPM_MAX);
  return (
    <div className="face face-halo">
      <div className="halo-spot" style={{ left: SPD.cx, top: SPD.cy }}>
        <Glow size={700} level={speedLevel} />
      </div>
      <div className="halo-spot" style={{ left: REV.cx, top: REV.cy }}>
        <Glow size={470} level={revLevel} petals={false} />
      </div>

      <svg className="face-svg" viewBox="0 0 1920 720">
        <circle cx={SPD.cx} cy={SPD.cy} r="232" className="halo-disc" />
        <ArcFill value={data.needleSpeed} max={SPEED_MAX} {...SPD} r={252} className="halo-arc" />
        <circle cx={REV.cx} cy={REV.cy} r="142" className="halo-disc" />
        <ArcFill value={data.needleRpm} max={RPM_MAX} {...REV} r={158} className={`halo-arc small ${data.rpm >= RPM_RED ? 'red' : ''}`} />
        <SubGauge value={data.coolant} min={50} max={130} warnAbove={112} left="C" right="H" {...REV} r={196} from={150} to={210} />
      </svg>

      <div className="halo-center" style={{ left: SPD.cx, top: SPD.cy }}>
        <small>km/h</small>
        <strong>{Math.round(data.speed)}</strong>
        <span className="halo-gear">{data.gear ?? '–'}</span>
      </div>
      <div className="halo-center small" style={{ left: REV.cx, top: REV.cy }}>
        <strong>{(data.rpm / 1000).toFixed(1)}</strong>
        <small>×1000 rpm</small>
      </div>

      <div className="halo-top">
        <IndicatorRow lamps={data.lamps} />
      </div>

      <div className="halo-right">
        <div className="cluster-info">
          <InfoPanel data={data} />
        </div>
        <div className="halo-fuel">
          <Icon name="fuel" size={24} />
          <div className="bar">
            <i style={{ width: `${data.fuel ?? 0}%` }} />
          </div>
          <span>{data.fuel !== undefined ? `${Math.round(data.fuel)}%` : '–'}</span>
        </div>
      </div>

      <div className="halo-bottom">
        <span>{data.outside !== undefined ? `${data.outside}°C` : ''}</span>
        <WarningRow lamps={data.lamps} />
        <span>
          {data.odometer !== undefined ? `${data.odometer.toLocaleString()} km` : ''} · {clockText(now)}
        </span>
      </div>
      <Offline connected={data.connected} />
    </div>
  );
}
