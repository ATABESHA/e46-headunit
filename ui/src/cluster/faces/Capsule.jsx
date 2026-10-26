import { ArcFill, Scale } from '../Dial.jsx';
import { DRIVE_MODES, useDriveMode } from '../../theme.js';
import { IndicatorRow, InfoPanel, Offline, RPM_MAX, RPM_RED, SPEED_MAX, WarningRow, clockText } from '../shared.jsx';

// Centres of the two round ends of the capsule.
const L = { cx: 400, cy: 360 };
const R = { cx: 1520, cy: 360 };

/**
 * Capsule: one long rounded shape. Speed climbs up the left end, revs up the
 * right end, and the middle holds calls, music and messages. The colour
 * follows the drive mode: Eco blue, Comfort white, Sport red (change it on
 * the Velocity home screen, or with the button here).
 */
export default function Capsule({ data, now }) {
  const [mode, setMode] = useDriveMode();
  const label = DRIVE_MODES.find(([id]) => id === mode)?.[1];
  const cycle = () => setMode(DRIVE_MODES[(DRIVE_MODES.findIndex(([id]) => id === mode) + 1) % DRIVE_MODES.length][0]);
  return (
    <div className="face face-capsule">
      <div className="capsule-shell" />

      <svg className="face-svg" viewBox="0 0 1920 720">
        {/* Speed: from the bottom of the left end, round the outside, to the top */}
        <Scale {...L} r={296} max={SPEED_MAX} major={20} minor={10} from={200} sweep={140} labelR={252} labelEvery={40} className="capsule-scale" />
        <ArcFill value={data.needleSpeed} max={SPEED_MAX} {...L} r={312} from={200} sweep={140} className="capsule-arc" />
        {/* Revs: the same on the right end, mirrored */}
        <Scale {...R} r={296} max={RPM_MAX} major={1000} minor={500} from={160} sweep={-140} labelR={252} labelDivisor={1000} redFrom={RPM_RED} className="capsule-scale" />
        <ArcFill value={data.needleRpm} max={RPM_MAX} {...R} r={312} from={160} sweep={-140} className={`capsule-arc ${data.rpm >= RPM_RED ? 'red' : ''}`} />
      </svg>

      <div className="capsule-num left" style={{ left: L.cx + 30, top: L.cy }}>
        <strong>{Math.round(data.speed)}</strong>
        <small>km/h</small>
      </div>
      <div className="capsule-num right" style={{ left: R.cx - 30, top: R.cy }}>
        <strong>{(data.rpm / 1000).toFixed(1)}</strong>
        <small>×1000 rpm</small>
      </div>

      <div className="capsule-middle">
        <IndicatorRow lamps={data.lamps} />
        <button className="capsule-mode" onClick={cycle}>
          <span className="capsule-gear">{data.gear ?? '–'}</span>
          {label}
        </button>
        <div className="cluster-info">
          <InfoPanel data={data} />
        </div>
        <WarningRow lamps={data.lamps} />
        <div className="capsule-bottom">
          <span>{data.fuel !== undefined ? `Fuel ${Math.round(data.fuel)}%` : ''}</span>
          <span>{clockText(now)}</span>
          <span>{data.outside !== undefined ? `${data.outside}°C` : ''}</span>
        </div>
      </div>
      <Offline connected={data.connected} />
    </div>
  );
}
