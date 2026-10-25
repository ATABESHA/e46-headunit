import { useState } from 'react';
import { Icon } from './icons.jsx';

/** Row of tabs at the top of a screen. */
export function Tabs({ tabs, value, onChange, children }) {
  return (
    <div className="tabs-bar">
      <div className="tabs">
        {tabs.map(([id, label, icon]) => (
          <button key={id} className={`tab ${value === id ? 'active' : ''}`} onClick={() => onChange(id)}>
            {icon && <Icon name={icon} size={18} />}
            {label}
          </button>
        ))}
      </div>
      {children && <div className="tabs-extra">{children}</div>}
    </div>
  );
}

const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/** On-screen keyboard for the touch screen (search fields). */
export function Keyboard({ value, onChange, onDone, doneLabel = 'Search' }) {
  const [shift, setShift] = useState(false);
  const type = (ch) => onChange(value + (shift ? ch.toUpperCase() : ch));
  return (
    <div className="keyboard">
      {ROWS.map((row) => (
        <div key={row} className="kb-row">
          {[...row].map((ch) => (
            <button key={ch} onClick={() => type(ch)}>
              {shift ? ch.toUpperCase() : ch}
            </button>
          ))}
        </div>
      ))}
      <div className="kb-row">
        <button className={`kb-wide ${shift ? 'on' : ''}`} onClick={() => setShift(!shift)}>
          ⇧
        </button>
        <button className="kb-space" onClick={() => onChange(`${value} `)}>
          space
        </button>
        <button className="kb-wide" onClick={() => onChange(value.slice(0, -1))} aria-label="Delete">
          <Icon name="backspace" size={20} />
        </button>
        <button className="kb-wide kb-done" onClick={onDone}>
          {doneLabel}
        </button>
      </div>
    </div>
  );
}

/** -10..+10 control with − / + buttons and a slider. */
export function Stepper({ label, value, onChange, min = -10, max = 10, left, right, disabled, note }) {
  return (
    <div className={`stepper ${disabled ? 'disabled' : ''}`}>
      <div className="stepper-head">
        <span>{label}</span>
        <strong>{value > 0 && min < 0 ? `+${value}` : value}</strong>
      </div>
      <div className="stepper-row">
        <button className="icon-btn small" disabled={disabled || value <= min} onClick={() => onChange(value - 1)} aria-label="Less">
          <Icon name="minus" size={18} />
        </button>
        {left && <small>{left}</small>}
        <input type="range" min={min} max={max} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
        {right && <small>{right}</small>}
        <button className="icon-btn small" disabled={disabled || value >= max} onClick={() => onChange(value + 1)} aria-label="More">
          <Icon name="plus" size={18} />
        </button>
      </div>
      {note && <small className="muted">{note}</small>}
    </div>
  );
}

/** Station logo, album art or a fallback icon. */
export function Artwork({ src, icon = 'media', className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`artwork empty ${className}`}>
        <Icon name={icon} size={40} />
      </div>
    );
  }
  return <img className={`artwork ${className}`} src={src} alt="" onError={() => setFailed(true)} />;
}
