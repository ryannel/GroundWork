// The arrow keys move between screens, unless a screen walks something step by step: then the walk takes them
// first and lets them through only at its ends. D switches the walk between today and the plan, where it can.

interface Walker {
  /** Moves one stop; false at the end of the walk. */
  readonly move: (by: -1 | 1) => boolean;
  readonly toggleMode?: () => void;
  /** The title of the stop one step away, or null at the end; the pager offers it. */
  readonly beside?: (by: -1 | 1) => string | null;
  /** Where the walk stands, in words; the progress strip shows it. */
  readonly here?: () => string | null;
}

let active: Walker | null = null;
let arrival: { readonly href: string; readonly from: -1 | 1 } | null = null;
const listeners = new Set<() => void>();

const trimmed = (path: string): string => (path.endsWith('/') ? path.slice(0, -1) : path);

/** Tells whoever shows the walk's place (the pager) that it moved. */
export function walkMoved(): void {
  for (const listener of listeners) listener();
}

/** Calls `listener` whenever the walk moves or another takes the keys; returns the way to stop. */
export function watchWalk(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Makes the walk the one the keys drive, until the returned function lets go. */
export function holdKeys(walker: Walker): () => void {
  active = walker;
  walkMoved();
  return () => {
    if (active !== walker) return;
    active = null;
    walkMoved();
  };
}

/** True when a walk took the step. */
export function walkMove(by: -1 | 1): boolean {
  return active?.move(by) ?? false;
}

/** True when a walk switched its view. */
export function walkToggle(): boolean {
  if (active?.toggleMode === undefined) return false;
  active.toggleMode();
  return true;
}

/** The title of the walk's stop one step away, or null when there is none and the step leaves the screen. */
export function walkBeside(by: -1 | 1): string | null {
  return active?.beside?.(by) ?? null;
}

/** Where the walk on the screen stands, or null when nothing is walked. */
export function walkHere(): string | null {
  return active?.here?.() ?? null;
}

/** Notes that the reader is leaving for a screen by stepping, so a walk there opens at the near end. */
export function leaveFor(href: string, by: -1 | 1): void {
  arrival = { href, from: by };
}

/** How the reader arrived at the screen at `href`: -1 when stepping back into it, 1 otherwise. */
export function arrivedFrom(href: string): -1 | 1 {
  const from = arrival !== null && trimmed(arrival.href) === trimmed(href) ? arrival.from : 1;
  arrival = null;
  return from;
}
