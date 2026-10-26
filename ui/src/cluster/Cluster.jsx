import { useLayoutEffect, useRef } from 'react';
import { Icon } from '../icons.jsx';
import { CLUSTER_FACES, nextId, useClusterFace, useDesignButtons, useDriveMode, useTheme } from '../theme.js';
import { command, useTopic } from '../hub.js';
import { useSwapButton, useView } from '../view.js';
import { FxBackground, PerfHud, useFx } from '../fx.jsx';
import { useClock, useClusterData } from './shared.jsx';
import Classic from './faces/Classic.jsx';
import Halo from './faces/Halo.jsx';
import Aura from './faces/Aura.jsx';
import Capsule from './faces/Capsule.jsx';
import Mono from './faces/Mono.jsx';
import Vortex from './faces/Vortex.jsx';
import Rings from './faces/Rings.jsx';

// Designed for a 1920 x 720 cluster screen (common 12.3" size), scaled to any window.
const DESIGN = { width: 1920, height: 720 };

// Cluster designs (Settings → Display → Cluster). To add one: make a file in
// faces/, add it here and to CLUSTER_FACES in src/theme.js.
const FACES = { classic: Classic, halo: Halo, aura: Aura, capsule: Capsule, mono: Mono, vortex: Vortex, rings: Rings };

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
  useDriveMode();
  const [face, , setFace] = useClusterFace();
  const [designButtons] = useDesignButtons();
  const forced = useTopic('sim.lampsForced');
  const lightTest = forced ? Object.values(forced).some(Boolean) : false;
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
      {designButtons && (
        <div className="cluster-design">
          <button onClick={() => setFace(nextId(CLUSTER_FACES, face))} title="Try the next cluster design (temporary button)">
            Design: {CLUSTER_FACES.find(([id]) => id === face)?.[1]} ›
          </button>
          {forced !== undefined && (
            <button className={lightTest ? 'on' : ''} onClick={() => command('sim.lampsAll', { on: !lightTest }).catch(() => {})} title="Simulator: every warning light on / off">
              {lightTest ? 'All lights: ON' : 'Light test'}
            </button>
          )}
        </div>
      )}
      {swappable && swapButton && (
        <button className="cluster-swap" onClick={swap} title="Back to the head unit" aria-label="Swap screens">
          <Icon name="swap" size={22} />
        </button>
      )}
      <PerfHud label="Cluster" />
    </div>
  );
}
