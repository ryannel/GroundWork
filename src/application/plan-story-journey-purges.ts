import type { Model } from '@/application/plan/derive';

// What empties each cache an operation passes through: the events that purge it, or else a timer.

export interface PurgeRow {
  readonly store: string;
  /** The events that empty it; none when it only expires. */
  readonly events: readonly string[];
  /** What to say when no event does, or null when one does. */
  readonly expires: string | null;
  /** How the store says it is purged, in its own words. */
  readonly mechanism: string;
}

export interface Purges {
  readonly rows: readonly PurgeRow[];
  /** The flow that does the purging, when a step of one is named. */
  readonly flow: string | null;
}

/** How long a layer keeps a response that no event purges. */
export function expiryOf(state: string, ttl: number | null): string {
  if (state === 'blocked') return 'keeps nothing of this operation';
  return ttl === null || ttl === 0 ? 'expires on a timer' : `expires after ${String(ttl)} s`;
}

export function purgesOf(model: Model, opId: string): Purges {
  const layers = model.cachePath(opId, 'asIs', 'cold').layers;
  const rows = layers.map((layer): PurgeRow => {
    const node = model.asIs.get(layer.store);
    return {
      store: layer.store,
      events: layer.invalidatedBy,
      expires: layer.invalidatedBy.length > 0 ? null : expiryOf(layer.state, layer.ttl),
      mechanism: node?.$type === 'store' ? (node.purge ?? '') : '',
    };
  });
  const steps = layers.flatMap((layer) => layer.purgedIn);
  const [first] = steps;
  return { rows, flow: first === undefined ? null : (first.split('#')[0] ?? null) };
}
