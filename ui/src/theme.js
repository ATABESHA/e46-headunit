import { useEffect } from 'react';
import { getPref, usePref } from './prefs.js';

/**
 * Styles (Settings → Display). Each style sets the colours of both screens
 * (themes.css), and picks a cluster face and a home screen to go with it.
 * Both can also be chosen separately in Settings.
 *
 *   cluster  which instrument cluster design: see CLUSTER_FACES
 *   home     "tiles" (8 big buttons) or "dashboard" (car picture + music)
 */
export const THEMES = [
  { id: 'media', name: 'Media System', description: 'Ibiza layout, black with copper', swatch: ['#0b0b0c', '#e0823d'], cluster: 'classic', home: 'tiles' },
  { id: 'classic', name: 'E46 Classic', description: 'Orange on black, like the original dash', swatch: ['#0b0d10', '#ff6a1a'], cluster: 'classic', home: 'tiles' },
  { id: 'msport', name: 'M Sport', description: 'Carbon black, red, M stripes', swatch: ['#120607', '#e7222e'], cluster: 'sport', home: 'dashboard' },
  { id: 'midnight', name: 'Midnight', description: 'Deep navy, soft blue glow', swatch: ['#0c1220', '#2f7bff'], cluster: 'halo', home: 'dashboard' },
  { id: 'mono', name: 'Monochrome', description: 'Pure black and white, thin lines', swatch: ['#000000', '#f2f2f2'], cluster: 'minimal', home: 'dashboard' },
  { id: 'daylight', name: 'Daylight', description: 'Light, for bright days', swatch: ['#eceef1', '#111111'], cluster: 'minimal', home: 'dashboard' },
  { id: 'neon', name: 'Neon', description: 'Black, orange and electric blue', swatch: ['#050608', '#ff6a1a'], cluster: 'neon', home: 'tiles' },
];

/** Instrument cluster designs. "auto" = the one that belongs to the style. */
export const CLUSTER_FACES = [
  ['auto', 'Match style'],
  ['classic', 'Classic dials'],
  ['sport', 'Sport capsule'],
  ['halo', 'Halo'],
  ['minimal', 'Minimal'],
  ['neon', 'Neon rings'],
  ['turbine', 'Turbine'],
];

export const HOME_LAYOUTS = [
  ['auto', 'Match style'],
  ['tiles', 'Tiles'],
  ['dashboard', 'Car dashboard'],
];

// Styles that were renamed keep working.
const RENAMED = { idrive: 'midnight' };

const valid = (id) => {
  const name = RENAMED[id] ?? id;
  return THEMES.some((t) => t.id === name) ? name : 'media';
};

export const themeInfo = (id) => THEMES.find((t) => t.id === valid(id));

/** Call once before the first render so the app never flashes the wrong style. */
export function applySavedTheme() {
  document.documentElement.dataset.theme = valid(getPref('theme', 'media'));
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
