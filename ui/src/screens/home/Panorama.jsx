import { useState } from 'react';
import { useTopic } from '../../hub.js';
import { Icon } from '../../icons.jsx';
import { arcPath } from '../../cluster/Dial.jsx';
import { Artwork } from '../../widgets.jsx';
import MapView from '../../MapView.jsx';
import { Controls, fmt, useCar, useMusic, volumeStep } from './common.jsx';

/*
 * Panorama: black glass with a blue glow. Three big panels side by side
 * (map, a round centre dial, music) and page dots underneath; the second
 * page has big round shortcuts. The menu is a rail of round buttons on the
 * right (themes.css, .shell-rail).
 */

function CenterDial({ car }) {
  const volume = useTopic('audio.volume');
  const pct = Math.min(1, (car.speed ?? 0) / 220);
  const end = -135 + 270 * pct;
  return (
    <section className="pano-panel pano-center">
      <div className="pano-dial-box">
      <svg viewBox="0 0 240 240" className="pano-dial">
        <circle cx="120" cy="120" r="104" className="pano-dial-face" />
        <path d={arcPath(120, 120, 98, -135, 135)} className="pano-dial-track" />
        <path d={arcPath(120, 120, 98, -135, Math.max(-134.5, end))} className="pano-dial-glow" />
        <path d={arcPath(120, 120, 98, -135, Math.max(-134.5, end))} className="pano-dial-fill" />
      </svg>
      <div className="pano-dial-text">
        <strong>{fmt(car.speed)}</strong>
        <small>km/h</small>
        <span>Gear {car.gear ?? '–'}</span>
      </div>
      </div>
      <div className="pano-volume">
        <button onClick={() => volumeStep(-5)} aria-label="Volume down">
          <Icon name="minus" size={26} />
        </button>
        <span>
          <small>Volume</small>
          <b>{volume ? (volume.muted ? 'Mute' : volume.level) : '–'}</b>
        </span>
        <button onClick={() => volumeStep(5)} aria-label="Volume up">
          <Icon name="plus" size={26} />
        </button>
      </div>
    </section>
  );
}

function MediaPanel({ onNavigate }) {
  const music = useMusic();
  return (
    <section className="pano-panel pano-media">
      <button className="pano-art" onClick={() => onNavigate(music.target)}>
        <Artwork src={music.art} icon={music.radio ? 'radio' : 'media'} key={music.art ?? 'none'} />
      </button>
      <button className="pano-media-text" onClick={() => onNavigate(music.target)}>
        <strong>{music.title}</strong>
        <span>{music.sub}</span>
      </button>
      <div className="pano-progress">
        <i style={{ width: `${music.progress * 100}%` }} />
      </div>
      <Controls music={music} className="pano-controls" size={24} />
    </section>
  );
}

function MapPanel({ car, onNavigate }) {
  const carplay = useTopic('carplay.state');
  return (
    <MapView speed={car.speed} className="pano-panel pano-map">
      <button className="pano-map-head" onClick={() => onNavigate('fulllink')}>
        <Icon name="navigate" size={20} />
        <span>
          <strong>Navigation</strong>
          <small>{carplay?.status === 'connected' ? `Maps on ${carplay.phone ?? 'your phone'}` : 'Maps through Full Link'}</small>
        </span>
      </button>
      <div className="pano-map-foot">
        <span>
          <b>{car.trip?.distanceKm ?? 0}</b> km
        </span>
        <span>
          <b>{Math.floor((car.trip?.durationS ?? 0) / 60)}</b> min
        </span>
        <span>
          <b>{car.outside ?? '–'}</b>°C
        </span>
      </div>
    </MapView>
  );
}

const SHORTCUTS = [
  ['radio', 'Radio', ['radio']],
  ['media', 'Media', ['media']],
  ['phone', 'Phone', ['phone']],
  ['link', 'Full Link', ['fulllink']],
  ['parking', 'Parking', ['vehicle', 'parking']],
  ['light', 'Ambient', ['vehicle', 'comfort']],
  ['wrench', 'Diagnostics', ['vehicle', 'codes']],
  ['settings', 'Settings', ['settings']],
];

export default function PanoramaHome({ onNavigate }) {
  const car = useCar();
  const [page, setPage] = useState(0);
  return (
    <div className="pano">
      {page === 0 ? (
        <div className="pano-row">
          <MapPanel car={car} onNavigate={onNavigate} />
          <CenterDial car={car} />
          <MediaPanel onNavigate={onNavigate} />
        </div>
      ) : (
        <div className="pano-shortcuts">
          {SHORTCUTS.map(([icon, label, target]) => (
            <button key={label} onClick={() => onNavigate(...target)}>
              <span>
                <Icon name={icon} size={30} />
              </span>
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="pano-dots">
        <button className={page === 0 ? 'on' : ''} onClick={() => setPage(0)} aria-label="Page 1">
          <Icon name="home" size={14} />
        </button>
        <button className={page === 1 ? 'on' : ''} onClick={() => setPage(1)} aria-label="Page 2" />
      </div>
    </div>
  );
}
