import { command, useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';
import { useState } from 'react';
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

const WHEEL_NAMES = { fl: 'Front left', fr: 'Front right', rl: 'Rear left', rr: 'Rear right' };

function TireBadge({ id, tire, reference }) {
  return (
    <div className={`tire-badge ${tire?.low ? 'low' : ''}`}>
      <small>{WHEEL_NAMES[id]}</small>
      <strong>
        {tire ? tire.pressure.toFixed(1) : '–'}
        <em> bar</em>
      </strong>
      <span>
        {tire?.low ? <Icon name="warning" size={14} /> : null}
        {tire ? `${tire.temp} °C` : ''}
        {reference ? ` · set ${reference.toFixed(1)}` : ''}
      </span>
    </div>
  );
}

/**
 * Tyre pressures (like the E46's flat-tyre monitor, RDC): a warning when a
 * tyre is 20 % below its saved pressure. After pumping up the tyres, Reset
 * saves the new pressures as correct.
 */
function Wheels() {
  const tires = useTopic('vehicle.tires');
  const [confirm, setConfirm] = useState(false);
  const low = tires ? Object.keys(WHEEL_NAMES).filter((w) => tires[w]?.low) : [];
  const ref = tires?.reference ?? {};
  const reset = () => {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setConfirm(false);
    command('tires.reset').catch(() => {});
  };
  return (
    <div className="wheels">
      <section className={`card wheels-status ${low.length ? 'low' : 'ok'}`}>
        <span className="wheels-icon">
          <Icon name={low.length ? 'warning' : 'check'} size={26} />
        </span>
        <h2>{!tires ? 'No tyre data' : low.length ? 'Tyre pressure low' : 'All tyres OK'}</h2>
        <p className="muted small">
          {low.length
            ? `Check ${low.map((w) => WHEEL_NAMES[w].toLowerCase()).join(' and ')}. Drive carefully and pump up the tyre, or look for a puncture.`
            : 'You get a warning here and on the cluster when a tyre loses 20 % of its pressure.'}
        </p>
        <div className="wheels-spec">
          <span>
            <small>Recommended (cold)</small>
            Front 2.2 · Rear 2.5 bar
          </span>
        </div>
        <button className={`btn ${confirm ? 'primary' : ''}`} onClick={reset} disabled={!tires}>
          <Icon name="update" size={18} /> {confirm ? 'Tap again to save pressures' : 'Reset tyre pressures'}
        </button>
        <small className="muted">{confirm ? 'Only after all four tyres are pumped up correctly.' : 'Do this after changing or pumping up the tyres.'}</small>
      </section>

      <section className="wheels-car">
        <div className="wheels-col">
          <TireBadge id="fl" tire={tires?.fl} reference={ref.fl} />
          <TireBadge id="rl" tire={tires?.rl} reference={ref.rl} />
        </div>
        <div className="wheels-photo">
          <img src="./car/top-solid.jpg" alt="" draggable="false" />
          {Object.keys(WHEEL_NAMES).map((w) => (
            <i key={w} className={`wheel-spot ${w} ${tires?.[w]?.low ? 'low' : ''}`} />
          ))}
        </div>
        <div className="wheels-col">
          <TireBadge id="fr" tire={tires?.fr} reference={ref.fr} />
          <TireBadge id="rr" tire={tires?.rr} reference={ref.rr} />
        </div>
      </section>
    </div>
  );
}

export default function Vehicle({ tab, onTab }) {
  const current = tab ?? 'driving';
  const tires = useTopic('vehicle.tires');
  const tiresLow = tires && ['fl', 'fr', 'rl', 'rr'].some((w) => tires[w]?.low);
  const codes = useTopic('diag.codes', []);
  return (
    <div className="vehicle">
      <Tabs
        value={current}
        onChange={onTab}
        tabs={[
          ['driving', 'Driving data', 'trip'],
          ['status', 'Status', 'car'],
          ['wheels', `Wheels${tiresLow ? ' ⚠' : ''}`, 'tire'],
          ['parking', 'Parking', 'parking'],
          ['codes', `Fault codes${codes.length ? ` (${codes.length})` : ''}`, 'wrench'],
          ['comfort', 'Comfort', 'light'],
        ]}
      />
      <div className="vehicle-body">
        {current === 'driving' && <DrivingData />}
        {current === 'status' && <CarStatus />}
        {current === 'wheels' && <Wheels />}
        {current === 'parking' && <Parking />}
        {current === 'codes' && <Diagnostics />}
        {current === 'comfort' && <AmbientCard />}
      </div>
    </div>
  );
}
