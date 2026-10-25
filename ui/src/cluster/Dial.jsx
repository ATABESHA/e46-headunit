import { useEffect, useRef } from 'react';

// Round dial (speedometer / rev counter). 270° sweep, 0° = straight up.
const START = -135;
const SWEEP = 270;

export const rad = (deg) => (deg * Math.PI) / 180;
export const polar = (cx, cy, r, deg) => [cx + r * Math.sin(rad(deg)), cy - r * Math.cos(rad(deg))];

export function arcPath(cx, cy, r, from, to) {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * Moves towards `target` smoothly (car data arrives ~10 times a second,
 * the screen draws 60 times a second). Calls draw(value) on every frame
 * without re-rendering React, so it stays light on the CPU.
 */
export function useSmooth(target, draw, speed = 9) {
  const current = useRef(target);
  const goal = useRef(target);
  goal.current = target;
  useEffect(() => {
    let frame;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const diff = goal.current - current.current;
      if (Math.abs(diff) > 0.01) {
        current.current += diff * Math.min(1, dt * speed);
        draw(current.current);
      }
      frame = requestAnimationFrame(step);
    };
    draw(current.current);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);
}

/**
 * props: value, min, max, major (label every), minor (tick every),
 *        labelDivisor (e.g. 1000 for rpm), redFrom, unit, children (center content)
 */
export function Dial({ value, min = 0, max, major, minor, labelDivisor = 1, labelSize = 34, redFrom, unit, sub, children, className = '' }) {
  const needleRef = useRef(null);
  const glowRef = useRef(null);
  const glowWideRef = useRef(null);
  const cx = 300;
  const cy = 300;
  const R = 270;
  const angle = (v) => START + (SWEEP * (Math.min(max, Math.max(min, v)) - min)) / (max - min);

  useSmooth(value, (v) => {
    const a = angle(v);
    needleRef.current?.setAttribute('transform', `rotate(${a.toFixed(2)} ${cx} ${cy})`);
    const d = arcPath(cx, cy, R - 34, START, Math.max(START + 0.5, a));
    glowRef.current?.setAttribute('d', d);
    glowWideRef.current?.setAttribute('d', d);
    needleRef.current?.classList.toggle('red', redFrom !== undefined && v >= redFrom);
  });

  const ticks = [];
  for (let v = min; v <= max + 1e-6; v += minor) {
    const isMajor = Math.abs((v - min) % major) < 1e-6 || Math.abs(((v - min) % major) - major) < 1e-6;
    const a = angle(v);
    const [x1, y1] = polar(cx, cy, R, a);
    const [x2, y2] = polar(cx, cy, R - (isMajor ? 30 : 16), a);
    ticks.push(
      <line key={`t${v}`} x1={x1} y1={y1} x2={x2} y2={y2} className={`tick ${isMajor ? 'major' : ''} ${redFrom !== undefined && v >= redFrom ? 'red' : ''}`} />,
    );
    if (isMajor) {
      const [lx, ly] = polar(cx, cy, R - 30 - labelSize, a);
      ticks.push(
        <text key={`l${v}`} x={lx} y={ly} style={{ fontSize: labelSize }} className={`tick-label ${redFrom !== undefined && v >= redFrom ? 'red' : ''}`}>
          {Math.round(v / labelDivisor)}
        </text>,
      );
    }
  }

  return (
    <div className={`dial ${className}`}>
      <svg viewBox="0 0 600 600">
        <circle cx={cx} cy={cy} r={R + 18} className="dial-face" />
        <path d={arcPath(cx, cy, R - 34, START, START + SWEEP)} className="dial-track" />
        <path ref={glowWideRef} className="dial-glow-wide" />
        <path ref={glowRef} className="dial-glow" />
        {redFrom !== undefined && <path d={arcPath(cx, cy, R + 6, angle(redFrom), START + SWEEP)} className="dial-red" />}
        {ticks}
        {unit && (
          <text x={cx} y={cy + 106} className="dial-unit">
            {unit}
          </text>
        )}
        {sub}
        <g ref={needleRef}>
          {/* Wide, faint copy of the needle = glow without a blur filter (Premium style) */}
          <path d={`M${cx - 14} ${cy + 30} L${cx - 9} ${cy - R + 8} L${cx + 9} ${cy - R + 8} L${cx + 14} ${cy + 30} Z`} className="needle-glow" />
          <path d={`M${cx - 5} ${cy + 26} L${cx - 2.5} ${cy - R + 16} L${cx + 2.5} ${cy - R + 16} L${cx + 5} ${cy + 26} Z`} className="needle" />
        </g>
        <circle cx={cx} cy={cy} r="64" className="dial-hub" />
      </svg>
      <div className="dial-center">{children}</div>
    </div>
  );
}

/** Small arc gauge in the bottom of a dial (coolant / fuel). Fills from left to right. */
export function SubGauge({ value, min, max, warnBelow, warnAbove, left, right, cx = 300, cy = 300, r = 152, from = 156, to = 204 }) {
  const pct = (Math.min(max, Math.max(min, value ?? min)) - min) / (max - min);
  // Angles grow clockwise, so along the bottom they run from right (from) to left (to).
  const a = to - (to - from) * pct;
  const warn = (warnBelow !== undefined && value < warnBelow) || (warnAbove !== undefined && value > warnAbove);
  const [lx, ly] = polar(cx, cy, r, to);
  const [rx, ry] = polar(cx, cy, r, from);
  return (
    <g className={`sub-gauge ${warn ? 'warn' : ''}`}>
      <path d={arcPath(cx, cy, r, from, to)} className="sub-track" />
      {value !== undefined && pct > 0 && <path d={arcPath(cx, cy, r, Math.min(to - 0.5, a), to)} className="sub-fill" />}
      <text x={lx} y={ly + 30} className="sub-label">
        {left}
      </text>
      <text x={rx} y={ry + 30} className="sub-label">
        {right}
      </text>
    </g>
  );
}

/**
 * A curved bar that fills up to `value` (smoothly), on any circle.
 * Angles: 0 = straight up, growing clockwise. For a segmented look give the
 * fill a stroke-dasharray in CSS. `needle` adds a short line across the bar
 * at the current value: [inner radius, outer radius].
 */
export function ArcFill({ value, min = 0, max, cx, cy, r, from = START, sweep = SWEEP, className = '', needle, track = true }) {
  const fillRef = useRef(null);
  const needleRef = useRef(null);
  const angle = (v) => from + (sweep * (Math.min(max, Math.max(min, v ?? min)) - min)) / (max - min);
  useSmooth(value ?? min, (v) => {
    const a = angle(v);
    if (sweep >= 0) fillRef.current?.setAttribute('d', arcPath(cx, cy, r, from, Math.max(from + 0.3, a)));
    else fillRef.current?.setAttribute('d', arcPath(cx, cy, r, Math.min(from - 0.3, a), from));
    needleRef.current?.setAttribute('transform', `rotate(${a.toFixed(2)} ${cx} ${cy})`);
  });
  const trackD = sweep >= 0 ? arcPath(cx, cy, r, from, from + sweep) : arcPath(cx, cy, r, from + sweep, from);
  return (
    <g className={className}>
      {track && <path d={trackD} className="arc-track" />}
      <path ref={fillRef} className="arc-fill" />
      {needle && (
        <g ref={needleRef}>
          <line x1={cx} y1={cy - needle[0]} x2={cx} y2={cy - needle[1]} className="arc-needle" />
        </g>
      )}
    </g>
  );
}

/** Tick marks and numbers around a dial. */
export function Scale({ cx, cy, r, min = 0, max, major, minor, from = START, sweep = SWEEP, labelR, labelDivisor = 1, labelEvery, redFrom, majorLen = 18, minorLen = 9, className = '' }) {
  const angle = (v) => from + (sweep * (v - min)) / (max - min);
  const out = [];
  const every = labelEvery ?? major;
  for (let v = min; v <= max + 1e-6; v += minor) {
    const isMajor = Math.abs((v - min) % major) < 1e-6 || Math.abs(((v - min) % major) - major) < 1e-6;
    const a = angle(v);
    const [x1, y1] = polar(cx, cy, r, a);
    const [x2, y2] = polar(cx, cy, r - (isMajor ? majorLen : minorLen), a);
    const red = redFrom !== undefined && v >= redFrom;
    out.push(<line key={`t${v}`} x1={x1} y1={y1} x2={x2} y2={y2} className={`scale-tick ${isMajor ? 'major' : ''} ${red ? 'red' : ''}`} />);
    const labelled = Math.abs((v - min) % every) < 1e-6 || Math.abs(((v - min) % every) - every) < 1e-6;
    if (labelR && labelled) {
      const [lx, ly] = polar(cx, cy, labelR, a);
      out.push(
        <text key={`l${v}`} x={lx} y={ly} className={`scale-label ${red ? 'red' : ''}`}>
          {Math.round(v / labelDivisor)}
        </text>,
      );
    }
  }
  return <g className={className}>{out}</g>;
}
