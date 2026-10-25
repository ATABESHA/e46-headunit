import { useEffect, useState } from 'react';
import { command, useConnected, useTopic } from '../hub.js';

const RELOAD_SECONDS = 3;

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export default function SoftwareUpdate() {
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
