import { Icon } from '../../icons.jsx';
import { DRIVE_MODES, useDriveMode } from '../../theme.js';
import { Artwork } from '../../widgets.jsx';
import { Controls, fmt, rangeKm, useCar, useMusic } from './common.jsx';

/*
 * Velocity: sharp, angled race-car look on carbon black. The drive mode
 * (Eco / Comfort / Sport) recolours everything - also the Capsule cluster.
 * The menu is tabs in the top bar (themes.css, .shell-tabs).
 */

const RPM_SEGMENTS = 28;
const MODE_TEXT = {
  eco: 'Gentle throttle, early shifts',
  comfort: 'Balanced for every day',
  sport: 'Sharp throttle, shift late',
};

export default function VelocityHome({ onNavigate }) {
  const car = useCar();
  const music = useMusic();
  const [mode, setMode] = useDriveMode();
  const lit = Math.round(((car.rpm ?? 0) / 7000) * RPM_SEGMENTS);

  return (
    <div className="velo">
      <section className="velo-modes">
        <small>Drive mode</small>
        {DRIVE_MODES.map(([id, label]) => (
          <button key={id} className={`velo-mode ${id} ${mode === id ? 'on' : ''}`} onClick={() => setMode(id)}>
            {label}
          </button>
        ))}
        <p>{MODE_TEXT[mode]}</p>
      </section>

      <section className="velo-speed">
        <div className="velo-rpm">
          {Array.from({ length: RPM_SEGMENTS }, (_, i) => (
            <i key={i} className={`${i < lit ? 'on' : ''} ${i >= RPM_SEGMENTS - 3 ? 'red' : ''}`} />
          ))}
        </div>
        <div className="velo-readout">
          <strong>{fmt(car.speed)}</strong>
          <span>
            <small>km/h</small>
            <b>{fmt(car.rpm)}</b>
            <small>rpm</small>
          </span>
          <em className="velo-gear">{car.gear ?? '–'}</em>
        </div>
        <div className="velo-stats">
          <span>
            <small>Fuel</small>
            {fmt(car.fuel)}%
          </span>
          <span>
            <small>Range</small>
            {rangeKm(car.fuel)} km
          </span>
          <span className={car.coolant > 112 ? 'warn' : ''}>
            <small>Coolant</small>
            {fmt(car.coolant)}°
          </span>
          <span>
            <small>Trip</small>
            {car.trip?.distanceKm ?? 0} km
          </span>
        </div>
      </section>

      <section className="velo-music">
        <button className="velo-art" onClick={() => onNavigate(music.target)}>
          <Artwork src={music.art} icon={music.radio ? 'radio' : 'media'} key={music.art ?? 'none'} />
        </button>
        <button className="velo-music-text" onClick={() => onNavigate(music.target)}>
          <strong>{music.title}</strong>
          <span>{music.sub}</span>
        </button>
        <Controls music={music} className="velo-controls" />
      </section>

      <nav className="velo-shortcuts">
        {[
          ['radio', 'Radio', ['radio']],
          ['media', 'Media', ['media']],
          ['phone', 'Phone', ['phone']],
          ['parking', 'Parking', ['vehicle', 'parking']],
          ['wrench', 'Diagnose', ['vehicle', 'codes']],
          ['light', 'Ambient', ['vehicle', 'comfort']],
        ].map(([icon, label, target]) => (
          <button key={label} onClick={() => onNavigate(...target)}>
            <Icon name={icon} size={24} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
