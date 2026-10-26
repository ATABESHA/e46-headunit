import { useLayoutEffect, useRef, useState } from 'react';
import { usePref } from './prefs.js';
import { HOLD_MS, SLOP_PX, TAP_MS, buzz, scaleOf } from './touch.js';

/**
 * Two widgets side by side whose border can be moved with a finger:
 * press and hold the gap between them until it lights up, then drag.
 * Double-tap the gap to go back to the original size.
 * The width is remembered per screen (preference "layout.<id>").
 *
 *   const rs = useResizable('radio', { minLeft: 240, minRight: 320 });
 *   <div className={`split ${rs.className}`} ref={rs.ref} style={rs.style}>
 *     <Left /> <Right /> {rs.handle}
 *   </div>
 *
 * The container must be a two-column CSS grid.
 */
export function useResizable(id, { minLeft = 180, minRight = 220 } = {}) {
  const ref = useRef(null);
  const [saved, setSaved] = usePref(`layout.${id}`, null);
  const [live, setLive] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | holding | active
  const [handleX, setHandleX] = useState(null);
  const drag = useRef(null);
  const lastTap = useRef(0);
  const width = live ?? saved;

  // Keep the handle on the gap between the two widgets.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const first = el.firstElementChild;
      if (!first) return;
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      setHandleX(first.offsetLeft + first.offsetWidth + gap / 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [width]);

  const stop = () => {
    const d = drag.current;
    if (!d) return;
    clearTimeout(d.timer);
    drag.current = null;
    setPhase('idle');
  };

  const onPointerDown = (e) => {
    const el = ref.current;
    const first = el?.firstElementChild;
    if (!first) return;
    const cs = getComputedStyle(el);
    const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (parseFloat(cs.columnGap) || 0);
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      start: first.offsetWidth,
      max: inner - minRight,
      scale: scaleOf(el),
      active: false,
      timer: setTimeout(() => {
        if (!drag.current) return;
        drag.current.active = true;
        setPhase('active');
        buzz();
      }, HOLD_MS),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setPhase('holding');
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / d.scale;
    const dy = (e.clientY - d.y) / d.scale;
    if (!d.active) {
      // Moved before the long press finished: not a resize, let it go.
      if (Math.hypot(dx, dy) > SLOP_PX) stop();
      return;
    }
    const next = Math.round(Math.min(d.max, Math.max(minLeft, d.start + dx)) / 2) * 2;
    setLive(next);
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (d?.active) {
      if (live !== null) setSaved(live);
    } else if (d) {
      // A short tap. Two of them = back to the original size.
      const now = performance.now();
      if (now - lastTap.current < TAP_MS) {
        setSaved(null);
        buzz();
      }
      lastTap.current = now;
    }
    setLive(null);
    stop();
  };

  const onPointerCancel = () => {
    setLive(null);
    stop();
  };

  return {
    ref,
    className: `resizable resize-${phase}`,
    style: width !== null ? { gridTemplateColumns: `${width}px minmax(0, 1fr)` } : undefined,
    handle:
      handleX === null ? null : (
        <div
          className={`resize-handle ${phase}`}
          style={{ left: handleX }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={(e) => e.preventDefault()}
          role="separator"
          aria-orientation="vertical"
          aria-label="Hold, then drag to change the width. Double-tap to reset."
        >
          <i />
          {phase === 'active' && <b>⟷</b>}
        </div>
      ),
  };
}
