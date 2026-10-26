import { useState } from 'react';
import { useResizable } from '../resize.jsx';
import { command, useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';
import { Tabs } from '../widgets.jsx';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
const DIRECTION = { in: ['call', 'Incoming'], out: ['call', 'Outgoing'], missed: ['warning', 'Missed'] };

const when = (at) => {
  const d = new Date(at);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

export default function Phone() {
  const rs = useResizable('phone', { minLeft: 250, minRight: 360 });
  const state = useTopic('phone.state');
  const contacts = useTopic('phone.contacts', []);
  const history = useTopic('phone.history', []);
  const [tab, setTab] = useState('contacts');
  const [number, setNumber] = useState('');
  const [error, setError] = useState(null);
  const connected = state?.connection === 'connected';

  const dial = (n) => {
    setError(null);
    command('phone.dial', { number: n }).catch((err) => setError(err.message));
  };

  return (
    <div className={`split ${rs.className}`} ref={rs.ref} style={rs.style}>
      <section className="panel phone-status">
        <div className={`phone-icon ${connected ? 'ok' : ''}`}>
          <Icon name="phone" size={40} />
        </div>
        <strong className="np-title">{connected ? state.device : 'No phone connected'}</strong>
        {connected && (
          <div className="phone-meta">
            <span>
              <Icon name="signal" size={16} /> {state.signal}/5
            </span>
            <span className="battery big">
              <i style={{ width: `${state.battery}%` }} />
            </span>
            <span>{state.battery}%</span>
          </div>
        )}
        {state?.simulated && <span className="badge">Simulated - real calls work through Full Link</span>}
        <button className="btn" onClick={() => command(connected ? 'phone.disconnect' : 'phone.connect').catch(() => {})}>
          <Icon name="bluetooth" size={18} /> {connected ? 'Disconnect' : 'Connect'}
        </button>
        {error && <small className="error center">{error}</small>}
      </section>

      <section className="panel browse">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            ['contacts', 'Contacts', 'contacts'],
            ['recent', 'Recent', 'history'],
            ['keypad', 'Keypad', 'dialpad'],
          ]}
        />

        {!connected && tab !== 'keypad' && <div className="empty-state">Connect a phone to see contacts and calls</div>}

        {connected && tab === 'contacts' && (
          <div className="list">
            {contacts.map((c) => (
              <button key={c.id} className="list-row" onClick={() => dial(c.numbers[0].number)}>
                <span className="avatar">{c.name.slice(0, 1)}</span>
                <span className="list-main">
                  <strong>{c.name}</strong>
                  <small>
                    {c.numbers[0].label} · {c.numbers[0].number}
                  </small>
                </span>
                <Icon name="call" size={20} />
              </button>
            ))}
          </div>
        )}

        {connected && tab === 'recent' && (
          <div className="list">
            {history.map((h) => {
              const [icon, label] = DIRECTION[h.direction];
              return (
                <button key={h.id} className={`list-row ${h.direction === 'missed' ? 'missed' : ''}`} onClick={() => dial(h.number)}>
                  <Icon name={icon} size={20} />
                  <span className="list-main">
                    <strong>{h.name ?? h.number}</strong>
                    <small>
                      {label} · {h.number}
                    </small>
                  </span>
                  <small className="muted">{when(h.at)}</small>
                </button>
              );
            })}
            {!history.length && <div className="empty-state">No calls yet</div>}
          </div>
        )}

        {tab === 'keypad' && (
          <div className="keypad-wrap">
            <div className="dial-display">
              <span>{number || <em>Enter number</em>}</span>
              <button className="icon-btn small" onClick={() => setNumber(number.slice(0, -1))} disabled={!number} aria-label="Delete">
                <Icon name="backspace" size={20} />
              </button>
            </div>
            <div className="keypad">
              {KEYS.map((k) => (
                <button key={k} onClick={() => setNumber((n) => (n.length < 20 ? n + k : n))}>
                  {k}
                </button>
              ))}
            </div>
            <button className="call-btn" disabled={!connected || !number} onClick={() => dial(number)}>
              <Icon name="call" /> Call
            </button>
          </div>
        )}
      </section>
      {rs.handle}
    </div>
  );
}
