import { useEffect, useState } from 'react';
import { useConnected, useTopic } from './hub.js';
import { Icon } from './icons.jsx';
import Home from './screens/Home.jsx';
import Media from './screens/Media.jsx';
import CarPlay from './screens/CarPlay.jsx';
import Car from './screens/Car.jsx';
import Diagnostics from './screens/Diagnostics.jsx';
import Parking from './screens/Parking.jsx';
import Settings from './screens/Settings.jsx';

// To add your own screen: create it in screens/ and add one line here.
const SCREENS = [
  { id: 'home', label: 'Home', icon: 'home', component: Home },
  { id: 'media', label: 'Media', icon: 'media', component: Media },
  { id: 'carplay', label: 'CarPlay', icon: 'phone', component: CarPlay },
  { id: 'car', label: 'Car', icon: 'car', component: Car },
  { id: 'diag', label: 'Codes', icon: 'wrench', component: Diagnostics },
  { id: 'parking', label: 'Parking', icon: 'parking', component: Parking },
  { id: 'settings', label: 'Settings', icon: 'settings', component: Settings },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function StatusBar() {
  const now = useClock();
  const connected = useConnected();
  const outside = useTopic('vehicle.outsideTemp');
  const locked = useTopic('vehicle.locked');
  const codes = useTopic('diag.codes', []);

  return (
    <header className="statusbar">
      <div className="statusbar-time">
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="statusbar-items">
        {codes.length > 0 && (
          <span className="status-chip warn">
            <Icon name="wrench" size={16} /> {codes.length}
          </span>
        )}
        {locked !== undefined && (
          <span className="status-chip">
            <Icon name={locked ? 'lock' : 'unlock'} size={16} />
          </span>
        )}
        {outside !== undefined && (
          <span className="status-chip">
            <Icon name="thermo" size={16} /> {outside}°C
          </span>
        )}
        <span className={`status-dot ${connected ? 'ok' : 'bad'}`} title={connected ? 'Core connected' : 'Core not connected'} />
      </div>
    </header>
  );
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const reverse = useTopic('vehicle.reverse', false);
  const [parkingDismissed, setParkingDismissed] = useState(false);

  // Reverse gear opens the parking view automatically. Closing it lasts
  // until the next time reverse is engaged.
  useEffect(() => {
    if (!reverse) setParkingDismissed(false);
  }, [reverse]);
  const showParkingOverlay = reverse && !parkingDismissed && screen !== 'parking';

  const Current = SCREENS.find((s) => s.id === screen).component;

  return (
    <div className="app">
      <nav className="nav">
        {SCREENS.map((s) => (
          <button
            key={s.id}
            className={`nav-item ${screen === s.id ? 'active' : ''}`}
            onClick={() => setScreen(s.id)}
          >
            <Icon name={s.icon} size={28} />
            <span>{s.label}</span>
          </button>
        ))}
      </nav>
      <div className="main">
        <StatusBar />
        <main className="content">
          <Current onNavigate={setScreen} />
        </main>
        {showParkingOverlay && (
          <div className="overlay">
            <Parking onClose={() => setParkingDismissed(true)} />
          </div>
        )}
      </div>
    </div>
  );
}
