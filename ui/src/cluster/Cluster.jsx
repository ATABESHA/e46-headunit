import { useLayoutEffect, useRef } from 'react';
import { Icon } from '../icons.jsx';
import { useClusterFace, useTheme } from '../theme.js';
import { useSwapButton, useView } from '../view.js';
import { FxBackground, PerfHud, useFx } from '../fx.jsx';
import { useClock, useClusterData } from './shared.jsx';
import Classic from './faces/Classic.jsx';
import Sport from './faces/Sport.jsx';
import Halo from './faces/Halo.jsx';
import Minimal from './faces/Minimal.jsx';
import Neon from './faces/Neon.jsx';
import Turbine from './faces/Turbine.jsx';

// Designed for a 1920 x 720 cluster screen (common 12.3" size), scaled to any window.
const DESIGN = { width: 1920, height: 720 };

// Cluster designs (Settings → Display → Cluster). To add one: make a file in
// faces/, add it here and to CLUSTER_FACES in src/theme.js.
const FACES = { classic: Classic, sport: Sport, halo: Halo, minimal: Minimal, neon: Neon, turbine: Turbine };

function useFit(ref) {
  useLayoutEffect(() => {
    const apply = () => {
      const scale = Math.min(window.innerWidth / DESIGN.width, window.innerHeight / DESIGN.height);
      const el = ref.current;
      el.style.transform = `translate(${(window.innerWidth - DESIGN.width * scale) / 2}px, ${(window.innerHeight - DESIGN.height * scale) / 2}px) scale(${scale})`;
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [ref]);
}

/** swappable: shown in the head unit's window (one screen), with a button back. */
export default function Cluster({ swappable = false }) {
  useTheme(); // follows the style chosen on the head unit (Settings → Display)
  const [fx] = useFx();
  const [face] = useClusterFace();
  const [, swap] = useView();
  const [swapButton] = useSwapButton();
  const ref = useRef(null);
  useFit(ref);
  const data = useClusterData();
  const now = useClock();
  const Face = FACES[face] ?? Classic;

  return (
    <div className="cluster-viewport">
      <div className={`cluster face-is-${face}`} ref={ref}>
        <FxBackground level={fx} />
        <Face data={data} now={now} />
      </div>
      {swappable && swapButton && (
        <button className="cluster-swap" onClick={swap} title="Back to the head unit" aria-label="Swap screens">
          <Icon name="swap" size={22} />
        </button>
      )}
      <PerfHud label="Cluster" />
    </div>
  );
}
