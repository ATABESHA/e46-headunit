import { HUB_HTTP, useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';
import { formatTime, next, previous, toggle, usePlayer } from '../player.js';
import { useHomeLayout } from '../theme.js';
import { Artwork } from '../widgets.jsx';
import CarArt from '../CarArt.jsx';

function Tile({ icon, label, detail, onClick, accent, badge }) {
  return (
    <button className={`tile ${accent ? 'accent' : ''}`} onClick={onClick}>
      <span className="tile-icon">
        <Icon name={icon} size={34} />
        {badge && <i className={`tile-badge ${badge}`} />}
      </span>
      <span className="tile-label">{label}</span>
      <span className="tile-detail">{detail}</span>
    </button>
  );
}

function TileHome({ onNavigate }) {
  const player = usePlayer();
  const phone = useTopic('phone.state');
  const carplay = useTopic('carplay.state');
  const speed = useTopic('vehicle.speed');
  const coolant = useTopic('vehicle.coolant');
  const codes = useTopic('diag.codes', []);
  const ambient = useTopic('ambient.state');
  const update = useTopic('system.update');
  const sources = useTopic('media.sources', []);

  const radioDetail = player.kind === 'radio' ? player.station?.name : 'Internet radio';
  const mediaDetail =
    player.kind === 'media' ? player.track?.title : `${sources.reduce((n, s) => n + s.tracks, 0)} songs`;
  const carplayDetail = {
    connected: carplay?.phone ?? 'Connected',
    'waiting-phone': 'Connect your phone',
    'no-adapter': 'No adapter',
    starting: 'Starting…',
    error: 'Adapter problem',
  }[carplay?.status ?? 'starting'];

  return (
    <div className="home-grid">
      <Tile icon="radio" label="Radio" detail={radioDetail} accent={player.kind === 'radio' && player.playing} onClick={() => onNavigate('radio')} />
      <Tile icon="media" label="Media" detail={mediaDetail} accent={player.kind === 'media' && player.playing} onClick={() => onNavigate('media')} />
      <Tile
        icon="phone"
        label="Phone"
        detail={phone?.connection === 'connected' ? phone.device : 'No phone connected'}
        badge={phone?.connection === 'connected' ? 'ok' : null}
        onClick={() => onNavigate('phone')}
      />
      <Tile icon="link" label="Full Link" detail={carplayDetail} badge={carplay?.status === 'connected' ? 'ok' : null} onClick={() => onNavigate('fulllink')} />
      <Tile
        icon="car"
        label="Vehicle"
        detail={speed !== undefined ? `${speed} km/h · ${coolant ?? '–'}°C` : 'Driving data'}
        badge={codes.length ? 'warn' : null}
        onClick={() => onNavigate('vehicle', 'driving')}
      />
      <Tile icon="parking" label="Parking" detail="Sensors & camera" onClick={() => onNavigate('vehicle', 'parking')} />
      <Tile
        icon="light"
        label="Ambient light"
        detail={ambient ? (ambient.on ? `On · ${ambient.brightness}%` : 'Off') : '–'}
        onClick={() => onNavigate('vehicle', 'comfort')}
      />
      <Tile
        icon="settings"
        label="Settings"
        detail={update?.status === 'available' ? 'Update available' : 'Sound, display, system'}
        badge={update?.status === 'available' ? 'accent' : null}
        onClick={() => onNavigate('settings')}
      />
    </div>
  );
}

/** Small status box on the car card. */
function Stat({ icon, label, value, warn, onClick }) {
  return (
    <button className={`dash-stat ${warn ? 'warn' : ''}`} onClick={onClick}>
      <span className="dash-stat-icon">
        <Icon name={icon} size={20} />
      </span>
      <strong>{value}</strong>
      <small>{label}</small>
    </button>
  );
}

function NowPlaying({ onNavigate }) {
  const player = usePlayer();
  const carplay = useTopic('carplay.media');
  const radio = player.kind === 'radio';
  const title = radio ? player.station?.name : player.track?.title;
  const sub = radio ? player.station?.tags || 'Internet radio' : player.track?.artist;
  const art = radio ? player.station?.favicon : player.track ? `${HUB_HTTP}/media/art/${player.track.id}` : null;
  const progress = !radio && player.duration ? (player.position / player.duration) * 100 : 0;

  if (!player.kind) {
    return (
      <div className="dash-card dash-media empty">
        <button className="dash-media-open" onClick={() => onNavigate(carplay?.title ? 'fulllink' : 'media')}>
          <Artwork icon="media" className="dash-art" />
          <span className="dash-media-text">
            <small>{carplay?.title ? 'On your phone' : 'Nothing playing'}</small>
            <strong>{carplay?.title ?? 'Music and radio'}</strong>
            <span>{carplay?.title ? carplay.artist : 'Tap to choose'}</span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="dash-card dash-media">
      <button className="dash-media-open" onClick={() => onNavigate(radio ? 'radio' : 'media')}>
        <Artwork src={art} icon={radio ? 'radio' : 'media'} className="dash-art" key={art ?? 'none'} />
        <span className="dash-media-text">
          <small>{radio ? 'Radio' : 'Media'}</small>
          <strong>{title ?? '–'}</strong>
          <span>{player.error ?? sub ?? ''}</span>
        </span>
      </button>
      {!radio && (
        <div className="dash-progress">
          <div className="progress">
            <i style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-times">
            <small>{formatTime(player.position)}</small>
            <small>-{formatTime(Math.max(0, player.duration - player.position))}</small>
          </div>
        </div>
      )}
      <div className="controls">
        <button className="icon-btn" onClick={previous} disabled={radio} aria-label="Previous">
          <Icon name="prev" />
        </button>
        <button className="icon-btn big primary" onClick={toggle} aria-label={player.playing ? 'Pause' : 'Play'}>
          <Icon name={player.playing ? 'pause' : 'play'} filled />
        </button>
        <button className="icon-btn" onClick={() => next()} disabled={radio} aria-label="Next">
          <Icon name="next" />
        </button>
      </div>
    </div>
  );
}

/** Home with the car: picture and live data left, music and shortcuts right. */
function DashboardHome({ onNavigate }) {
  const speed = useTopic('vehicle.speed');
  const coolant = useTopic('vehicle.coolant');
  const trip = useTopic('trip.sinceStart');
  const odometer = useTopic('vehicle.odometer');
  const fuel = useTopic('vehicle.fuel');
  const locked = useTopic('vehicle.locked');
  const doors = useTopic('vehicle.doors', {});
  const codes = useTopic('diag.codes', []);
  const phone = useTopic('phone.state');
  const carplay = useTopic('carplay.state');
  const update = useTopic('system.update');
  const open = Object.values(doors).some(Boolean);

  const shortcuts = [
    ['radio', 'Radio', 'radio'],
    ['phone', 'Phone', 'phone', phone?.connection === 'connected' ? 'ok' : null],
    ['link', 'Full Link', 'fulllink', carplay?.status === 'connected' ? 'ok' : null],
    ['parking', 'Parking', ['vehicle', 'parking']],
    ['light', 'Ambient', ['vehicle', 'comfort']],
    ['settings', 'Settings', 'settings', update?.status === 'available' ? 'accent' : null],
  ];

  return (
    <div className="dash">
      <section className="dash-card dash-car" onClick={() => onNavigate('vehicle', 'driving')}>
        <div className="dash-car-head">
          <span>
            <small>Speed</small>
            <strong>{speed !== undefined ? Math.round(speed) : '–'}</strong>
            <em>km/h</em>
          </span>
          {codes.length > 0 && (
            <span className="dash-alert">
              <Icon name="warning" size={16} /> {codes.length}
            </span>
          )}
        </div>
        <CarArt className="dash-car-art" />
        <div className="dash-stats" onClick={(e) => e.stopPropagation()}>
          <Stat icon="thermo" label="Coolant" value={coolant !== undefined ? `${coolant}°` : '–'} warn={coolant > 112} onClick={() => onNavigate('vehicle', 'driving')} />
          <Stat icon="fuel" label="Fuel" value={fuel !== undefined ? `${Math.round(fuel)}%` : '–'} warn={fuel < 12} onClick={() => onNavigate('vehicle', 'driving')} />
          <Stat
            icon={open ? 'warning' : locked ? 'lock' : 'unlock'}
            label="Doors"
            value={open ? 'Open' : locked ? 'Locked' : 'Unlocked'}
            warn={open}
            onClick={() => onNavigate('vehicle', 'comfort')}
          />
        </div>
      </section>
      <div className="dash-right">
        <NowPlaying onNavigate={onNavigate} />
        <button className="dash-card dash-trip" onClick={() => onNavigate('vehicle', 'driving')}>
          <span>
            <strong>{trip?.distanceKm ?? 0}</strong> km
          </span>
          <i />
          <span>
            <strong>{Math.floor((trip?.durationS ?? 0) / 60)}</strong> min
          </span>
          <i />
          <span>
            <small>Average</small> <strong>{trip?.avgSpeed ?? 0}</strong> km/h
          </span>
          <span className="dash-trip-odo">
            <small>Total</small> {odometer !== undefined ? `${odometer.toLocaleString()} km` : '–'}
          </span>
        </button>
        <div className="dash-shortcuts">
          {shortcuts.map(([icon, label, target, badge]) => (
            <button key={label} className="dash-shortcut" onClick={() => (Array.isArray(target) ? onNavigate(...target) : onNavigate(target))}>
              <span className="tile-icon">
                <Icon name={icon} size={26} />
                {badge && <i className={`tile-badge ${badge}`} />}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home(props) {
  const [layout] = useHomeLayout();
  return layout === 'dashboard' ? <DashboardHome {...props} /> : <TileHome {...props} />;
}
