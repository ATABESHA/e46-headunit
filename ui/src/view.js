import { usePref } from './prefs.js';

/**
 * The instrument cluster is paused for now: no swap button, the head unit
 * always shows. Set to true to bring it back (also CLUSTER_ENABLED in
 * ui/electron/main.cjs).
 */
export const CLUSTER_ENABLED = false;

/**
 * One screen, both views: with only one screen connected (or in a browser),
 * the swap button flips this window between the head unit and the cluster.
 * With two screens the cluster also has its own window, as before.
 */
export function useView() {
  const [view, setView] = usePref('view.screen', 'headunit');
  const current = CLUSTER_ENABLED && view === 'cluster' ? 'cluster' : 'headunit';
  return [current, () => setView(current === 'cluster' ? 'headunit' : 'cluster')];
}

/** Settings → Display → "Swap screens button". */
export function useSwapButton() {
  const [show, setShow] = usePref('swap.show', true);
  return [CLUSTER_ENABLED && show, setShow];
}
