import type { AreaTechnicalRelationship, AreaView } from '@/application/workspace-area';

/**
 * Explicitly recorded infrastructure, such as feature flags and sign-in.
 * Their lines stay in the model and the inspector; the canvas only draws them on request or focus.
 * A business provider does not become plumbing merely because many systems use it.
 */
export function platformComponents(view: AreaView): ReadonlySet<string> {
  return new Set(
    view.systems.flatMap((system) =>
      system.components.filter((component) => component.infrastructure === true).map((c) => c.id),
    ),
  );
}

export function isPlatformLine(
  relations: readonly AreaTechnicalRelationship[] | undefined,
  platform: ReadonlySet<string>,
): boolean {
  return (
    relations !== undefined &&
    relations.length > 0 &&
    relations.every((relation) => platform.has(relation.to))
  );
}
