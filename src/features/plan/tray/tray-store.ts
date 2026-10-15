// The changes-ahead tray's pins: things the reader met while walking today's journey that the plan will change.
// They are kept per plan in the browser, so the tray outlasts a reload and a closed tab.

export interface Pin {
  readonly id: string;
  /** The screen where the reader met it. */
  readonly from: string;
  /** Whether the reader has since opened the screen that shows how it changes. */
  readonly seen: boolean;
}

const listeners = new Set<() => void>();
const cache = new Map<string, readonly Pin[]>();
const NONE: readonly Pin[] = [];
let open = false;

const keyOf = (plan: string): string => `groundwork:ahead:${plan}`;

/** The plan a path is in, as `<workspace>/<slug>`; null off a plan. */
export function planOfPath(path: string): string | null {
  const [, workspace, plans, slug] = path.split('/');
  if (plans !== 'plans' || workspace === undefined || workspace === '') return null;
  return slug === undefined || slug === '' ? null : `${workspace}/${slug}`;
}

const isPin = (x: unknown): x is Pin =>
  typeof x === 'object' &&
  x !== null &&
  'id' in x &&
  typeof x.id === 'string' &&
  'from' in x &&
  typeof x.from === 'string' &&
  'seen' in x &&
  typeof x.seen === 'boolean';

function emit(): void {
  for (const listener of listeners) listener();
}

export function pinsOf(plan: string): readonly Pin[] {
  const held = cache.get(plan);
  if (held !== undefined) return held;
  let pins = NONE;
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(keyOf(plan)) ?? '[]');
    if (Array.isArray(kept)) pins = kept.filter(isPin);
  } catch {
    // no storage: the pins last for this page only
  }
  cache.set(plan, pins);
  return pins;
}

function save(plan: string, pins: readonly Pin[]): void {
  cache.set(plan, pins);
  try {
    if (pins.length === 0) localStorage.removeItem(keyOf(plan));
    else localStorage.setItem(keyOf(plan), JSON.stringify(pins));
  } catch {
    // no storage: the pins last for this page only
  }
  emit();
}

/** Pins things met at `from`; one already pinned keeps where it was first met. */
export function addPins(plan: string, ids: readonly string[], from: string): void {
  const pins = pinsOf(plan);
  const have = new Set(pins.map((p) => p.id));
  const fresh = [...new Set(ids)].filter((id) => id !== '' && !have.has(id));
  if (fresh.length > 0) save(plan, [...pins, ...fresh.map((id) => ({ id, from, seen: false }))]);
}

/** Ticks off the pins whose changes the reader has now seen. */
export function markSeen(plan: string, seen: (pin: Pin) => boolean): void {
  const pins = pinsOf(plan);
  if (!pins.some((p) => !p.seen && seen(p))) return;
  save(
    plan,
    pins.map((p) => (!p.seen && seen(p) ? { ...p, seen: true } : p)),
  );
}

export function clearPins(plan: string): void {
  if (pinsOf(plan).length > 0) save(plan, NONE);
}

export const trayOpen = (): boolean => open;

export function setTrayOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
