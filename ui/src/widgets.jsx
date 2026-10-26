import { useEffect, useRef, useState } from 'react';
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

/**
 * Upright slider made for fingers.
 * - The whole column (not just the thin line) can be grabbed.
 * - Dragging moves the value from where it was (no jump when you grab it);
 *   a tap without moving sets the value at that spot.
 * - A sideways swipe is left to the strip around it (touch-action: pan-x),
 *   so swiping through the mixer never changes a slider by accident.
 * - − / + buttons for exact single steps.
 */
export function FingerSlider({ label, value, min = -10, max = 10, step = 1, onChange, format, height = 150 }) {
  const trackRef = useRef(null);
  const drag = useRef(null);
  const [live, setLive] = useState(null);
  const shown = live ?? value ?? 0;
  const clamp = (v) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const pct = (v) => (v - min) / (max - min);
  const from = min < 0 ? pct(0) : 0; // ± sliders fill from the middle
  const text = format ? format(shown) : `${min < 0 && shown > 0 ? '+' : ''}${shown}`;

  const commit = (v) => {
    setLive(v);
    if (v !== value) onChange(v);
  };

  const onPointerDown = (e) => {
    drag.current = { y: e.clientY, start: value ?? 0, moved: false, h: trackRef.current.getBoundingClientRect().height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dy) < 6) return; // finger wobble
    d.moved = true;
    commit(clamp(d.start - (dy / d.h) * (max - min)));
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      const r = trackRef.current.getBoundingClientRect();
      commit(clamp(min + (1 - (e.clientY - r.top) / r.height) * (max - min)));
    }
    setLive(null);
  };
  const onPointerCancel = () => {
    // The browser took the touch for a sideways swipe: change nothing.
    drag.current = null;
    setLive(null);
  };

  const lo = Math.min(from, pct(shown));
  const hi = Math.max(from, pct(shown));
  return (
    <div className="finger-slider">
      <b>{text}</b>
      <button className="fs-step" onClick={() => onChange(clamp((value ?? 0) + step))} aria-label={`${label} up`}>
        <Icon name="plus" size={18} />
      </button>
      <div
        className={`fs-track ${live !== null ? 'active' : ''}`}
        style={{ height }}
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={shown}
      >
        <i className="fs-line" />
        {min < 0 && <i className="fs-zero" style={{ bottom: `${from * 100}%` }} />}
        <i className="fs-fill" style={{ bottom: `${lo * 100}%`, top: `${(1 - hi) * 100}%` }} />
        <i className="fs-thumb" style={{ bottom: `${pct(shown) * 100}%` }} />
      </div>
      <button className="fs-step" onClick={() => onChange(clamp((value ?? 0) - step))} aria-label={`${label} down`}>
        <Icon name="minus" size={18} />
      </button>
      <span>{label}</span>
    </div>
  );
}

/**
 * A row you swipe sideways (finger) or drag (mouse), stopping neatly on
 * each item, with dots showing where you are.
 */
export function SwipeStrip({ children, className = '' }) {
  const ref = useRef(null);
  const [page, setPage] = useState({ at: 0, pages: 1 });
  const mouse = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const update = () => {
      const pages = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.05));
      const at = Math.round((el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth)) * (pages - 1));
      setPage({ at: Number.isFinite(at) ? at : 0, pages });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  const goTo = (i) => {
    const el = ref.current;
    el.scrollTo({ left: (i / Math.max(1, page.pages - 1)) * (el.scrollWidth - el.clientWidth), behavior: 'smooth' });
  };

  return (
    <div className={`swipe-strip ${className}`}>
      <div
        className={`swipe-track ${page.at > 0 ? 'more-left' : ''} ${page.at < page.pages - 1 ? 'more-right' : ''}`}
        ref={ref}
        onPointerDown={(e) => {
          // Mouse on a computer: drag the empty space to scroll (fingers scroll by themselves).
          if (e.pointerType !== 'mouse' || e.target.closest('.fs-track, button')) return;
          mouse.current = { x: e.clientX, left: ref.current.scrollLeft };
        }}
        onPointerMove={(e) => {
          if (mouse.current) ref.current.scrollLeft = mouse.current.left - (e.clientX - mouse.current.x);
        }}
        onPointerUp={() => (mouse.current = null)}
        onPointerLeave={() => (mouse.current = null)}
      >
        {children}
      </div>
      {page.pages > 1 && (
        <div className="swipe-dots">
          {Array.from({ length: page.pages }, (_, i) => (
            <button key={i} className={i === page.at ? 'on' : ''} onClick={() => goTo(i)} aria-label={`Page ${i + 1}`} />
          ))}
        </div>
      )}
    </div>
  );
}
