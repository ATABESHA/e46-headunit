import { ArcFill, Scale, SubGauge, arcPath } from '../Dial.jsx';
import { Icon } from '../../icons.jsx';
import { GearStrip, IndicatorRow, InfoPanel, MusicPill, Offline, RPM_MAX, RPM_RED, SPEED_MAX, WarningRow, clockText } from '../shared.jsx';

// Dial centres in the 1920 x 720 design.
const REV = { cx: 430, cy: 350 };
const SPD = { cx: 1490, cy: 350 };

/**
 * Sport capsule: one rounded panel glowing in the style's colour, thick
 * segmented bars for revs and speed, big gear in the middle of the rev dial.
 */
export default function Sport({ data, now }) {
  return (
    <div className="face face-sport">
      <div className="sport-capsule" />
      <svg className="face-svg" viewBox="0 0 1920 720">
        {/* Rev counter */}
        <circle cx={REV.cx} cy={REV.cy} r="250" className="sport-face" />
        <ArcFill value={data.needleRpm} max={RPM_MAX} {...REV} r={214} className="sport-bar" needle={[190, 240]} />
        <path d={arcPath(REV.cx, REV.cy, 240, -135 + (270 * RPM_RED) / RPM_MAX, 135)} className="sport-red" />
        <Scale {...REV} r={194} max={RPM_MAX} major={1000} minor={500} labelR={150} labelDivisor={1000} redFrom={RPM_RED} className="sport-scale" />
        <SubGauge value={data.coolant} min={50} max={130} warnAbove={112} left="C" right="H" {...REV} r={150} />

        {/* Speedometer */}
        <circle cx={SPD.cx} cy={SPD.cy} r="250" className="sport-face" />
        <ArcFill value={data.needleSpeed} max={SPEED_MAX} {...SPD} r={214} className="sport-bar" needle={[190, 240]} />
        <Scale {...SPD} r={194} max={SPEED_MAX} major={20} minor={10} labelR={148} labelEvery={40} className="sport-scale" />
        <SubGauge value={data.fuel} min={0} max={100} warnBelow={12} left="E" right="F" {...SPD} r={150} />
      </svg>

      <div className="sport-center rev" style={{ left: REV.cx, top: REV.cy }}>
        <strong className="sport-gear">{data.gear ?? '–'}</strong>
        <small>{data.rpm > 4500 ? 'SPORT' : 'MANUAL'}</small>
        <span>
          <Icon name="thermo" size={20} /> {data.coolant ?? '–'}°C
        </span>
      </div>
      <div className="sport-center speed" style={{ left: SPD.cx, top: SPD.cy }}>
        <strong>{Math.round(data.speed)}</strong>
        <small>km/h</small>
        <span>
          <Icon name="fuel" size={20} /> {data.fuel !== undefined ? `${Math.round(data.fuel)}%` : '–'}
        </span>
      </div>

      <div className="sport-middle">
        <IndicatorRow lamps={data.lamps} />
        <MusicPill music={data.music} />
        <div className="cluster-info">
          <InfoPanel data={data} music={false} trip={false} />
        </div>
        <WarningRow lamps={data.lamps} />
        <Offline connected={data.connected} />
      </div>

      <div className="sport-bottom">
        <span className="big">{data.outside !== undefined ? `${data.outside}°` : ''}</span>
        <span>
          <small>Trip</small> {data.trip?.distanceKm ?? 0} km
        </span>
        <GearStrip gear={data.gear} />
        <span>{data.odometer !== undefined ? `${data.odometer.toLocaleString()} km` : ''}</span>
        <span className="big">{clockText(now)}</span>
      </div>
    </div>
  );
}
