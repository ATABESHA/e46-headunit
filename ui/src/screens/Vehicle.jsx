import { command, useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';
import { Tabs } from '../widgets.jsx';
import { AmbientCard, CarStatus } from './Car.jsx';
import Diagnostics from './Diagnostics.jsx';
import Parking from './Parking.jsx';

const RPM_MAX = 7000;

const duration = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
};

function Gauge({ icon, label, value, unit, percent, warn }) {
  return (
    <div className={`gauge ${warn ? 'warn' : ''}`}>
      <span className="gauge-label">
        <Icon name={icon} size={16} /> {label}
      </span>
      <span className="gauge-value">
        {value ?? '–'}
        <small>{unit}</small>
      </span>
      {percent !== undefined && (
        <span className="bar">
          <i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
        </span>
      )}
    </div>
  );
}

function TripCard({ title, trip, which }) {
  return (
    <div className="card trip">
      <div className="card-head">
        <h2>{title}</h2>
        <button className="btn small" onClick={() => command('trip.reset', { which }).catch(() => {})}>
          Reset
        </button>
      </div>
      <div className="trip-grid">
        <span>
          <small>Distance</small>
          <strong>{trip?.distanceKm ?? 0} km</strong>
        </span>
        <span>
          <small>Driving time</small>
          <strong>{duration(trip?.durationS ?? 0)}</strong>
        </span>
        <span>
          <small>Average speed</small>
          <strong>{trip?.avgSpeed ?? 0} km/h</strong>
        </span>
        <span>
          <small>Top speed</small>
          <strong>{Math.round(trip?.maxSpeed ?? 0)} km/h</strong>
        </span>
      </div>
    </div>
  );
}

function DrivingData() {
  const speed = useTopic('vehicle.speed');
  const rpm = useTopic('vehicle.rpm', 0);
  const coolant = useTopic('vehicle.coolant');
  const fuel = useTopic('vehicle.fuel');
  const sinceStart = useTopic('trip.sinceStart');
  const longTerm = useTopic('trip.longTerm');
  return (
    <div className="driving">
      <div className="gauges">
        <Gauge icon="trip" label="Speed" value={speed} unit="km/h" />
        <Gauge icon="trip" label="Engine" value={rpm.toLocaleString()} unit="rpm" percent={(rpm / RPM_MAX) * 100} warn={rpm > 6500} />
        <Gauge icon="thermo" label="Coolant" value={coolant} unit="°C" percent={((coolant ?? 0) / 120) * 100} warn={coolant > 110} />
        <Gauge icon="fuel" label="Fuel" value={fuel !== undefined ? Math.round(fuel) : undefined} unit="%" percent={fuel} warn={fuel < 12} />
      </div>
      <div className="trips">
        <TripCard title="Since start" trip={sinceStart} which="sinceStart" />
        <TripCard title="Long-term" trip={longTerm} which="longTerm" />
      </div>
    </div>
  );
}

export default function Vehicle({ tab, onTab }) {
  const current = tab ?? 'driving';
  const codes = useTopic('diag.codes', []);
  return (
    <div className="vehicle">
      <Tabs
        value={current}
        onChange={onTab}
        tabs={[
          ['driving', 'Driving data', 'trip'],
          ['status', 'Status', 'car'],
          ['parking', 'Parking', 'parking'],
          ['codes', `Fault codes${codes.length ? ` (${codes.length})` : ''}`, 'wrench'],
          ['comfort', 'Comfort', 'light'],
        ]}
      />
      <div className="vehicle-body">
        {current === 'driving' && <DrivingData />}
        {current === 'status' && <CarStatus />}
        {current === 'parking' && <Parking />}
        {current === 'codes' && <Diagnostics />}
        {current === 'comfort' && <AmbientCard />}
      </div>
    </div>
  );
}
