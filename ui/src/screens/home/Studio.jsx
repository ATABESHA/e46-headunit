import { command } from '../../hub.js';
import { Icon } from '../../icons.jsx';
import { Artwork } from '../../widgets.jsx';
import CarArt from '../../CarArt.jsx';
import MapView from '../../MapView.jsx';
import { Controls, fmt, rangeKm, useCar, useClockText, useMusic } from './common.jsx';

/*
 * Studio: a light style. The map fills the whole screen and white cards float
 * on top of it, with black buttons. The menu is a floating pill on the left
 * (themes.css, .shell-float).
 */

export default function StudioHome({ onNavigate }) {
  const car = useCar();
  const music = useMusic();
  const { time, date } = useClockText();

  return (
    <MapView speed={car.speed} className="studio">
      <div className="studio-card studio-clock">
        <strong>{time}</strong>
        <span>{date}</span>
        <small>
          <Icon name="thermo" size={14} /> {car.outside ?? '–'}°C outside
        </small>
      </div>

      <button className="studio-card studio-nav" onClick={() => onNavigate('fulllink')}>
        <span className="studio-black">
          <Icon name="turn" size={22} />
        </span>
        <span>
          <strong>Where to?</strong>
          <small>Maps through Full Link</small>
        </span>
      </button>

      <div className="studio-card studio-car">
        <div className="studio-car-head">
          <span>
            <small>Speed</small>
            <strong>{fmt(car.speed)}</strong> km/h
          </span>
          <button
            className={`studio-lock ${car.locked ? 'on' : ''}`}
            onClick={() => command('body.lock', { locked: !car.locked }).catch(() => {})}
            aria-label={car.locked ? 'Unlock' : 'Lock'}
          >
            <Icon name={car.locked ? 'lock' : 'unlock'} size={20} />
          </button>
        </div>
        <button className="studio-car-art" onClick={() => onNavigate('vehicle', 'status')} aria-label="Vehicle">
          <CarArt />
        </button>
        <div className="studio-car-stats">
          <span>
            <small>Fuel</small>
            <b>{fmt(car.fuel)}%</b>
          </span>
          <span>
            <small>Range</small>
            <b>{rangeKm(car.fuel)} km</b>
          </span>
          <span className={car.coolant > 112 ? 'warn' : ''}>
            <small>Coolant</small>
            <b>{fmt(car.coolant)}°</b>
          </span>
          <span className={car.open ? 'warn' : ''}>
            <small>Doors</small>
            <b>{car.open ? 'Open' : 'Closed'}</b>
          </span>
        </div>
      </div>

      <div className="studio-card studio-music">
        <button className="studio-art" onClick={() => onNavigate(music.target)}>
          <Artwork src={music.art} icon={music.radio ? 'radio' : 'media'} key={music.art ?? 'none'} />
        </button>
        <button className="studio-music-text" onClick={() => onNavigate(music.target)}>
          <strong>{music.title}</strong>
          <span>{music.sub}</span>
        </button>
        <div className="studio-progress">
          <i style={{ width: `${music.progress * 100}%` }} />
        </div>
        <Controls music={music} className="studio-controls" />
      </div>

      <div className="studio-chips">
        {[
          ['phone', 'Phone', ['phone']],
          ['parking', 'Parking', ['vehicle', 'parking']],
          ['light', 'Ambient', ['vehicle', 'comfort']],
          ['radio', 'Radio', ['radio']],
        ].map(([icon, label, target]) => (
          <button key={label} onClick={() => onNavigate(...target)}>
            <Icon name={icon} size={18} />
            {label}
          </button>
        ))}
      </div>
    </MapView>
  );
}
