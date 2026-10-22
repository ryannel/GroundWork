import type { SystemMapInput } from '@/application/plan-viz-system-map-types';

// Plumbing every system leans on (feature flags, sign-in, error tracking) says nothing about where the business's
// data comes from, so the map leaves it out until the reader asks for it.

/** The components marked as infrastructure, by id. */
export function infrastructureOf(input: SystemMapInput): ReadonlySet<string> {
  return new Set(input.services.filter((s) => s.infrastructure === true).map((s) => s.id));
}

/** The map without its infrastructure and without the lines and steps that reach it. */
export function withoutInfrastructure(input: SystemMapInput): SystemMapInput {
  const gone = infrastructureOf(input);
  if (gone.size === 0) return input;
  const kept = (ends: { readonly from: string; readonly to: string }): boolean =>
    !gone.has(ends.from) && !gone.has(ends.to);
  return {
    ...input,
    services: input.services.filter((s) => !gone.has(s.id)),
    edges: input.edges.filter(kept),
    steps: input.steps.filter(kept),
    focus: input.focus === null ? null : input.focus.filter((id) => !gone.has(id)),
  };
}
