import { command, useConnected, useTopic } from '../hub.js';

const SCENARIOS = [
  ['drive', 'Driving'],
  ['park', 'Reversing'],
  ['idle', 'Standing still'],
];
const DOORS = [
  ['fl', 'Front left'],
  ['fr', 'Front right'],
  ['rl', 'Rear left'],
  ['rr', 'Rear right'],
  ['trunk', 'Trunk'],
];

export default function Settings() {
  const connected = useConnected();
  const scenario = useTopic('sim.scenario');
  const doors = useTopic('vehicle.doors', {});

  return (
    <div className="settings">
      <h1>Settings</h1>

      <div className="card">
        <h2>System</h2>
        <div className="kv">
          <span>Core service</span>
          <span className={connected ? 'text-good' : 'text-bad'}>{connected ? 'Connected' : 'Not connected'}</span>
        </div>
        <div className="kv">
          <span>Version</span>
          <span>0.1.0</span>
        </div>
      </div>

      {scenario !== undefined && (
        <div className="card">
          <h2>Simulator</h2>
          <p className="muted">Fake car data for testing without the car.</p>
          <div className="segmented">
            {SCENARIOS.map(([id, label]) => (
              <button key={id} className={scenario === id ? 'active' : ''} onClick={() => command('sim.scenario', id).catch(() => {})}>
                {label}
              </button>
            ))}
          </div>
          <div className="segmented wrap">
            {DOORS.map(([id, label]) => (
              <button key={id} className={doors[id] ? 'active warn' : ''} onClick={() => command('sim.door', { door: id, open: !doors[id] }).catch(() => {})}>
                {label} {doors[id] ? 'open' : 'closed'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
