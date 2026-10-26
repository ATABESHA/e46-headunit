import { useEffect } from 'react';
import { getPref, usePref } from './prefs.js';

/**
 * Styles (Settings → Display, or the "Style" button on the home screen).
 * A style is more than colours: it sets
 *   shell    where the menu sits: "side" (left column), "rail" (round buttons
 *            on the right), "dock" (bar at the bottom), "tabs" (tabs in the
 *            top bar), "float" (floating pill over a full-screen home),
 *            "split" (menu split left and right, like a cockpit)
 *   home     which home screen (screens/home/)
 *   cluster  which instrument cluster design (cluster/faces/)
 * Colours and shapes are in themes.css.
 */
export const THEMES = [
  { id: 'media', name: 'Media System', description: 'The first design: Ibiza layout, black with copper', swatch: ['#0b0b0c', '#e0823d'], shell: 'side', home: 'tiles', cluster: 'classic' },
  { id: 'design1', name: 'Design1', description: 'Slate grey and blue, car from above', swatch: ['#22252f', '#2d7bff'], shell: 'side', home: 'design1', cluster: 'halo' },
  { id: 'panorama', name: 'Panorama', description: 'Black glass, blue glow, three big panels', swatch: ['#020409', '#3a8bff'], shell: 'rail', home: 'panorama', cluster: 'aura' },
  { id: 'studio', name: 'Studio', description: 'Light: white cards floating over the map', swatch: ['#e9ebee', '#111111'], shell: 'float', home: 'studio', cluster: 'capsule' },
  { id: 'slate', name: 'Slate', description: 'Phone-like: widgets, song list, bottom dock', swatch: ['#15171c', '#7c5cff'], shell: 'dock', home: 'slate', cluster: 'mono' },
  { id: 'velocity', name: 'Velocity', description: 'Top tabs, Eco / Comfort / Sport drive modes', swatch: ['#0a0a0b', '#ff2d3a'], shell: 'tabs', home: 'velocity', cluster: 'vortex' },
  { id: 'cockpit', name: 'Neon Cockpit', description: 'Round neon instruments, orange and blue', swatch: ['#030405', '#ff7a1a'], shell: 'split', home: 'cockpit', cluster: 'rings' },
];

/** Instrument cluster designs. "auto" = the one that belongs to the style. */
export const CLUSTER_FACES = [
  ['auto', 'Match style'],
  ['classic', 'Classic dials'],
  ['halo', 'Halo'],
  ['aura', 'Aura'],
  ['capsule', 'Capsule'],
  ['mono', 'Mono'],
  ['vortex', 'Vortex'],
  ['rings', 'Neon rings'],
];

export const HOME_LAYOUTS = [
  ['auto', 'Match style'],
  ['tiles', 'Tiles'],
  ['design1', 'Design1'],
  ['panorama', 'Panorama'],
  ['studio', 'Studio'],
  ['slate', 'Slate'],
  ['velocity', 'Velocity'],
  ['cockpit', 'Neon Cockpit'],
];

/** Drive modes (Velocity home, Capsule cluster): they change the colours. */
export const DRIVE_MODES = [
  ['eco', 'Eco'],
  ['comfort', 'Comfort'],
  ['sport', 'Sport'],
];

// Styles that were renamed keep working.
const RENAMED = {
  idrive: 'panorama',
  midnight: 'panorama',
  classic: 'media',
  msport: 'velocity',
  mono: 'slate',
  daylight: 'studio',
  neon: 'cockpit',
};

const valid = (id) => {
  const name = RENAMED[id] ?? id;
  return THEMES.some((t) => t.id === name) ? name : 'media';
};

export const themeInfo = (id) => THEMES.find((t) => t.id === valid(id));

/** Call once before the first render so the app never flashes the wrong style. */
export function applySavedTheme() {
  document.documentElement.dataset.theme = valid(getPref('theme', 'media'));
  document.documentElement.dataset.drive = validMode(getPref('drive.mode', 'comfort'));
}

const validMode = (m) => (DRIVE_MODES.some(([id]) => id === m) ? m : 'comfort');

export function useDriveMode() {
  const [mode, setMode] = usePref('drive.mode', 'comfort');
  const current = validMode(mode);
  useEffect(() => {
    document.documentElement.dataset.drive = current;
  }, [current]);
  return [current, setMode];
}

/** The next item in a list, round and round (for the design buttons). */
export function nextId(list, id) {
  const ids = list.map((x) => (Array.isArray(x) ? x[0] : x.id)).filter((x) => x !== 'auto');
  return ids[(ids.indexOf(id) + 1) % ids.length];
}

/** Settings → Display → "Design buttons" (temporary, for trying the styles). */
export function useDesignButtons() {
  return usePref('design.buttons', true);
}

export function useTheme() {
  const [theme, setTheme] = usePref('theme', 'media');
  useEffect(() => {
    document.documentElement.dataset.theme = valid(theme);
  }, [theme]);
  return [valid(theme), setTheme];
}

/** The cluster face to show: the chosen one, or the style's own. */
export function useClusterFace() {
  const [theme] = usePref('theme', 'media');
  const [face, setFace] = usePref('cluster.face', 'auto');
  const chosen = CLUSTER_FACES.some(([id]) => id === face) ? face : 'auto';
  return [chosen === 'auto' ? themeInfo(theme).cluster : chosen, chosen, setFace];
}

export function useHomeLayout() {
  const [theme] = usePref('theme', 'media');
  const [layout, setLayout] = usePref('home.layout', 'auto');
  const chosen = HOME_LAYOUTS.some(([id]) => id === layout) ? layout : 'auto';
  return [chosen === 'auto' ? themeInfo(theme).home : chosen, chosen, setLayout];
}
