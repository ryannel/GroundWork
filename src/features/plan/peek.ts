// Holding ⌥ on a What changes screen shows today: the plan's new parts fade out until the key comes up. The keys
// set it; the screen's peek wrapper reads it.

let held = false;
const listeners = new Set<() => void>();

/** Whether ⌥ is held for a peek at today. */
export const peekHeld = (): boolean => held;

export function holdPeek(on: boolean): void {
  if (on === held) return;
  held = on;
  for (const listener of listeners) listener();
}

export function watchPeek(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Marks a screen able to peek at today; ⌥ does nothing elsewhere. */
export const PEEK_ROOT = '[data-peek-root]';
