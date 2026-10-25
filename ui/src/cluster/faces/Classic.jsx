import { Dial, SubGauge } from '../Dial.jsx';
import { IndicatorRow, InfoPanel, Offline, RPM_MAX, RPM_RED, SPEED_MAX, WarningRow, clockText } from '../shared.jsx';

/** Two big round dials with the info in between (the original design). */
export default function Classic({ data, now }) {
  return (
    <div className="face face-classic">
      <Dial
        className="rev"
        value={data.needleRpm}
        max={RPM_MAX}
        major={1000}
        minor={250}
        labelDivisor={1000}
        redFrom={RPM_RED}
        unit="×1000 rpm"
        sub={<SubGauge value={data.coolant} min={50} max={130} warnAbove={112} left="C" right="H" />}
      >
        <div className="gear">{data.gear ?? '–'}</div>
      </Dial>

      <div className="cluster-middle">
        <IndicatorRow lamps={data.lamps} />
        <div className="cluster-info">
          <InfoPanel data={data} />
        </div>
        <WarningRow lamps={data.lamps} />
        <div className="cluster-bottom">
          <span>{clockText(now)}</span>
          <span>{data.odometer !== undefined ? `${data.odometer.toLocaleString()} km` : ''}</span>
          <span>{data.outside !== undefined ? `${data.outside}°C` : ''}</span>
        </div>
        <Offline connected={data.connected} />
      </div>

      <Dial
        className="speed"
        value={data.needleSpeed}
        max={SPEED_MAX}
        major={20}
        minor={10}
        labelSize={27}
        unit="km/h"
        sub={<SubGauge value={data.fuel} min={0} max={100} warnBelow={12} left="E" right="F" />}
      >
        <div className="digital-speed">{Math.round(data.speed)}</div>
      </Dial>
    </div>
  );
}
