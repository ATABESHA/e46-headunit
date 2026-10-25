import { useState } from 'react';
import { command, useConnected, useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';
import { CameraView, useCameras } from '../camera.jsx';
import { usePref } from '../prefs.js';
import { THEMES, useTheme } from '../theme.js';
import { Stepper } from '../widgets.jsx';
import SoftwareUpdate from './SoftwareUpdate.jsx';

const SECTIONS = [
  ['sound', 'Sound', 'sound'],
  ['display', 'Display', 'display'],
  ['camera', 'Camera', 'camera'],
  ['connections', 'Connections', 'link'],
  ['update', 'Software update', 'update'],
  ['simulator', 'Simulator', 'simulator'],
  ['about', 'About', 'info'],
];

function Toggle({ label, value, onChange, note }) {
  return (
    <div className="setting-row">
      <span>
        {label}
        {note && <small className="muted">{note}</small>}
      </span>
      <button className={`switch ${value ? 'on' : ''}`} onClick={() => onChange(!value)} aria-pressed={value}>
        <i />
      </button>
    </div>
  );
}

function Choice({ label, value, options, onChange }) {
  return (
    <div className="setting-row">
      <span>{label}</span>
      <div className="segmented">
        {options.map(([id, text]) => (
          <button key={id} className={value === id ? 'active' : ''} onClick={() => onChange(id)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Sound() {
  const volume = useTopic('audio.volume');
  const sound = useTopic('audio.sound', { bass: 0, mid: 0, treble: 0, balance: 0 });
  const set = (patch) => command('audio.setSound', patch).catch(() => {});
  return (
    <div className="settings-body">
      <Stepper
        label="Volume"
        min={0}
        max={100}
        value={volume?.level ?? 0}
        onChange={(level) => command('audio.setVolume', { level }).catch(() => {})}
        note={volume && !volume.available ? 'System volume not available on this computer' : null}
      />
      <Stepper label="Bass" value={sound.bass} onChange={(bass) => set({ bass })} />
      <Stepper label="Mid" value={sound.mid} onChange={(mid) => set({ mid })} />
      <Stepper label="Treble" value={sound.treble} onChange={(treble) => set({ treble })} />
      <Stepper label="Balance" value={sound.balance} onChange={(balance) => set({ balance })} left="L" right="R" />
      <Stepper label="Fader" value={0} onChange={() => {}} left="Rear" right="Front" disabled note="Needs a 4-channel USB sound card (front and rear speakers)" />
      <p className="muted small">Bass, mid, treble and balance apply to Radio and Media. Volume applies to everything.</p>
    </div>
  );
}

function Display() {
  const [theme, setTheme] = useTheme();
  const [mode, setMode] = usePref('screen.mode', 'fit');
  const [clock24, setClock24] = usePref('clock24', true);
  return (
    <div className="settings-body">
      <div className="theme-grid">
        {THEMES.map((t) => (
          <button key={t.id} className={`theme-option ${theme === t.id ? 'active' : ''}`} onClick={() => setTheme(t.id)}>
            <span className="theme-preview" style={{ background: t.swatch[0] }}>
              <span style={{ background: t.swatch[1] }} />
            </span>
            <strong>{t.name}</strong>
            <small>{t.description}</small>
          </button>
        ))}
      </div>
      <Choice
        label="Screen size"
        value={mode}
        onChange={setMode}
        options={[
          ['fit', '1082×480 (Ibiza)'],
          ['800', '800×480'],
          ['fill', 'Fill window'],
        ]}
      />
      <Toggle label="24-hour clock" value={clock24} onChange={setClock24} />
    </div>
  );
}

function Camera() {
  const cameras = useCameras();
  const [deviceId, setDeviceId] = usePref('camera.device', '');
  const [mirror, setMirror] = usePref('camera.mirror', false);
  const [auto, setAuto] = usePref('parking.auto', true);
  return (
    <div className="settings-body camera-settings">
      <CameraView className="camera-preview" />
      <div>
        <div className="setting-row column">
          <span>Reverse camera</span>
          <div className="camera-list">
            {cameras.map((c) => (
              <button key={c.id} className={`list-row ${(deviceId || cameras[0]?.id) === c.id ? 'active' : ''}`} onClick={() => setDeviceId(c.id)}>
                <Icon name="camera" size={18} />
                <span className="list-main">
                  <strong>{c.label}</strong>
                </span>
              </button>
            ))}
            {!cameras.length && <small className="muted">No camera found</small>}
          </div>
        </div>
        <Toggle label="Mirror picture" value={mirror} onChange={setMirror} note="Most reverse cameras are already mirrored" />
        <Toggle label="Open parking view in reverse" value={auto} onChange={setAuto} />
      </div>
    </div>
  );
}

function Connections() {
  const carplay = useTopic('carplay.state');
  const phone = useTopic('phone.state');
  const connected = useConnected();
  const rows = [
    ['Core service', connected ? 'Connected' : 'Not connected', connected],
    ['Full Link adapter', carplay ? { connected: `Connected · ${carplay.phone}`, 'waiting-phone': 'Ready, no phone', 'no-adapter': 'Not plugged in', starting: 'Starting…', error: 'Problem' }[carplay.status] : '–', carplay?.status === 'connected' || carplay?.status === 'waiting-phone'],
    ['Phone (Bluetooth)', phone?.connection === 'connected' ? `${phone.device}` : 'Not connected', phone?.connection === 'connected'],
  ];
  return (
    <div className="settings-body">
      {rows.map(([label, value, ok]) => (
        <div key={label} className="setting-row">
          <span>{label}</span>
          <span className={ok ? 'text-good' : 'muted'}>{value}</span>
        </div>
      ))}
      {carplay?.message && <p className="notice">{carplay.message}</p>}
      <div className="button-row">
        <button className="btn" onClick={() => command('carplay.restart').catch(() => {})}>
          Restart Full Link adapter
        </button>
      </div>
    </div>
  );
}

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

function Simulator() {
  const scenario = useTopic('sim.scenario');
  const doors = useTopic('vehicle.doors', {});
  if (scenario === undefined) return <div className="settings-body muted">Simulator is switched off.</div>;
  return (
    <div className="settings-body">
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
            {label}
          </button>
        ))}
      </div>
      <div className="button-row">
        <button className="btn" onClick={() => command('sim.incomingCall', {}).catch(() => {})}>
          <Icon name="call" size={18} /> Simulate incoming call
        </button>
      </div>
    </div>
  );
}

function About() {
  const version = useTopic('system.version');
  return (
    <div className="settings-body">
      <div className="setting-row">
        <span>Software version</span>
        <span>{version?.commit ?? '–'}</span>
      </div>
      <div className="setting-row">
        <span>Screen design</span>
        <span>1082 × 480 (8.25" Media System layout)</span>
      </div>
      <div className="setting-row">
        <span>Full Link</span>
        <span>node-carplay (open source)</span>
      </div>
      <div className="setting-row">
        <span>Radio directory</span>
        <span>radio-browser.info</span>
      </div>
      <p className="muted small">Quit the app: Ctrl + Shift + Q</p>
    </div>
  );
}

export default function Settings() {
  const [section, setSection] = useState('sound');
  const update = useTopic('system.update');
  const Body = { sound: Sound, display: Display, camera: Camera, connections: Connections, update: SoftwareUpdate, simulator: Simulator, about: About }[section];
  return (
    <div className="settings-layout">
      <div className="settings-menu">
        {SECTIONS.map(([id, label, icon]) => (
          <button key={id} className={`settings-item ${section === id ? 'active' : ''}`} onClick={() => setSection(id)}>
            <Icon name={icon} size={20} />
            {label}
            {id === 'update' && update?.status === 'available' && <i className="dot" />}
          </button>
        ))}
      </div>
      <div className="settings-content">
        <Body />
      </div>
    </div>
  );
}
