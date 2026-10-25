import { useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';
import { usePlayer } from '../player.js';

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

export default function Home({ onNavigate }) {
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
