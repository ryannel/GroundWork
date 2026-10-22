import type { SystemMapInput } from '@/application/plan-viz-system-map-types';
import type { SystemTier } from '@/domain/workspace';

// The tier each part's card sits in on a map read by tier. Each part goes with its system, except an outside
// party several systems talk to, which is upstream in its own right.

/** The outside parties more than one system talks to: each is a source in its own right, not one system's detail. */
export function sharedOutside(input: SystemMapInput): ReadonlySet<string> {
  const home = new Map(input.services.map((s) => [s.id, s.system]));
  const outside = new Set(input.services.filter((s) => s.kind === 'external').map((s) => s.id));
  const shared = new Set<string>();
  for (const e of input.edges) {
    for (const [mine, other] of [
      [e.to, e.from],
      [e.from, e.to],
    ] as const) {
      if (outside.has(mine) && home.has(other) && home.get(other) !== home.get(mine)) {
        shared.add(mine);
      }
    }
  }
  return shared;
}

const authoredTier = (input: SystemMapInput, sys: string | null): SystemTier =>
  (sys === null ? undefined : input.tiers?.[sys]) ?? 'backend';

export interface PartTiers {
  /** The tier each part's card sits in, by service id. */
  readonly part: ReadonlyMap<string, SystemTier>;
  /** The tier each system's own card sits in. */
  readonly system: (sys: string | null) => SystemTier;
}

/** Each part's tier, and each system's. */
export function partTiers(input: SystemMapInput): PartTiers {
  const shared = sharedOutside(input);
  const system = (sys: string | null): SystemTier => authoredTier(input, sys);
  const part = new Map(
    input.services.map((s): [string, SystemTier] => [
      s.id,
      shared.has(s.id) ? 'upstream' : system(s.system),
    ]),
  );
  return { part, system };
}
