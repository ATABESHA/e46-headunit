import { usePref } from './prefs.js';

/**
 * One screen, both views: with only one screen connected (or in a browser),
 * the swap button flips this window between the head unit and the cluster.
 * With two screens the cluster also has its own window, as before.
 */
export function useView() {
  const [view, setView] = usePref('view.screen', 'headunit');
  const current = view === 'cluster' ? 'cluster' : 'headunit';
  return [current, () => setView(current === 'cluster' ? 'headunit' : 'cluster')];
}

/** Settings → Display → "Swap screens button". */
export function useSwapButton() {
  return usePref('swap.show', true);
}
