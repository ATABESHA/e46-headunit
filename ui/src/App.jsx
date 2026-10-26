import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useConnected, useTopic } from './hub.js';
import { Icon } from './icons.jsx';
import { applySound } from './player.js';
import { usePref } from './prefs.js';
import { THEMES, nextId, themeInfo, useDesignButtons, useDriveMode, useHomeLayout, useTheme } from './theme.js';
import { FxBackground, PerfHud, useFx } from './fx.jsx';
import { restartApp } from './system.js';
import { useSwapButton, useView } from './view.js';
import Home from './screens/Home.jsx';
import Radio from './screens/Radio.jsx';
import Media from './screens/Media.jsx';
import Phone from './screens/Phone.jsx';
import FullLink from './screens/FullLink.jsx';
import Vehicle from './screens/Vehicle.jsx';
import Settings from './screens/Settings.jsx';
import Parking from './screens/Parking.jsx';
import { CallOverlay, Splash, Toasts, VolumeOverlay } from './overlays.jsx';

// Main menu, like the Media System's function buttons.
// To add your own screen: create it in screens/ and add one line here.
export const SCREENS = [
  { id: 'home', label: 'Home', icon: 'home', component: Home },
  { id: 'radio', label: 'Radio', icon: 'radio', component: Radio },
  { id: 'media', label: 'Media', icon: 'media', component: Media },
  { id: 'phone', label: 'Phone', icon: 'phone', component: Phone },
  { id: 'fulllink', label: 'Full Link', icon: 'link', component: FullLink },
  { id: 'vehicle', label: 'Vehicle', icon: 'car', component: Vehicle },
  { id: 'settings', label: 'Settings', icon: 'settings', component: Settings },
];

// The design is made for the Ibiza's 8.25" screen: 1082 x 480.
export const DESIGN = { width: 1082, height: 480 };

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function StatusBar({ title, center, home }) {
  const now = useClock();
  const connected = useConnected();
  const [clock24] = usePref('clock24', true);
  const outside = useTopic('vehicle.outsideTemp');
  const codes = useTopic('diag.codes', []);
  const phone = useTopic('phone.state');
  const carplay = useTopic('carplay.state');
  const volume = useTopic('audio.volume');
  const [, swap] = useView();
  const [swapButton] = useSwapButton();
  const [theme, setTheme] = useTheme();
  const [, , setHome] = useHomeLayout();
  const [designButtons] = useDesignButtons();

  return (
    <header className="statusbar">
      <div className="statusbar-left">
        {/* Your logo: replace ui/public/logo.svg */}
        <img className="logo" src="./logo.svg" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
        <span className="statusbar-time">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !clock24 })}</span>
      </div>
      <div className="statusbar-title">{center ?? title}</div>
      <div className="statusbar-items">
        {home && designButtons && (
          <button
            className="design-btn"
            title="Try the next style (temporary button: Settings → Display hides it)"
            onClick={() => {
              setHome('auto');
              setTheme(nextId(THEMES, theme));
            }}
          >
            <Icon name="display" size={16} /> {themeInfo(theme).name} <b>›</b>
          </button>
        )}
        {codes.length > 0 && (
          <span className="status-chip warn" title="Fault codes">
            <Icon name="warning" size={16} /> {codes.length}
          </span>
        )}
        {carplay?.status === 'connected' && (
          <span className="status-chip accent" title={carplay.phone}>
            <Icon name="link" size={16} />
          </span>
        )}
        {phone?.connection === 'connected' && (
          <span className="status-chip" title={phone.device}>
            <Icon name="signal" size={16} />
            <span className="battery">
              <i style={{ width: `${phone.battery ?? 0}%` }} />
            </span>
          </span>
        )}
        {volume?.muted && (
          <span className="status-chip">
            <Icon name="mute" size={16} />
          </span>
        )}
        {outside !== undefined && (
          <span className="status-chip">
            <Icon name="thermo" size={16} /> {outside}°C
          </span>
        )}
        <span className={`status-dot ${connected ? 'ok' : 'bad'}`} title={connected ? 'Core connected' : 'Core not connected'} />
        {swapButton && (
          <button className="swap-btn" onClick={swap} title="Show the instrument cluster on this screen" aria-label="Swap screens">
            <Icon name="swap" size={18} />
          </button>
        )}
      </div>
    </header>
  );
}

