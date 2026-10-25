import { useEffect, useMemo, useRef } from 'react';
import { HUB_HTTP, useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';
import { formatTime, next, previous, seek, toggle, usePlayer } from '../player.js';
import { CarTopArt } from '../CarArt.jsx';

/*
 * Design1 home: the car seen from above with its live data on the left, a
 * map-style card on the right with the trip and the music on top of it.
 *
 * There is no navigation in the head unit itself (maps come from CarPlay /
 * Android Auto in Full Link), so the map is a drawing that scrolls with the
 * car's speed, and its banner opens Full Link.
 */

// ---------- Map drawing: one 640 x 400 tile, repeated so it can scroll forever ----------

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
        <rect key={`${bx}-${by}`} x={bx} y={by} width={bw} height={bh} rx="3" className="d1-block" />
      ))}
      {minor.map((d) => (
        <path key={d} d={d} className="d1-street" />
      ))}
      {major.map((d) => (
        <path key={d} d={d} className="d1-street major" />
      ))}
    </g>
  );
}

/** Scrolls the street layer with the car's speed. Only a layer moves: cheap for the graphics chip. */
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

// ---------- Left card ----------

function FuelMeter({ fuel }) {
  const BARS = 44;
  const lit = fuel === undefined ? 0 : Math.round((fuel / 100) * BARS);
  return (
    <div className="d1-meter">
      <div className="d1-meter-head">
        <span>Fuel</span>
        <strong>{fuel !== undefined ? `${Math.round(fuel)}%` : '–'}</strong>
      </div>
      <div className={`d1-bars ${fuel < 12 ? 'low' : ''}`}>
        {Array.from({ length: BARS }, (_, i) => (
          <i key={i} className={i < lit ? (i === lit - 1 ? 'on mark' : 'on') : ''} />
        ))}
      </div>
    </div>
  );
}

function Tile({ icon, title, detail, alert, onClick }) {
  return (
    <button className="d1-tile" onClick={onClick}>
      <span className={`d1-tile-icon ${alert ? 'alert' : ''}`}>
        <Icon name={icon} size={20} />
      </span>
      {alert && (
        <span className="d1-tile-info">
          <Icon name="info" size={16} />
        </span>
      )}
      <strong>{title}</strong>
      <small>{detail}</small>
    </button>
  );
}

// ---------- Right card ----------

