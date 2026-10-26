import { useState } from 'react';
import { command, useConnected, useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';
import { CameraView, useCameras } from '../camera.jsx';
import { usePref } from '../prefs.js';
import { CLUSTER_FACES, DRIVE_MODES, HOME_LAYOUTS, LOCKED_THEME, THEMES, themeInfo, useClusterFace, useDesignButtons, useDriveMode, useHomeLayout, useTheme } from '../theme.js';
import { Lamp, LAMP_NAMES } from '../cluster/Lamps.jsx';
import { PAINTS, usePaint } from '../CarArt.jsx';
import { CLUSTER_ENABLED, useSwapButton } from '../view.js';
import { FX_LEVELS, useFx } from '../fx.jsx';
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

function Choice({ label, value, options, onChange, wide = false }) {
  return (
    <div className={`setting-row ${wide ? 'column' : ''}`}>
      <span>{label}</span>
      <div className={`segmented ${wide ? 'wrap' : ''}`}>
        {options.map(([id, text]) => (
          <button key={id} className={value === id ? 'active' : ''} onClick={() => onChange(id)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

const EQ_PRESETS = [
  ['Flat', { bass: 0, mid: 0, treble: 0 }],
  ['Bass', { bass: 6, mid: 0, treble: 1 }],
  ['Vocal', { bass: -2, mid: 4, treble: 2 }],
  ['Bright', { bass: 0, mid: 1, treble: 5 }],
  ['Night', { bass: 3, mid: -1, treble: -3 }],
];

// Speaker spots on the top-view photo (% of the picture), nose at the top.
const SPEAKERS = [
  ['fl', 'Front left', 11, 37],
  ['fr', 'Front right', 89, 37],
  ['rl', 'Rear left', 11, 66],
  ['rr', 'Rear right', 89, 66],
];
const FOCUS = { x0: 18, x1: 82, front: 40, rear: 66 }; // where the sound point can go

/** Slider standing up, -10..+10 (or 0..100 for volume). */
function MixerSlider({ label, value, min = -10, max = 10, onChange, unit = '' }) {
  return (
    <label className="mixer-slider">
      <b>
        {value > 0 && min < 0 ? '+' : ''}
        {value}
        {unit}
      </b>
      <input type="range" min={min} max={max} step="1" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span>{label}</span>
    </label>
  );
}

/**
 * Where the sound is aimed: drag the point over the car. Left/right is the
 * balance, front/rear the fader (the fader needs a 4-channel sound card).
 */
function SoundStage({ balance, fader, onChange }) {
  const pos = {
    x: FOCUS.x0 + ((balance + 10) / 20) * (FOCUS.x1 - FOCUS.x0),
    y: FOCUS.rear - ((fader + 10) / 20) * (FOCUS.rear - FOCUS.front),
  };
  const gain = (id) => {
    const side = id[1] === 'l' ? Math.min(1, 1 - balance / 10) : Math.min(1, 1 + balance / 10);
    const end = id[0] === 'f' ? Math.min(1, 1 + fader / 10) : Math.min(1, 1 - fader / 10);
    return side * end;
  };
  const moveTo = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 100;
    const py = ((e.clientY - r.top) / r.height) * 100;
    const b = Math.round(((Math.min(FOCUS.x1, Math.max(FOCUS.x0, px)) - FOCUS.x0) / (FOCUS.x1 - FOCUS.x0)) * 20 - 10);
    const f = Math.round(((FOCUS.rear - Math.min(FOCUS.rear, Math.max(FOCUS.front, py))) / (FOCUS.rear - FOCUS.front)) * 20 - 10);
    if (b !== balance || f !== fader) onChange({ balance: b, fader: f });
  };
  return (
    <div className="sound-stage">
      <div
        className="sound-car"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moveTo(e);
        }}
        onPointerMove={(e) => e.buttons && moveTo(e)}
      >
        <img src="./car/top-interior.jpg" alt="" draggable="false" />
        <div className="sound-zone" style={{ left: `${FOCUS.x0}%`, right: `${100 - FOCUS.x1}%`, top: `${FOCUS.front}%`, bottom: `${100 - FOCUS.rear}%` }} />
        {SPEAKERS.map(([id, name, x, y]) => (
          <span key={id} className="speaker" style={{ left: `${x}%`, top: `${y}%`, '--gain': gain(id) }} title={name}>
            <i />
          </span>
        ))}
        <span className="sound-focus" style={{ left: `${pos.x}%`, top: `${pos.y}%` }} />
      </div>
      <div className="sound-readout">
        <span>
          <small>Balance</small>
          {balance === 0 ? 'Centre' : `${balance < 0 ? 'L' : 'R'} ${Math.abs(balance)}`}
        </span>
        <span>
          <small>Fader</small>
          {fader === 0 ? 'Centre' : `${fader > 0 ? 'Front' : 'Rear'} ${Math.abs(fader)}`}
        </span>
        <button className="btn small" onClick={() => onChange({ balance: 0, fader: 0 })} disabled={!balance && !fader}>
          Centre
        </button>
      </div>
    </div>
  );
}

function Sound() {
  const volume = useTopic('audio.volume');
  const sound = { bass: 0, mid: 0, treble: 0, balance: 0, fader: 0, ...useTopic('audio.sound', {}) };
  const set = (patch) => command('audio.setSound', patch).catch(() => {});
  const preset = EQ_PRESETS.find(([, p]) => p.bass === sound.bass && p.mid === sound.mid && p.treble === sound.treble)?.[0];
  return (
    <div className="settings-body sound-body">
      <SoundStage balance={sound.balance} fader={sound.fader} onChange={set} />
      <div className="mixer">
        <div className="mixer-sliders">
          <MixerSlider label="Volume" min={0} max={100} value={volume?.level ?? 0} onChange={(level) => command('audio.setVolume', { level }).catch(() => {})} />
          <i className="mixer-gap" />
          <MixerSlider label="Bass" value={sound.bass} onChange={(bass) => set({ bass })} />
          <MixerSlider label="Mid" value={sound.mid} onChange={(mid) => set({ mid })} />
          <MixerSlider label="Treble" value={sound.treble} onChange={(treble) => set({ treble })} />
        </div>
        <div className="chips">
          {EQ_PRESETS.map(([name, values]) => (
            <button key={name} className={`chip ${preset === name ? 'on' : ''}`} onClick={() => set(values)}>
              {name}
            </button>
          ))}
        </div>
        <p className="muted small">
          Drag the point on the car to move the sound. Front / rear needs a 4-channel USB sound card; it is saved for then.
          {volume && !volume.available ? ' System volume is not available on this computer.' : ''}
        </p>
      </div>
    </div>
  );
}

function Display() {
  const [theme, setTheme] = useTheme();
  const [mode, setMode] = usePref('screen.mode', 'fit');
  const [clock24, setClock24] = usePref('clock24', true);
  const [fx, setFx] = useFx();
  const [hud, setHud] = usePref('fx.hud', false);
  const [, face, setFace] = useClusterFace();
  const [, home, setHome] = useHomeLayout();
  const [[paint], setPaint] = usePaint();
  const [swapButton, setSwapButton] = useSwapButton();
  const [designButtons, setDesignButtons] = useDesignButtons();
  const [drive, setDrive] = useDriveMode();
  return (
    <div className="settings-body">
      {LOCKED_THEME ? (
        <div className="setting-row">
          <span>
            Style
            <small className="muted">Fixed while we work on this design (LOCKED_THEME in src/theme.js)</small>
          </span>
          <strong>{themeInfo(theme).name}</strong>
        </div>
      ) : (
        <>
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
          <Choice label="Cluster" value={face} onChange={setFace} options={CLUSTER_FACES} wide />
          <Choice label="Home screen" value={home} onChange={setHome} options={HOME_LAYOUTS} wide />
          <Choice label="Drive mode colours" value={drive} onChange={setDrive} options={DRIVE_MODES} />
          <Toggle label="Design buttons" value={designButtons} onChange={setDesignButtons} note="Temporary: “Style” on the home screen and “Design” + “Light test” on the cluster" />
          <div className="setting-row column">
            <span>Car colour</span>
            <div className="paint-row">
              {PAINTS.map(([id, name, color]) => (
                <button key={id} className={`paint ${paint === id ? 'active' : ''}`} onClick={() => setPaint(id)} title={name}>
                  <i style={{ background: color }} />
                  <small>{name}</small>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {CLUSTER_ENABLED && (
        <Toggle label="Swap screens button" value={swapButton} onChange={setSwapButton} note="In the status bar: shows the cluster on this screen when there is only one" />
      )}
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
      <Choice label="Graphics" value={fx} onChange={setFx} options={FX_LEVELS} />
      <Toggle label="Performance display" value={hud} onChange={setHud} note="FPS, CPU, RAM and graphics chip, on both screens" />
      {fx === 'ultra' && <p className="muted small">Ultra is a stress test: every effect at maximum, to see what the computer can handle.</p>}
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

const KEY = [
  ['off', 'Key off'],
  ['acc', 'Accessory'],
  ['run', 'Engine on'],
];

function Simulator() {
  const scenario = useTopic('sim.scenario');
  const ignition = useTopic('vehicle.ignition');
  const doors = useTopic('vehicle.doors', {});
  if (scenario === undefined) return <div className="settings-body muted">Simulator is switched off.</div>;
  return (
    <div className="settings-body">
      <p className="muted">Fake car data for testing without the car.</p>
      <div className="segmented">
        {KEY.map(([id, label]) => (
          <button key={id} className={ignition === id ? 'active' : ''} onClick={() => command('sim.ignition', id).catch(() => {})}>
            {label}
          </button>
        ))}
      </div>
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
      <div className="setting-row">
        <span>
          Tyres
          <small className="muted">Slow puncture on one wheel, or pump all up again</small>
        </span>
        <div className="button-row">
          {['fl', 'fr', 'rl', 'rr'].map((w) => (
            <button key={w} className="btn small" onClick={() => command('sim.tireLeak', { wheel: w, on: true }).catch(() => {})}>
              {w.toUpperCase()}
            </button>
          ))}
          <button className="btn small primary" onClick={() => command('sim.tireInflate').catch(() => {})}>
            Inflate all
          </button>
        </div>
      </div>
      <LightTest />
    </div>
  );
}

/** Switch any cluster light on by hand, or all of them at once. */
function LightTest() {
  const forced = useTopic('sim.lampsForced', {});
  const lamps = useTopic('vehicle.lamps', {});
  const anyOn = Object.values(forced).some(Boolean);
  return (
    <div className="light-test">
      <div className="setting-row">
        <span>
          Cluster lights
          <small className="muted">Tap a light to switch it on. Lights the car turns on itself (doors, low fuel…) stay lit.</small>
        </span>
        <div className="button-row">
          <button className="btn primary" onClick={() => command('sim.lampsAll', { on: true }).catch(() => {})}>
            All on
          </button>
          <button className="btn" disabled={!anyOn} onClick={() => command('sim.lampsAll', { on: false }).catch(() => {})}>
            All off
          </button>
        </div>
      </div>
      <div className="light-grid">
        {Object.entries(LAMP_NAMES).map(([name, label]) => (
          <button key={name} className={forced[name] ? 'active' : ''} onClick={() => command('sim.lamp', { name, on: !forced[name] }).catch(() => {})}>
            <Lamp name={name} on={lamps[name]} />
            <small>{label}</small>
          </button>
        ))}
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
