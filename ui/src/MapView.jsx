import { useEffect, useMemo, useRef } from 'react';

/*
 * A drawn map that scrolls with the car's speed. There is no navigation in
 * the head unit itself (maps come from CarPlay / Android Auto in Full Link),
 * so this is a picture for the home screens and the cluster.
 * Only one layer moves, so it is cheap for the graphics chip.
 *
 * Colours come from CSS variables, so every style can paint it its own way:
 *   --map-bg, --map-street, --map-major, --map-block, --map-block-line, --map-route
 */

const TILE = { w: 640, h: 400 };

/** Streets that join up where one tile meets the next (vertical ones run straight through). */
function useStreets() {
  return useMemo(() => {
    const major = ['M0 70 L640 40', 'M0 250 L640 290', 'M0 360 L280 330 L640 352'];
    const minor = [];
    for (const x of [70, 150, 245, 395, 470, 560]) minor.push(`M${x} 0 L${x + (x % 3) * 4} ${TILE.h}`);
    for (const y of [120, 170, 205, 310]) minor.push(`M0 ${y} L640 ${y + ((y % 7) - 3) * 6}`);
    minor.push('M0 20 L220 160', 'M420 400 L640 230', 'M290 70 L360 250');
    const blocks = [
      [160, 86, 70, 26],
      [255, 180, 62, 22],
      [480, 120, 66, 36],
      [80, 262, 56, 30],
      [405, 300, 52, 26],
    ];
    return { major, minor, blocks };
  }, []);
}

function MapTile({ y }) {
  const { major, minor, blocks } = useStreets();
  return (
    <g transform={`translate(0 ${y})`}>
      {blocks.map(([bx, by, bw, bh]) => (
        <rect key={`${bx}-${by}`} x={bx} y={by} width={bw} height={bh} rx="3" className="map-block" />
      ))}
      {minor.map((d) => (
        <path key={d} d={d} className="map-street" />
      ))}
      {major.map((d) => (
        <path key={d} d={d} className="map-street major" />
      ))}
    </g>
  );
}

function useScroll(layerRef, speed) {
  const speedRef = useRef(speed);
  speedRef.current = speed ?? 0;
  useEffect(() => {
    let frame;
    let offset = 0;
    let last = performance.now();
    const step = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (speedRef.current > 0.5 && layerRef.current) {
        offset = (offset + speedRef.current * 0.5 * dt) % TILE.h;
        layerRef.current.style.transform = `translateY(${(offset - TILE.h).toFixed(1)}px)`;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [layerRef]);
}

/**
 * props: speed (km/h), route (show the blue route line), arrow (car arrow),
 *        children (cards on top of the map)
 */
export default function MapView({ speed, className = '', route = true, arrow = true, children }) {
  const layerRef = useRef(null);
  useScroll(layerRef, speed);
  return (
    <div className={`map-view ${className}`}>
      <div className="map-streets" ref={layerRef}>
        <svg width={TILE.w} height={TILE.h * 3} viewBox={`0 0 ${TILE.w} ${TILE.h * 3}`}>
          <MapTile y={0} />
          <MapTile y={TILE.h} />
          <MapTile y={TILE.h * 2} />
        </svg>
      </div>
      {route && (
        <svg className="map-route" viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d="M320 400V250c0-24 6-40 18-58l40-62c10-16 14-34 14-54V0" className="glow" />
          <path d="M320 400V250c0-24 6-40 18-58l40-62c10-16 14-34 14-54V0" className="line" />
        </svg>
      )}
      {arrow && (
        <div className="map-arrow">
          <svg viewBox="0 0 40 44">
            <path d="M20 2 38 40 20 32 2 40Z" />
          </svg>
        </div>
      )}
      {children}
    </div>
  );
}
