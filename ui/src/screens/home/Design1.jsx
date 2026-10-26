import { command, useTopic } from '../../hub.js';
import { useResizable } from '../../resize.jsx';
import { Icon } from '../../icons.jsx';
import { formatTime, next, previous, seek, toggle, usePlayer } from '../../player.js';
import { useClockText } from './common.jsx';
import MapView from '../../MapView.jsx';

/*
 * Design1 home: your car's photo with quick controls on the left (speed,
 * fuel and the like are on the cluster), a map-style card on the right with
 * the trip and the music on top of it.
 *
 * The car photo is ui/public/face1.jpg: replace it to use another one.
 *
 * The map is a drawing (MapView.jsx); its banner opens Full Link.
 */

// ---------- Left card ----------

function Tile({ icon, title, detail, alert, off, onClick }) {
  return (
    <button className="d1-tile" onClick={onClick}>
      <span className={`d1-tile-icon ${alert ? 'alert' : ''} ${off ? 'off' : ''}`}>
        <Icon name={icon} size={17} />
      </span>
      {alert && (
        <span className="d1-tile-info">
          <Icon name="info" size={14} />
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

/** One line: fault codes from the diagnostics, or all good. */
function VehicleCheck({ codes, onClick }) {
  const active = codes.filter((c) => c.status === 'active').length;
  const tone = active ? 'bad' : codes.length ? 'warn' : 'ok';
  const text = active ? `${active} active fault${active > 1 ? 's' : ''}` : codes.length ? `${codes.length} stored code${codes.length > 1 ? 's' : ''}` : 'No faults';
  return (
    <button className={`d1-check ${tone}`} onClick={onClick}>
      <Icon name="wrench" size={18} />
      <span>Vehicle check</span>
      <strong>{text}</strong>
      <Icon name="back" size={16} className="d1-chevron" />
    </button>
  );
}

export default function Design1Home({ onNavigate }) {
  const rsBottom = useResizable('home.design1.bottom', { minLeft: 230, minRight: 170 });
  const rs = useResizable('home.design1', { minLeft: 260, minRight: 420 });
  const speed = useTopic('vehicle.speed');
  const outside = useTopic('vehicle.outsideTemp');
  const phone = useTopic('phone.state');
  const ambient = useTopic('ambient.state');
  const codes = useTopic('diag.codes', []);
  const trip = useTopic('trip.sinceStart');
  const odometer = useTopic('vehicle.odometer');
  const carplay = useTopic('carplay.state');
  const { greeting, date } = useClockText();
  const icy = outside !== undefined && outside <= 3;
  const phoneOn = phone?.connection === 'connected';

  return (
    <div className={`d1 ${rs.className}`} ref={rs.ref} style={rs.style}>
      <section className="d1-card d1-car">
        <button className="d1-face" onClick={() => onNavigate('vehicle', 'status')} aria-label="Vehicle">
          <img src="./face1.jpg" alt="" draggable="false" />
        </button>
        <div className="d1-hello">
          <strong>{greeting}</strong>
          <small>{date}</small>
        </div>
        <div className="d1-tiles">
          <Tile
            icon="thermo"
            title={outside !== undefined ? `${outside} °C` : '–'}
            detail={icy ? 'Ice risk outside' : 'Outside'}
            alert={icy}
            onClick={() => onNavigate('vehicle', 'driving')}
          />
          <Tile
            icon="phone"
            title={phoneOn ? phone.device : 'Phone'}
            detail={phoneOn ? `Battery ${phone.battery ?? '–'}%` : 'Not connected'}
            off={!phoneOn}
            onClick={() => onNavigate('phone')}
          />
          <Tile
            icon="light"
            title="Ambient"
            detail={ambient ? (ambient.on ? `On · ${ambient.brightness}%` : 'Off') : '–'}
            off={!ambient?.on}
            onClick={() => command('ambient.set', { on: !ambient?.on }).catch(() => {})}
          />
          <Tile icon="camera" title="Camera" detail="Rear view" onClick={() => onNavigate('vehicle', 'parking')} />
        </div>
        <VehicleCheck codes={codes} onClick={() => onNavigate('vehicle', 'codes')} />
      </section>

      <MapView speed={speed} className="d1-card d1-map">
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

        <div className={`d1-bottom ${rsBottom.className}`} ref={rsBottom.ref} style={rsBottom.style}>
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
          {rsBottom.handle}
        </div>
      </MapView>
      {rs.handle}
    </div>
  );
}
