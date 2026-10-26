import { useEffect, useState } from 'react';
import { command, useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';

const COLORS = ['#ff7a1a', '#ff2d2d', '#ffffff', '#2d7bff', '#00d1ff', '#7a3cff', '#ff3cc7', '#3fe07a'];

const LIGHTS = [
  ['parking', 'Parking'],
  ['low', 'Low beam'],
  ['high', 'High beam'],
  ['fogFront', 'Front fog'],
  ['fogRear', 'Rear fog'],
];

// Top-down view of the car. Open doors turn red.
function CarDiagram({ doors }) {
  const part = (open) => (open ? 'door open' : 'door');
  return (
    <svg className="car-diagram" viewBox="0 0 200 360" role="img" aria-label="Doors">
      <rect className="car-body" x="40" y="20" width="120" height="320" rx="42" />
      <rect className="car-glass" x="56" y="78" width="88" height="54" rx="10" />
      <rect className="car-glass" x="56" y="236" width="88" height="40" rx="10" />
      <rect className={part(doors.fl)} x="30" y="112" width="12" height="64" rx="4" />
      <rect className={part(doors.fr)} x="158" y="112" width="12" height="64" rx="4" />
      <rect className={part(doors.rl)} x="30" y="184" width="12" height="56" rx="4" />
      <rect className={part(doors.rr)} x="158" y="184" width="12" height="56" rx="4" />
      <rect className={part(doors.trunk)} x="64" y="330" width="72" height="12" rx="4" />
    </svg>
  );
}

export function AmbientCard() {
  const ambient = useTopic('ambient.state');
  const [brightness, setBrightness] = useState(ambient?.brightness ?? 60);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (ambient) setBrightness(ambient.brightness);
  }, [ambient?.brightness]);

  const set = (value) => {
    setError(null);
    command('ambient.set', value).catch((err) => setError(err.message));
  };

  if (!ambient) return <div className="card">Ambient lighting not available</div>;

  return (
    <div className="card ambient" style={{ '--glow': ambient.on ? ambient.color : 'transparent' }}>
      <div className="ambient-photo" style={{ opacity: ambient.on ? 0.35 + (ambient.brightness / 100) * 0.65 : 0.25 }}>
        <img src="./car/front-fog.jpg" alt="" draggable="false" />
      </div>
      <div className="card-head">
        <h2>
          <Icon name="light" size={20} /> Ambient lighting
        </h2>
        <button className={`toggle ${ambient.on ? 'on' : ''}`} onClick={() => set({ on: !ambient.on })}>
          {ambient.on ? 'On' : 'Off'}
        </button>
      </div>
      <div className="swatches">
        {COLORS.map((c) => (
          <button
            key={c}
            className={`swatch ${ambient.color === c ? 'selected' : ''}`}
            style={{ background: c }}
            aria-label={`Color ${c}`}
            onClick={() => set({ color: c, on: true })}
          />
        ))}
        <label className="swatch swatch-custom" aria-label="Custom color">
          <input type="color" value={ambient.color} onChange={(e) => set({ color: e.target.value, on: true })} />
        </label>
      </div>
      <label className="slider">
        <span>Brightness {brightness}%</span>
        <input
          type="range"
          min="0"
          max="100"
          value={brightness}
          onChange={(e) => {
            setBrightness(Number(e.target.value));
            set({ brightness: Number(e.target.value) });
          }}
        />
      </label>
      {error && <div className="error">{error}</div>}
    </div>
  );
}

export function CarStatus() {
  const doors = useTopic('vehicle.doors', {});
  const locked = useTopic('vehicle.locked', false);
  const lights = useTopic('vehicle.lights', {});
  const openDoors = Object.entries(doors).filter(([, open]) => open).length;

  return (
    <div className="card car-card">
      <CarDiagram doors={doors} />
      <div className="car-info">
        <img className="status-photo" src="./car/side.jpg" alt="" draggable="false" />
        <div className={`big-status ${openDoors ? 'warn' : ''}`}>{openDoors ? `${openDoors} open` : 'All closed'}</div>
        <div className="button-row">
          <button className={`btn ${locked ? 'primary' : ''}`} onClick={() => command('body.lock', { locked: true }).catch(() => {})}>
            <Icon name="lock" /> Lock
          </button>
          <button className={`btn ${!locked ? 'primary' : ''}`} onClick={() => command('body.lock', { locked: false }).catch(() => {})}>
            <Icon name="unlock" /> Unlock
          </button>
        </div>
        <div className="chips">
          {LIGHTS.map(([key, label]) => (
            <span key={key} className={`chip ${lights[key] ? 'on' : ''}`}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
