import type { SystemMapInput } from '@/application/plan-viz-system-map-types';

// On a domain's map, the systems of other domains sit in a band beneath the domain's own, each under the column
// of its tier so its lines stay short, grouped by the domain it belongs to.

export interface Outside {
  /** The cards of other domains, by unit id. */
  readonly units: ReadonlySet<string>;
  /** The domain each of them belongs to, by name. */
  readonly domainOf: (unit: string) => string;
}

const NO_OUTSIDE: Outside = { units: new Set(), domainOf: () => '' };

/** Which units are outside the focus, and their domains. Empty unless the map is read system by system. */
export function outsideOf(
  input: SystemMapInput,
  tiered: boolean,
  membersOf: (unit: string) => readonly string[],
): Outside {
  if (!tiered || input.focus === null) return NO_OUTSIDE;
  const focus = new Set(input.focus);
  const sysOf = new Map(input.services.map((s) => [s.id, s.system]));
  const place = new Map(input.systems.map((s) => [s.id, s.place ?? '']));
  const homeOf = (unit: string): string | null =>
    place.has(unit) ? unit : (sysOf.get(unit) ?? null);
  const inFocus = (id: string): boolean => {
    const home = homeOf(id);
    return focus.has(id) || (home !== null && focus.has(home));
  };
  const units = new Set(
    [...new Set(input.services.map((s) => s.id))]
      .flatMap((id) => [id, sysOf.get(id) ?? id])
      .filter((u) => !membersOf(u).some(inFocus) && !inFocus(u)),
  );
  return { units, domainOf: (unit) => place.get(homeOf(unit) ?? '') ?? '' };
}

/** A column with the domain's own cards first, then the others grouped by domain, each group kept in order. */
export function ownFirst(list: readonly string[], outside: Outside): string[] {
  const own = list.filter((u) => !outside.units.has(u));
  const rest = list.filter((u) => outside.units.has(u));
  const domains = [...new Set(rest.map(outside.domainOf))].toSorted((a, b) => a.localeCompare(b));
  return [...own, ...domains.flatMap((d) => rest.filter((u) => outside.domainOf(u) === d))];
}
