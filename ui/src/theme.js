import { useEffect } from 'react';
import { getPref, usePref } from './prefs.js';

export const THEMES = [
  { id: 'media', name: 'Media System', description: 'Ibiza-style layout, black with copper', swatch: ['#0b0b0c', '#e0823d'] },
  { id: 'classic', name: 'E46 Classic', description: 'Orange on black, like the original dashboard', swatch: ['#0b0d10', '#ff6a1a'] },
  { id: 'idrive', name: 'Modern iDrive', description: 'Deep blue, glass panels, light numbers', swatch: ['#0b1424', '#3d8bff'] },
  { id: 'msport', name: 'M Sport', description: 'Carbon black, red, M stripes', swatch: ['#08080a', '#e7222e'] },
];

const valid = (id) => (THEMES.some((t) => t.id === id) ? id : 'media');

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
