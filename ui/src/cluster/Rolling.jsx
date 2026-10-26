import { useEffect, useRef } from 'react';

/** Number with digits that roll like an odometer (each digit column slides). */
export function RollingNumber({ value, digits = 3, className = '' }) {
  const n = Math.max(0, Math.round(value ?? 0));
  const text = String(n).padStart(digits, ' ').slice(-digits);
  return (
    <span className={`rolling ${className}`}>
      {[...text].map((ch, i) => (
        <span key={i} className={`roll ${ch === ' ' ? 'blank' : ''}`}>
          <span style={{ transform: `translateY(${ch === ' ' ? 0 : -Number(ch) * 10}%)` }}>
            {'0123456789'.split('').map((d) => (
              <i key={d}>{d}</i>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * Runs `step(speed, dt)` every frame without re-rendering React (for things
 * that move with the speed: lane lines, turbine blades).
 */
export function useSpeedFrame(speed, step) {
  const speedRef = useRef(speed);
  speedRef.current = speed ?? 0;
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    let frame;
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      stepRef.current(speedRef.current, dt);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);
}
