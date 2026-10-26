import { ArcFill, Scale, arcPath } from '../Dial.jsx';
import { DRIVE_MODES, useDriveMode } from '../../theme.js';
import MapView from '../../MapView.jsx';
import { IndicatorRow, InfoPanel, MusicPill, Offline, RPM_MAX, RPM_RED, SPEED_MAX, TripLine, WarningRow, clockText } from '../shared.jsx';

const SPD = { cx: 380, cy: 370 };
const REV = { cx: 1540, cy: 370 };

function MonoDial({ c, value, max, major, minor, labelDivisor = 1, labelEvery, redFrom, arcClass, children }) {
  return (
    <>
      <svg className="face-svg" viewBox="0 0 1920 720">
        <circle {...c} r="300" className="mono-ring" />
        <Scale {...c} r={286} max={max} major={major} minor={minor} labelR={238} labelDivisor={labelDivisor} labelEvery={labelEvery} redFrom={redFrom} className="mono-scale" />
        {redFrom !== undefined && <path d={arcPath(c.cx, c.cy, 300, -135 + (270 * redFrom) / max, 135)} className="mono-red" />}
        <ArcFill value={value} max={max} {...c} r={300} className={arcClass} track={false} />
      </svg>
      <div className="mono-center" style={{ left: c.cx, top: c.cy }}>
        {children}
      </div>
    </>
  );
}

/** Mono: black and white, two dials with big numbers, a map in the middle. */
export default function Mono({ data, now }) {
  const [mode] = useDriveMode();
  const label = DRIVE_MODES.find(([id]) => id === mode)?.[1];
  return (
    <div className="face face-mono">
      <MonoDial c={SPD} value={data.needleSpeed} max={SPEED_MAX} major={20} minor={10} labelEvery={40} arcClass="mono-arc speed">
        <strong>{Math.round(data.speed)}</strong>
        <small>km/h</small>
        <div className="mono-bar">
          <i style={{ width: `${data.fuel ?? 0}%` }} className={data.fuel < 12 ? 'low' : ''} />
        </div>
        <em>Fuel {data.fuel !== undefined ? `${Math.round(data.fuel)}%` : '–'}</em>
      </MonoDial>
      <MonoDial c={REV} value={data.needleRpm} max={RPM_MAX} major={1000} minor={500} labelDivisor={1000} redFrom={RPM_RED} arcClass="mono-arc rev">
        <strong>{(data.rpm / 1000).toFixed(1)}</strong>
        <small>×1000 rpm</small>
        <div className="mono-bar">
          <i style={{ width: `${Math.max(0, Math.min(100, ((data.coolant ?? 50) - 50) / 0.8))}%` }} className={data.coolant > 112 ? 'low' : ''} />
        </div>
        <em>Coolant {data.coolant !== undefined ? `${data.coolant}°C` : '–'}</em>
      </MonoDial>

      <div className="mono-middle">
        <IndicatorRow lamps={data.lamps} />
        <MapView speed={data.speed} className="mono-map">
          <div className="mono-map-top">
            <MusicPill music={data.music} />
          </div>
          <div className="mono-map-info">
            <InfoPanel data={data} music={false} trip={false} />
          </div>
        </MapView>
        <div className="mono-gear">
          <strong>{data.gear ?? '–'}</strong>
          <span>{label}</span>
        </div>
        <TripLine trip={data.trip} />
      </div>

      <div className="mono-bottom">
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
