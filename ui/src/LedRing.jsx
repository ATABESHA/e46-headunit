import { arcPath } from './cluster/Dial.jsx';

/**
 * A ring of LED segments, lit up to `value` (0..1). Used by the Neon Cockpit
 * home and the Neon rings cluster. Angles: 0 = straight up, clockwise.
 * Colour: "orange" or "blue" (CSS .led-ring.orange / .blue).
 */
export default function LedRing({ size, value, color = 'orange', segments = 48, from = -135, to = 135, width = 10, children, className = '', style }) {
  const c = size / 2;
  const r = c - width;
  const step = (to - from) / segments;
  const lit = Math.round(Math.min(1, Math.max(0, value ?? 0)) * segments);
  return (
    <div className={`led-ring ${color} ${className}`} style={{ width: size, height: size, ...style }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <g style={{ strokeWidth: width }}>
          {Array.from({ length: segments }, (_, i) => (
            <path key={i} d={arcPath(c, c, r, from + i * step + step * 0.18, from + (i + 1) * step - step * 0.18)} className={i < lit ? 'on' : ''} />
          ))}
        </g>
      </svg>
      {children && <div className="led-ring-text">{children}</div>}
    </div>
  );
}