function Music({ onNavigate }) {
  const player = usePlayer();
  const carplay = useTopic('carplay.media');
  const radio = player.kind === 'radio';
  const title = radio ? player.station?.name : player.track?.title;
  const sub = radio ? player.station?.tags || 'Internet radio' : player.track?.artist;
  const progress = !radio && player.duration ? (player.position / player.duration) * 100 : 0;

  if (!player.kind) {
    return (
      <button className="d1-card d1-music empty" onClick={() => onNavigate(carplay?.title ? 'fulllink' : 'media')}>
        <strong>{carplay?.title ?? 'Nothing playing'}</strong>
        <span>{carplay?.title ? carplay.artist ?? 'On your phone' : 'Tap for music and radio'}</span>
        <Icon name="media" size={30} />
      </button>
    );
  }

  return (
    <div className="d1-card d1-music">
      <button className="d1-music-title" onClick={() => onNavigate(radio ? 'radio' : 'media')}>
        <strong>{title ?? '–'}</strong>
        <span>{player.error ?? sub ?? ''}</span>
      </button>
      <div className="d1-music-controls">
        <button onClick={previous} disabled={radio} aria-label="Previous">
          <Icon name="prev" size={22} filled />
        </button>
        <button className="d1-play" onClick={toggle} aria-label={player.playing ? 'Pause' : 'Play'}>
          <Icon name={player.playing ? 'pause' : 'play'} size={22} filled />
        </button>
        <button onClick={() => next()} disabled={radio} aria-label="Next">
          <Icon name="next" size={22} filled />
        </button>
      </div>
      {!radio && (
        <>
          <div
            className="d1-slider"
            onClick={(e) => {
              if (!player.duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              seek(((e.clientX - rect.left) / rect.width) * player.duration);
            }}
          >
            <i style={{ width: `${progress}%` }} />
            <b style={{ left: `${progress}%` }} />
          </div>
          <div className="d1-times">
            <small>{formatTime(player.position)}</small>
            <small>-{formatTime(Math.max(0, player.duration - player.position))}</small>
          </div>
        </>
      )}
    </div>
  );
}

export default function Design1Home({ onNavigate }) {
  const speed = useTopic('vehicle.speed');
  const coolant = useTopic('vehicle.coolant');
  const fuel = useTopic('vehicle.fuel');
  const locked = useTopic('vehicle.locked');
  const doors = useTopic('vehicle.doors', {});
  const trip = useTopic('trip.sinceStart');
  const odometer = useTopic('vehicle.odometer');
  const carplay = useTopic('carplay.state');
  const open = Object.values(doors).some(Boolean);
  const layerRef = useRef(null);
  useScroll(layerRef, speed);

  return (
    <div className="d1">
      <section className="d1-card d1-car">
        <button className="d1-car-art" onClick={() => onNavigate('vehicle', 'driving')} aria-label="Vehicle">
          <CarTopArt />
        </button>
        <div className="d1-speed">
          <small>Speed</small>
          <span>
            <strong>{speed !== undefined ? Math.round(speed) : '–'}</strong> km/h
          </span>
        </div>
        <div className="d1-tiles">
          <Tile icon="thermo" title="Coolant" detail={coolant !== undefined ? `${coolant} °C` : '–'} alert={coolant > 112} onClick={() => onNavigate('vehicle', 'driving')} />
          <Tile
            icon={open ? 'warning' : locked ? 'lock' : 'unlock'}
            title="Doors"
            detail={open ? 'Open' : locked ? 'Locked' : 'Unlocked'}
            alert={open}
            onClick={() => onNavigate('vehicle', 'comfort')}
          />
        </div>
        <FuelMeter fuel={fuel} />
      </section>

      <section className="d1-card d1-map">
        <div className="d1-streets" ref={layerRef}>
          <svg width={TILE.w} height={TILE.h * 3} viewBox={`0 0 ${TILE.w} ${TILE.h * 3}`}>
            <MapTile y={0} />
            <MapTile y={TILE.h} />
            <MapTile y={TILE.h * 2} />
          </svg>
        </div>
        <svg className="d1-route" viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d="M320 400V250c0-24 6-40 18-58l40-62c10-16 14-34 14-54V0" className="glow" />
          <path d="M320 400V250c0-24 6-40 18-58l40-62c10-16 14-34 14-54V0" className="line" />
        </svg>
        <div className="d1-arrow">
          <svg viewBox="0 0 40 44">
            <path d="M20 2 38 40 20 32 2 40Z" />
          </svg>
        </div>

        <button className="d1-banner" onClick={() => onNavigate('fulllink')}>
          <span>
            <Icon name="turn" size={24} />
            <strong>Navigation</strong>
          </span>
          <small>{carplay?.status === 'connected' ? `Maps on ${carplay.phone ?? 'your phone'}` : 'Maps through Full Link'}</small>
        </button>
        <button className="d1-round" onClick={() => onNavigate('fulllink')} aria-label="Full Link">
          <Icon name="navigate" size={20} />
        </button>

        <div className="d1-bottom">
          <div className="d1-card d1-trip">
            <div className="d1-trip-head">
              <span className="d1-trip-icon">
                <Icon name="car" size={24} />
              </span>
              <span>
                <strong>Trip since start</strong>
                <small>Total {odometer !== undefined ? `${odometer.toLocaleString()} km` : '–'}</small>
              </span>
            </div>
            <div className="d1-trip-row">
              <span>
                <strong>{trip?.distanceKm ?? 0} km</strong> • <b>{Math.floor((trip?.durationS ?? 0) / 60)} min</b>
              </span>
              <span>
                <small>Average</small> <strong>{trip?.avgSpeed ?? 0} km/h</strong>
              </span>
            </div>
            <button className="d1-link" onClick={() => onNavigate('vehicle', 'driving')}>
              Trip computer
            </button>
          </div>
          <Music onNavigate={onNavigate} />
        </div>
      </section>
    </div>
  );
}
