import { ArcFill, Scale, SubGauge, arcPath } from '../Dial.jsx';
import { Icon } from '../../icons.jsx';
import { IndicatorRow, InfoPanel, MusicPill, Offline, RPM_MAX, SPEED_MAX, WarningRow, clockText } from '../shared.jsx';

const SPD = { cx: 470, cy: 370 };
const REV = { cx: 1450, cy: 370 };
const RED_FROM = 6000;

/**
 * Minimal: two large thin dials, numbers inside the ring, a green bar for the
 * speed and a red zone for the revs. Black (Monochrome) or white (Daylight).
 */
export default function Minimal({ data, now }) {
  return (
    <div className="face face-minimal">
      <svg className="face-svg" viewBox="0 0 1920 720">
        {/* Road in the middle, like looking ahead */}
        <path d="M800 690 930 360M1120 690 990 360" className="min-road" />
        <path d="M960 690V360" className="min-road dashed" />

        {/* Speedometer */}
        <circle cx={SPD.cx} cy={SPD.cy} r="292" className="min-face" />
        <ArcFill value={data.needleSpeed} max={SPEED_MAX} {...SPD} r={272} className="min-go" needle={[226, 292]} />
        <Scale {...SPD} r={262} max={SPEED_MAX} major={20} minor={10} labelR={208} labelEvery={20} className="min-scale" majorLen={14} minorLen={7} />
        <circle cx={SPD.cx} cy={SPD.cy} r="160" className="min-disc" />
        <SubGauge value={data.fuel} min={0} max={100} warnBelow={12} left="" right="" {...SPD} r={268} from={160} to={200} />

        {/* Rev counter */}
        <circle cx={REV.cx} cy={REV.cy} r="292" className="min-face" />
        <path d={arcPath(REV.cx, REV.cy, 272, -135 + (270 * RED_FROM) / RPM_MAX, 135)} className="min-red" />
        <ArcFill value={data.needleRpm} max={RPM_MAX} {...REV} r={272} className="min-rev" needle={[226, 292]} />
        <Scale {...REV} r={262} max={RPM_MAX} major={1000} minor={250} labelR={214} labelDivisor={1000} redFrom={RED_FROM} className="min-scale" majorLen={14} minorLen={7} />
        <circle cx={REV.cx} cy={REV.cy} r="160" className="min-disc" />
        <SubGauge value={data.coolant} min={50} max={130} warnAbove={112} left="" right="" {...REV} r={268} from={160} to={200} />
      </svg>

      <div className="min-center" style={{ left: SPD.cx, top: SPD.cy }}>
        <strong>{Math.round(data.speed)}</strong>
        <small>km/h</small>
      </div>
      <div className="min-under" style={{ left: SPD.cx, top: SPD.cy + 236 }}>
        <Icon name="fuel" size={22} /> {data.fuel !== undefined ? `${Math.round(data.fuel)}%` : '–'}
      </div>
      <div className="min-center" style={{ left: REV.cx, top: REV.cy }}>
        <strong>{(data.rpm / 1000).toFixed(1)}</strong>
        <small>×1000 rpm</small>
      </div>
      <div className="min-under" style={{ left: REV.cx, top: REV.cy + 236 }}>
        <small>C</small> <Icon name="thermo" size={22} /> {data.coolant ?? '–'}°C <small>H</small>
      </div>

      <div className="min-middle">
        <IndicatorRow lamps={data.lamps} />
        <MusicPill music={data.music} />
        <div className="min-gear-row">
          <span>
            <small>Outside</small>
            {data.outside !== undefined ? `${data.outside}°C` : '–'}
          </span>
          <strong>{data.gear ?? '–'}</strong>
          <span>
            <small>Time</small>
            {clockText(now)}
          </span>
        </div>
        <small className="min-mode">Manual</small>
        <div className="cluster-info">
          <InfoPanel data={data} music={false} trip={false} />
        </div>
        <WarningRow lamps={data.lamps} />
        <div className="min-trip">
          <span>
            <strong>{data.trip?.distanceKm ?? 0}</strong> km
          </span>
          <span>
            <strong>{data.trip?.avgSpeed ?? 0}</strong> km/h avg
          </span>
          <span>
            <strong>{data.odometer !== undefined ? data.odometer.toLocaleString() : '–'}</strong> km
          </span>
        </div>
        <Offline connected={data.connected} />
      </div>
    </div>
  );
}
