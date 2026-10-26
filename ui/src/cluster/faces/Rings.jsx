import LedRing from '../../LedRing.jsx';
import { Icon } from '../../icons.jsx';
import MapView from '../../MapView.jsx';
import { IndicatorRow, InfoPanel, Offline, RPM_MAX, SPEED_MAX, WarningRow, clockText } from '../shared.jsx';

/**
 * Neon rings: LED rings like a modern arcade cabinet. Orange for speed,
 * electric blue for revs, small rings for fuel and the clock, a map strip.
 */
export default function Rings({ data, now }) {
  return (
    <div className="face face-rings">
      <LedRing size={620} value={data.needleSpeed / SPEED_MAX} color="orange" segments={64} width={20} className="rings-big left">
        <small>km/h</small>
        <strong>{Math.round(data.speed)}</strong>
        <span>Gear {data.gear ?? '–'}</span>
      </LedRing>
      <LedRing size={520} value={data.needleSpeed / SPEED_MAX} color="orange" segments={64} width={4} className="rings-big left inner" />

      <LedRing size={620} value={data.needleRpm / RPM_MAX} color="blue" segments={56} width={20} className="rings-big right">
        <small>×1000 rpm</small>
        <strong>{(data.rpm / 1000).toFixed(1)}</strong>
        <span>{data.coolant !== undefined ? `Coolant ${data.coolant}°C` : ''}</span>
      </LedRing>
      <LedRing size={520} value={data.needleRpm / RPM_MAX} color="blue" segments={56} width={4} className="rings-big right inner" />

      <div className="rings-middle">
        <IndicatorRow lamps={data.lamps} />
        <div className="rings-small">
          <LedRing size={150} value={(data.fuel ?? 0) / 100} color="blue" segments={24} width={8} from={0} to={360}>
            <Icon name="fuel" size={22} />
            <strong>{data.fuel !== undefined ? `${Math.round(data.fuel)}%` : '–'}</strong>
          </LedRing>
          <LedRing size={150} value={now.getSeconds() / 60} color="orange" segments={30} width={8} from={0} to={360}>
            <strong>{clockText(now)}</strong>
            <small>{data.outside !== undefined ? `${data.outside}°C` : ''}</small>
          </LedRing>
        </div>
        <div className="cluster-info">
          <InfoPanel data={data} trip={false} />
        </div>
        <MapView speed={data.speed} className="rings-map" arrow={false} />
      </div>

      <div className="rings-bottom">
        <WarningRow lamps={data.lamps} />
      </div>
      <Offline connected={data.connected} />
    </div>
  );
}
