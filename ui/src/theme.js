import { useEffect, useState } from 'react';

export const THEMES = [
  { id: 'classic', name: 'E46 Classic', description: 'Orange on black, like the original dashboard', swatch: ['#0b0d10', '#ff6a1a'] },
  { id: 'idrive', name: 'Modern iDrive', description: 'Deep blue, glass panels, light numbers', swatch: ['#0b1424', '#3d8bff'] },
  { id: 'msport', name: 'M Sport', description: 'Carbon black, red, M stripes', swatch: ['#08080a', '#e7222e'] },
];

const KEY = 'e46.theme';

function read() {
  try {
    const saved = localStorage.getItem(KEY);
    return THEMES.some((t) => t.id === saved) ? saved : 'classic';
  } catch {
    return 'classic';
  }
}

/** Call once before the first render so the app never flashes the wrong style. */
export function applySavedTheme() {
  document.documentElement.dataset.theme = read();
}

export function useTheme() {
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Storage unavailable: the choice just won't be remembered.
    }
  }, [theme]);
  return [theme, setTheme];
}
