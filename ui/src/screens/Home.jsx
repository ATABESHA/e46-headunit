import { command, useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';

const RPM_MAX = 7000;
const RPM_RED = 6500;

function Gauge({ icon, label, value, unit, percent, warn }) {
  return (
    <div className={`card tile ${warn ? 'tile-warn' : ''}`}>
      <div className="tile-label">
        <Icon name={icon} size={18} /> {label}
      </div>
      <div className="tile-value">
        {value ?? '–'}
        <small>{unit}</small>
      </div>
      {percent !== undefined && (
        <div className="bar">
          <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
        </div>
      )}
    </div>
  );
}

export default function Home({ onNavigate }) {
  const speed = useTopic('vehicle.speed');
  const rpm = useTopic('vehicle.rpm', 0);
  const coolant = useTopic('vehicle.coolant');
  const fuel = useTopic('vehicle.fuel');
  const locked = useTopic('vehicle.locked', false);
  const ambient = useTopic('ambient.state');

  return (
    <div className="home">
      <div className="card speed-card">
        <div className="speed-value">{speed ?? '–'}</div>
        <div className="speed-unit">km/h</div>
        <div className="rpm">
          <div className="rpm-track">
            <div
              className={`rpm-fill ${rpm >= RPM_RED ? 'red' : ''}`}
              style={{ width: `${Math.min(100, (rpm / RPM_MAX) * 100)}%` }}
            />
            <div className="rpm-redline" style={{ left: `${(RPM_RED / RPM_MAX) * 100}%` }} />
          </div>
          <div className="rpm-label">{rpm.toLocaleString()} rpm</div>
        </div>
      </div>

      <div className="home-side">
        <Gauge icon="thermo" label="Coolant" value={coolant} unit="°C" percent={((coolant ?? 0) / 120) * 100} warn={coolant > 110} />
        <Gauge icon="fuel" label="Fuel" value={fuel !== undefined ? Math.round(fuel) : undefined} unit="%" percent={fuel} warn={fuel < 12} />
      </div>

      <div className="quick-row">
        <button className="card quick" onClick={() => onNavigate('carplay')}>
          <Icon name="phone" size={30} />
          <span>CarPlay</span>
        </button>
        <button className="card quick" onClick={() => onNavigate('media')}>
          <Icon name="media" size={30} />
          <span>Media</span>
        </button>
        <button
          className={`card quick ${ambient?.on ? 'on' : ''}`}
          style={ambient?.on ? { '--glow': ambient.color } : undefined}
          onClick={() => command('ambient.set', { on: !ambient?.on }).catch(() => {})}
        >
          <Icon name="light" size={30} />
          <span>Ambient {ambient?.on ? 'on' : 'off'}</span>
        </button>
        <button className="card quick" onClick={() => command('body.lock', { locked: !locked }).catch(() => {})}>
          <Icon name={locked ? 'lock' : 'unlock'} size={30} />
          <span>{locked ? 'Locked' : 'Unlocked'}</span>
        </button>
      </div>
    </div>
  );
}
