import { HUB_HTTP } from '../../hub.js';
import { Icon } from '../../icons.jsx';
import LedRing from '../../LedRing.jsx';
import { Artwork } from '../../widgets.jsx';
import MapView from '../../MapView.jsx';
import { Controls, fmt, useCar, useClockText, useMusic, useSongs } from './common.jsx';

/*
 * Neon Cockpit: round instruments drawn as LED rings, orange and electric
 * blue on black. Big ring for speed, small rings for fuel and the clock,
 * a playlist and a map strip. The menu is split in two columns of round
 * buttons, left and right (themes.css, .shell-split).
 */

export default function CockpitHome({ onNavigate }) {
  const car = useCar();
  const music = useMusic();
  const { time, now } = useClockText();
  const { songs, play } = useSongs(3);
  const current = music.player.track?.id;

  return (
    <div className="cockpit">
      <div className="cockpit-small">
        <LedRing size={126} value={(car.fuel ?? 0) / 100} color="blue" segments={24} width={7} from={0} to={360}>
          <Icon name="fuel" size={18} />
          <strong>{fmt(car.fuel)}%</strong>
        </LedRing>
        <LedRing size={126} value={(now.getMinutes() + now.getSeconds() / 60) / 60} color="orange" segments={30} width={7} from={0} to={360}>
          <strong>{time}</strong>
          <small>{car.outside ?? '–'}°C</small>
        </LedRing>
      </div>

      <button className="cockpit-main" onClick={() => onNavigate('vehicle', 'driving')}>
        <LedRing size={270} value={(car.speed ?? 0) / 220} color="orange" segments={44} width={14}>
          <small>km/h</small>
          <strong>{fmt(car.speed)}</strong>
          <span>Gear {car.gear ?? '–'}</span>
        </LedRing>
        <LedRing size={210} value={(car.rpm ?? 0) / 7000} color="blue" segments={36} width={6} className="inner" />
      </button>

      <section className="cockpit-music">
        <button className="cockpit-now" onClick={() => onNavigate(music.target)}>
          <Artwork src={music.art} icon={music.radio ? 'radio' : 'media'} key={music.art ?? 'none'} />
          <span>
            <strong>{music.title}</strong>
            <small>{music.sub}</small>
          </span>
        </button>
        <Controls music={music} className="cockpit-controls" />
        <div className="cockpit-list">
          {songs.map((s, i) => (
            <button key={s.id} className={current === s.id ? 'on' : ''} onClick={() => play(i)}>
              <Artwork src={`${HUB_HTTP}/media/art/${s.id}`} icon="media" />
              <span>{s.title}</span>
            </button>
          ))}
          {songs.length === 0 && <p>No songs found yet</p>}
        </div>
      </section>

      <MapView speed={car.speed} className="cockpit-map" arrow={false}>
        <button className="cockpit-map-label" onClick={() => onNavigate('fulllink')}>
          <Icon name="navigate" size={16} /> Navigation · Full Link
        </button>
      </MapView>
    </div>
  );
}