/** Scales the 1082x480 design to the window (or fills the window). */
function useScreenFit(rootRef) {
  const [mode] = usePref('screen.mode', 'fit');
  useLayoutEffect(() => {
    const root = rootRef.current;
    const apply = () => {
      if (mode === 'fill') {
        root.style.width = '100vw';
        root.style.height = '100vh';
        root.style.transform = '';
        return;
      }
      const size = mode === '800' ? { width: 800, height: 480 } : DESIGN;
      const scale = Math.min(window.innerWidth / size.width, window.innerHeight / size.height);
      root.style.width = `${size.width}px`;
      root.style.height = `${size.height}px`;
      root.style.transform = `translate(${(window.innerWidth - size.width * scale) / 2}px, ${(window.innerHeight - size.height * scale) / 2}px) scale(${scale})`;
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [mode, rootRef]);
}

function NavItems({ items, screen, navigate, update, carplay }) {
  return items.map((s) => (
    <button key={s.id} className={`nav-item ${screen === s.id ? 'active' : ''}`} onClick={() => navigate(s.id)}>
      <span className="nav-icon">
        <Icon name={s.icon} size={26} />
      </span>
      <span className="nav-label">{s.label}</span>
      {s.id === 'settings' && update?.status === 'available' && <i className="nav-badge" title="Update available" />}
      {s.id === 'fulllink' && carplay?.status === 'connected' && <i className="nav-badge ok" title="Phone connected" />}
    </button>
  ));
}

export default function App() {
  const [theme] = useTheme();
  useDriveMode();
  const shell = themeInfo(theme).shell;
  const [fx] = useFx();
  const rootRef = useRef(null);
  useScreenFit(rootRef);

  const [screen, setScreen] = useState('home');
  const [tab, setTab] = useState(null); // optional sub-page, e.g. Vehicle → Parking
  const reverse = useTopic('vehicle.reverse', false);
  const update = useTopic('system.update');
  const carplay = useTopic('carplay.state');
  const hostUI = useTopic('carplay.hostUI');
  const sound = useTopic('audio.sound');
  const [autoParking] = usePref('parking.auto', true);
  const [parkingDismissed, setParkingDismissed] = useState(false);

  const navigate = (id, subTab = null) => {
    setScreen(id);
    setTab(subTab);
  };

  useEffect(() => applySound(sound), [sound]);

  // An update chose "restart later": do it a few seconds after the key is turned off.
  const [restartPending] = usePref('update.restartPending', false);
  const ignition = useTopic('vehicle.ignition');
  useEffect(() => {
    if (!restartPending || !ignition || ignition === 'run') return undefined;
    const timer = setTimeout(restartApp, 3000);
    return () => clearTimeout(timer);
  }, [restartPending, ignition]);

  // The "car" button inside CarPlay brings you back to the home screen.
  const firstHostUI = useRef(hostUI);
  useEffect(() => {
    if (hostUI !== undefined && hostUI !== firstHostUI.current) navigate('home');
  }, [hostUI]);

  // Reverse gear opens the parking view by itself. Closing it lasts until next time.
  useEffect(() => {
    if (!reverse) setParkingDismissed(false);
  }, [reverse]);
  const showParking = autoParking && reverse && !parkingDismissed && !(screen === 'vehicle' && tab === 'parking');

  const current = SCREENS.find((s) => s.id === screen);
  const Current = current.component;
  const phoneFullscreen = screen === 'fulllink' && carplay?.status === 'connected';
  const navProps = { screen, navigate, update, carplay };

  return (
    <div className="viewport">
      <div className={`app shell-${shell}`} ref={rootRef}>
        <FxBackground level={fx} />
        {shell === 'split' ? (
          <nav className="nav nav-left">
            <NavItems items={SCREENS.slice(0, 4)} {...navProps} />
          </nav>
        ) : (
          shell !== 'tabs' && (
            <nav className="nav">
              <NavItems items={SCREENS} {...navProps} />
            </nav>
          )
        )}
        <div className="main">
          {!phoneFullscreen && (
            <StatusBar
              title={screen === 'home' ? '' : current.label}
              home={screen === 'home'}
              center={
                shell === 'tabs' ? (
                  <nav className="nav nav-tabs">
                    <NavItems items={SCREENS} {...navProps} />
                  </nav>
                ) : null
              }
            />
          )}
          <main className={`content ${phoneFullscreen ? 'bleed' : ''} screen-${screen}`}>
            <Current key={screen} onNavigate={navigate} tab={tab} onTab={setTab} />
          </main>
          {showParking && (
            <div className="overlay">
              <Parking onClose={() => setParkingDismissed(true)} />
            </div>
          )}
          <CallOverlay onOpenPhone={() => navigate('phone')} />
          <VolumeOverlay />
          <Toasts />
        </div>
        {shell === 'split' && (
          <nav className="nav nav-right">
            <NavItems items={SCREENS.slice(4)} {...navProps} />
          </nav>
        )}
        <PerfHud label="Head unit" />
        <Splash />
      </div>
    </div>
  );
}

