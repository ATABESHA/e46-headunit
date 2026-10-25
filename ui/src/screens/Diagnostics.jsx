import { useEffect, useState } from 'react';
import { command, useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';

export default function Diagnostics() {
  const codes = useTopic('diag.codes', []);
  const scanning = useTopic('diag.scanning', false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState(null);

  // The "Clear" button needs a second tap within 4 seconds.
  useEffect(() => {
    if (!confirmClear) return undefined;
    const timer = setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmClear]);

  const scan = () => {
    setMessage(null);
    command('diag.scan')
      .then((count) => setMessage(typeof count === 'number' ? `Scan finished: ${count} code(s)` : null))
      .catch((err) => setMessage(err.message));
  };

  const clear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    command('diag.clear', {})
      .then((left) => setMessage(left ? `${left} active fault(s) came back - these need fixing` : 'All codes cleared'))
      .catch((err) => setMessage(err.message));
  };

  const byModule = codes.reduce((groups, c) => {
    (groups[c.module] ??= []).push(c);
    return groups;
  }, {});

  return (
    <div className="diag">
      <div className="card-head">
        <h1>Fault codes</h1>
        <div className="button-row">
          <button className="btn primary" onClick={scan} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Scan car'}
          </button>
          <button className={`btn ${confirmClear ? 'danger' : ''}`} onClick={clear} disabled={scanning || codes.length === 0}>
            {confirmClear ? 'Tap again to clear' : 'Clear codes'}
          </button>
        </div>
      </div>
      {message && <div className="notice">{message}</div>}

      {codes.length === 0 ? (
        <div className="card empty">
          <Icon name="wrench" size={40} />
          <p>No fault codes stored</p>
        </div>
      ) : (
        <div className="diag-list">
          {Object.entries(byModule).map(([module, list]) => (
            <div key={module} className="card">
              <h2>{module}</h2>
              {list.map((c) => (
                <div key={c.code} className="code-row">
                  <span className="code">{c.code}</span>
                  <span className="code-text">{c.text}</span>
                  <span className={`badge ${c.status === 'active' ? 'bad' : ''}`}>{c.status}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
