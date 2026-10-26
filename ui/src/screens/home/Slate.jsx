import { HUB_HTTP } from '../../hub.js';
import { Icon } from '../../icons.jsx';
import { formatTime } from '../../player.js';
import { Artwork } from '../../widgets.jsx';
import { Controls, fmt, rangeKm, songHue, useCar, useClockText, useMusic, useSongs } from './common.jsx';

/*
 * Slate: like a phone home screen. A greeting at the top, square widgets,
 * a big "now playing" card coloured after the song, and a song list with
 * covers. The menu is a dock at the bottom (themes.css, .shell-dock).
 */

function Widget({ icon, label, children, onClick, tone }) {
  return (
    <button className={`slate-widget ${tone ?? ''}`} onClick={onClick}>
      <span className="slate-widget-head">
        <Icon name={icon} size={16} />
        {label}
      </span>
      {children}
    </button>
  );
}

export default function SlateHome({ onNavigate }) {
  const car = useCar();
  const music = useMusic();
  const { time, date, greeting } = useClockText();
  const { songs, play } = useSongs(5);
  const hue = songHue(music.title);
  const current = music.player.track?.id;

  return (
    <div className="slate">
      <header className="slate-head">
        <div>
          <h1>{greeting}</h1>
          <span>{date}</span>
        </div>
        <strong>{time}</strong>
      </header>

      <div className="slate-widgets">
        <Widget icon="car" label="Car" onClick={() => onNavigate('vehicle', 'status')} tone={car.open || car.codes.length ? 'warn' : ''}>
          <strong>{fmt(car.speed)}</strong>
          <small>km/h · {car.open ? 'Door open' : car.locked ? 'Locked' : 'Unlocked'}</small>
        </Widget>
        <Widget icon="fuel" label="Fuel" onClick={() => onNavigate('vehicle', 'driving')} tone={car.fuel < 12 ? 'warn' : ''}>
          <strong>{fmt(car.fuel)}%</strong>
          <small>{rangeKm(car.fuel)} km range</small>
          <i className="slate-meter">
            <b style={{ width: `${car.fuel ?? 0}%` }} />
          </i>
        </Widget>
        <Widget icon="thermo" label="Outside" onClick={() => onNavigate('vehicle', 'driving')}>
          <strong>{car.outside ?? '–'}°</strong>
          <small>Engine {fmt(car.coolant)}°C</small>
        </Widget>
        <Widget icon="trip" label="Trip" onClick={() => onNavigate('vehicle', 'driving')}>
          <strong>{car.trip?.distanceKm ?? 0}</strong>
          <small>
            km · {Math.floor((car.trip?.durationS ?? 0) / 60)} min
          </small>
        </Widget>
      </div>

      <section className="slate-now" style={{ '--song-hue': hue }}>
        <button className="slate-now-art" onClick={() => onNavigate(music.target)}>
          <Artwork src={music.art} icon={music.radio ? 'radio' : 'media'} key={music.art ?? 'none'} />
        </button>
        <button className="slate-now-text" onClick={() => onNavigate(music.target)}>
          <small>{music.empty ? 'Music' : music.radio ? 'Radio' : 'Now playing'}</small>
          <strong>{music.title}</strong>
          <span>{music.sub}</span>
        </button>
        {!music.radio && !music.empty && (
          <div className="slate-now-progress">
            <i>
              <b style={{ width: `${music.progress * 100}%` }} />
            </i>
            <span>
              <small>{formatTime(music.player.position)}</small>
              <small>{formatTime(music.player.duration)}</small>
            </span>
          </div>
        )}
        <Controls music={music} className="slate-controls" size={26} />
      </section>

      <section className="slate-list">
        <h2>
          Songs <button onClick={() => onNavigate('media')}>See all</button>
        </h2>
        {songs.length === 0 && <p className="slate-empty">Put music on a USB stick or in the Music folder.</p>}
        {songs.map((s, i) => (
          <button key={s.id} className={`slate-song ${current === s.id ? 'on' : ''}`} onClick={() => play(i)}>
            <Artwork src={`${HUB_HTTP}/media/art/${s.id}`} icon="media" />
            <span>
              <strong>{s.title}</strong>
              <small>{s.artist ?? s.folder ?? 'Unknown artist'}</small>
            </span>
            <small>{s.duration ? formatTime(s.duration) : ''}</small>
          </button>
        ))}
      </section>
    </div>
  );
}
