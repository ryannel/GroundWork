import type { AreaComponentView, AreaSystemView } from '@/application/workspace-area';
import type { LandscapeValueFlow } from '@/domain/landscape';

/** Ownership was checked across the workspace by withAreaResources; never infer it from this filtered view. */
export function valueFlowComponents(system: AreaSystemView): readonly AreaComponentView[] {
  const parents = new Set(
    system.components
      .filter((component) => component.kind !== 'database' && component.kind !== 'queue')
      .map((component) => component.id),
  );
  return system.components
    .filter((component) => !parents.has(component.parentComponent ?? ''))
    .map((component) => ({
      ...component,
      attachments: system.components.filter(
        (resource) => resource.parentComponent === component.id,
      ),
    }));
}

export function componentOwners(
  components: readonly AreaComponentView[],
): ReadonlyMap<string, string> {
  return new Map(
    components.flatMap((component) => [
      [component.id, component.id] as const,
      ...(component.attachments ?? []).map((resource) => [resource.id, component.id] as const),
    ]),
  );
}

/** A folded queue stays in the narrative through its owning service; each service is placed once. */
export function componentBands(
  components: readonly AreaComponentView[],
  narrative: LandscapeValueFlow,
): LandscapeValueFlow['bands'] {
  const owners = componentOwners(components);
  const seen = new Set<string>();
  return narrative.bands
    .map((band) => ({
      ...band,
      nodes: band.nodes.flatMap((node) => {
        const component = owners.get(node.component);
        if (component === undefined || seen.has(component)) return [];
        seen.add(component);
        return [{ ...node, component }];
      }),
    }))
    .filter((band) => band.nodes.length > 0);
}
