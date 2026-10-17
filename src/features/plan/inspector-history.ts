import { hashFor, inspectedIn } from '@/application/plan-pages-hash';
import { historyState } from '@/ui/address-bar';

// The open inspector is the address hash (#i-svc-orders), so the browser's own history is the inspector's:
// opening or hopping pushes an entry, Back steps out, and a copied address reopens the same thing.

const listeners = new Set<() => void>();
const notify = (): void => {
  for (const listener of listeners) listener();
};

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  globalThis.addEventListener('popstate', listener);
  globalThis.addEventListener('hashchange', listener);
  return () => {
    listeners.delete(listener);
    globalThis.removeEventListener('popstate', listener);
    globalThis.removeEventListener('hashchange', listener);
  };
}

export const openId = (): string | null => inspectedIn(globalThis.location.hash);
export const serverOpenId = (): null => null;

/** How many entries back the page without the panel is; null when the address was pasted or reloaded cold. */
function depth(): number | null {
  const state = historyState();
  if (typeof state !== 'object' || state === null || !('inspector' in state)) return null;
  return typeof state.inspector === 'number' ? state.inspector : null;
}

/** The things opened before this one, oldest first, for the crumbs. */
export function trail(): readonly string[] {
  const state = historyState();
  if (typeof state !== 'object' || state === null || !('trail' in state)) return [];
  return Array.isArray(state.trail)
    ? state.trail.filter((x: unknown): x is string => typeof x === 'string')
    : [];
}

export function open(id: string): void {
  const current = openId();
  if (current === id) return;
  const before = depth();
  const fresh = current === null || before === null;
  const next = { inspector: fresh ? 1 : before + 1, trail: fresh ? [] : [...trail(), current] };
  globalThis.history.pushState(next, '', hashFor(id));
  notify();
}

/** Step back to the crumb at this place in the trail. */
export function stepTo(index: number): void {
  globalThis.history.go(index - trail().length);
}

/** An address that arrives with the panel open becomes two entries, so closing has somewhere to go. */
export function adopt(): void {
  const id = openId();
  if (id === null || depth() !== null) return;
  globalThis.history.replaceState(
    null,
    '',
    globalThis.location.pathname + globalThis.location.search,
  );
  globalThis.history.pushState({ inspector: 1 }, '', hashFor(id));
}

/** Whether the panel has an earlier thing to step back to. */
export function canStepBack(): boolean {
  return (depth() ?? 0) > 1;
}

export function stepBack(): void {
  globalThis.history.back();
}

/** Close the panel and leave the history as it was before it opened. */
export function close(): void {
  const current = depth();
  if (current === null) {
    globalThis.history.replaceState(
      null,
      '',
      globalThis.location.pathname + globalThis.location.search,
    );
    notify();
    return;
  }
  globalThis.history.go(-current);
}
