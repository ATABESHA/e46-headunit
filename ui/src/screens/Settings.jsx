import { useEffect, useState } from 'react';
import { command, useConnected, useTopic } from '../hub.js';
import { THEMES, useTheme } from '../theme.js';

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
const RELOAD_SECONDS = 3;

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

function Appearance() {
  const [theme, setTheme] = useTheme();
  return (
    <div className="card">
      <h2>Appearance</h2>
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
    </div>
  );
}

function SoftwareUpdate() {
  const connected = useConnected();
  const version = useTopic('system.version');
  const update = useTopic('system.update');
  const [reloadIn, setReloadIn] = useState(null);

  // After a successful update the screen reloads itself to show the new version.
  useEffect(() => {
    if (reloadIn === null) return undefined;
    if (reloadIn <= 0) {
      window.location.reload();
      return undefined;
    }
    const timer = setTimeout(() => setReloadIn(reloadIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [reloadIn]);

  if (!update) {
    return (
      <div className="card">
        <h2>Software update</h2>
        <p className="muted">Updater not running.</p>
      </div>
    );
  }

  const busy = update.status === 'checking' || update.status === 'updating';

  const apply = () =>
    command('system.update.apply')
      .then((result) => {
        if (result?.status === 'done' && !result.needsTerminal && !result.restartApp) setReloadIn(RELOAD_SECONDS);
      })
      .catch(() => {}); // The error is shown from system.update.

  let statusText;
  switch (update.status) {
    case 'checking':
      statusText = 'Checking GitHub…';
      break;
    case 'up-to-date':
      statusText = 'You have the newest version.';
      break;
    case 'available':
      statusText = `${update.behind} new change(s) available.`;
      break;
    case 'updating':
      statusText = update.message ?? 'Updating…';
      break;
    case 'done':
      statusText = update.message ?? 'Updated.';
      break;
    case 'error':
      statusText = null;
      break;
    default:
      statusText = 'Not checked yet.';
  }

  return (
    <div className="card">
      <h2>Software update</h2>

      <div className="kv">
        <span>Installed version</span>
        <span className="version">
          {version?.commit ? (
            <>
              <code>{version.commit}</code> · {formatDate(version.date)}
            </>
          ) : (
            '–'
          )}
        </span>
      </div>
      {version?.message && <p className="muted version-message">{version.message}</p>}

      {statusText && <div className={`update-status ${update.status}`}>{statusText}</div>}
      {update.status !== 'error' && update.message && update.status === 'available' && <div className="notice">{update.message}</div>}
      {update.status === 'error' && <div className="notice error-notice">{update.message}</div>}

      {update.commits?.length > 0 && (
        <ul className="changes">
          {update.commits.map((c) => (
            <li key={c.hash}>
              <span>{c.message}</span>
              <small>{formatDate(c.date)}</small>
            </li>
          ))}
        </ul>
      )}

      {update.needsTerminal && (
        <div className="notice">
          One more step is needed in Terminal:
          <code className="block">{update.needsTerminal}</code>
        </div>
      )}
      {update.restartApp && <div className="notice">Close the app (Ctrl+Shift+Q) and open it again to finish.</div>}
      {reloadIn !== null && <div className="notice">Restarting the screen in {reloadIn}…</div>}

      <div className="button-row update-buttons">
        <button className="btn" disabled={!connected || busy} onClick={() => command('system.update.check').catch(() => {})}>
          {update.status === 'checking' ? 'Checking…' : 'Check for updates'}
        </button>
        {update.status === 'available' && (
          <button className="btn primary" disabled={!connected || busy} onClick={apply}>
            Update now
          </button>
        )}
      </div>
      {update.checkedAt && <p className="muted small">Last checked {formatDate(update.checkedAt)}</p>}
    </div>
  );
}

export default function Settings() {
  const connected = useConnected();
  const scenario = useTopic('sim.scenario');
  const doors = useTopic('vehicle.doors', {});

  return (
    <div className="settings">
      <h1>Settings</h1>

      <Appearance />
      <SoftwareUpdate />

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

      <div className="card">
        <h2>System</h2>
        <div className="kv">
          <span>Core service</span>
          <span className={connected ? 'text-good' : 'text-bad'}>{connected ? 'Connected' : 'Not connected'}</span>
        </div>
      </div>
    </div>
  );
}
