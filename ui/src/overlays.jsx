import { useEffect, useRef, useState } from 'react';
import { command, useConnected, useTopic } from './hub.js';
import { Icon } from './icons.jsx';

/** Start-up screen with your logo, until the core service answers. */
export function Splash() {
  const connected = useConnected();
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!connected || !visible) return undefined;
    const t1 = setTimeout(() => setLeaving(true), 700);
    const t2 = setTimeout(() => setVisible(false), 1100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [connected, visible]);

  if (!visible) return null;
  return (
    <div className={`splash ${leaving ? 'leaving' : ''}`}>
      <img src="./logo.svg" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
      <div className="splash-bar">
        <i />
      </div>
      {!connected && <small>Starting…</small>}
    </div>
  );
}

/** Shows the volume for 2 seconds whenever it changes (keys, steering wheel, screen). */
export function VolumeOverlay() {
  const volume = useTopic('audio.volume');
  const [visible, setVisible] = useState(false);
  const first = useRef(true);
  const prev = useRef(null);

  useEffect(() => {
    if (!volume) return undefined;
    const key = `${volume.level}:${volume.muted}`;
    if (first.current || prev.current === key) {
      first.current = false;
      prev.current = key;
      return undefined;
    }
    prev.current = key;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(timer);
  }, [volume?.level, volume?.muted]);

  if (!visible || !volume) return null;
  return (
    <div className="volume-overlay">
      <Icon name={volume.muted ? 'mute' : 'sound'} size={26} />
      <div className="volume-track">
        <i style={{ width: `${volume.muted ? 0 : volume.level}%` }} />
      </div>
      <span>{volume.muted ? 'Muted' : volume.level}</span>
    </div>
  );
}

const LEVEL_ICON = { success: 'check', warning: 'warning', error: 'warning', info: 'info' };

/** Short messages: USB stick connected, phone disconnected, errors … */
export function Toasts() {
  const notice = useTopic('system.notice');
  const [items, setItems] = useState([]);
  const seen = useRef(null);

  useEffect(() => {
    if (!notice || notice.id === seen.current) return;
    const firstSeen = seen.current === null;
    seen.current = notice.id;
    if (firstSeen && Date.now() - notice.at > 3000) return; // don't replay an old message after a reload
    setItems((list) => [...list.slice(-2), notice]);
    setTimeout(() => setItems((list) => list.filter((n) => n.id !== notice.id)), 4000);
  }, [notice?.id]);

  return (
    <div className="toasts">
      {items.map((n) => (
        <div key={n.id} className={`toast ${n.level}`} onClick={() => setItems((list) => list.filter((x) => x.id !== n.id))}>
          <Icon name={LEVEL_ICON[n.level] ?? 'info'} size={20} />
          <span>{n.text}</span>
        </div>
      ))}
    </div>
  );
}

function useCallTimer(startedAt) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!startedAt) return undefined;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  if (!startedAt) return null;
  const s = Math.floor((Date.now() - startedAt) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Incoming, outgoing and active calls appear on top of every screen. */
export function CallOverlay({ onOpenPhone }) {
  const call = useTopic('phone.call');
  const duration = useCallTimer(call?.state === 'active' ? call.startedAt : null);
  if (!call) return null;

  const label = {
    incoming: 'Incoming call',
    outgoing: 'Calling…',
    active: duration ?? 'Connected',
    ended: 'Call ended',
    failed: 'Call failed',
  }[call.state];
  const run = (topic, value) => command(topic, value).catch(() => {});

  return (
    <div className={`call-overlay ${call.state}`}>
      <div className="call-avatar">
        <Icon name="contacts" size={34} />
      </div>
      <div className="call-info" onClick={onOpenPhone}>
        <strong>{call.name ?? call.number}</strong>
        {call.name && <span>{call.number}</span>}
        <em>{label}</em>
      </div>
      <div className="call-actions">
        {call.state === 'active' && (
          <button className={`round-btn ${call.muted ? 'on' : ''}`} onClick={() => run('phone.mute', { muted: !call.muted })} aria-label="Microphone">
            <Icon name={call.muted ? 'micoff' : 'mic'} />
          </button>
        )}
        {call.state === 'incoming' && (
          <button className="round-btn answer" onClick={() => run('phone.answer')} aria-label="Answer">
            <Icon name="call" />
          </button>
        )}
        {['incoming', 'outgoing', 'active'].includes(call.state) && (
          <button className="round-btn hangup" onClick={() => run(call.state === 'incoming' ? 'phone.reject' : 'phone.hangup')} aria-label="End call">
            <Icon name="endcall" />
          </button>
        )}
      </div>
    </div>
  );
}
