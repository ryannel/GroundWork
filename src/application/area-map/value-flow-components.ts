import type { AreaComponentView, AreaSystemView } from '@/application/workspace-area';
import type { LandscapeValueFlow } from '@/domain/landscape';
import { plural } from '@/shared/text';

/** Fold explicitly named components into one card when all members are present in this system. */
function cardGroups(
  system: AreaSystemView,
  cards: LandscapeValueFlow['cards'],
): readonly AreaComponentView[] {
  const components = new Map(system.components.map((component) => [component.id, component]));
  const grouped = new Map<string, AreaComponentView>();
  for (const card of cards ?? []) {
    const members = new Set(card.members);
    const originals = [...members].flatMap((id) => {
      const component = components.get(id);
      return component === undefined ? [] : [component];
    });
    const id = `card:${card.id}`;
    const overlaps = originals.some(
      (component) => component.parentComponent?.startsWith('card:') === true,
    );
    if (originals.length !== card.members.length || grouped.has(id) || overlaps) continue;
    for (const component of originals) {
      components.set(component.id, { ...component, parentComponent: id });
    }
    const stores = originals.filter((component) => component.kind === 'database');
    const services = originals.filter((component) => component.kind === 'service');
    const summary = `${plural(services.length, 'service')} · ${plural(stores.length, 'store')}`;
    grouped.set(id, {
      id,
      name: card.title,
      kind: 'service',
      category: 'group',
      summary,
      repository: null,
      endpoints: [],
      resources: [],
      dependencies: [],
    });
  }
  return [...components.values(), ...grouped.values()];
}

/** Ownership was checked across the workspace by withAreaResources; never infer it from this filtered view. */
export function valueFlowComponents(
  system: AreaSystemView,
  cards?: LandscapeValueFlow['cards'],
): readonly AreaComponentView[] {
  const components = cardGroups(system, cards);
  const parents = new Set(
    components
      .filter((component) => component.kind !== 'database' && component.kind !== 'queue')
      .map((component) => component.id),
  );
  const visible = new Set(
    components
      .filter((component) => !parents.has(component.parentComponent ?? ''))
      .map(({ id }) => id),
  );
  return components
    .filter((component) => !visible.has(component.parentComponent ?? ''))
    .map((component) => ({
      ...component,
      attachments: components.filter((resource) => resource.parentComponent === component.id),
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
