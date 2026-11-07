import type {
  AreaComponentView,
  AreaTechnicalRelationship,
  AreaView,
} from '@/application/workspace-area';
import {
  apiRelationshipDetail,
  resourceRelationshipDetail,
} from '@/application/workspace-area-relationships';

import { connectionSummary } from './connection-summary';

type TransportRelationship = Omit<AreaTechnicalRelationship, 'detail' | 'id'> & {
  readonly id?: string;
  readonly detail?: string;
};

export interface AreaMapTransport extends Omit<AreaView, 'technicalRelationships'> {
  readonly technicalRelationships: readonly TransportRelationship[];
}

function componentNames(view: AreaMapTransport): ReadonlyMap<string, string> {
  return new Map(
    view.systems.flatMap((system) =>
      system.components.map((component) => [component.id, component.name]),
    ),
  );
}

function generatedId(relation: TransportRelationship): string {
  return `technical:${relation.kind}|${relation.from}|${relation.to}|${String(relation.via)}`;
}

function generatedDetail(
  relation: TransportRelationship,
  names: ReadonlyMap<string, string>,
): string | undefined {
  const from = names.get(relation.from);
  const to = names.get(relation.to);
  if (from === undefined || to === undefined) return undefined;
  if (relation.kind === 'api') {
    return apiRelationshipDetail(from, to, relation.label, relation.evidence);
  }
  return relation.kind === 'data' || relation.kind === 'message'
    ? resourceRelationshipDetail(from, to, relation.label)
    : undefined;
}

/** Omit only identities and descriptions that reconstruct exactly; qualifications travel unchanged. */
export function packAreaMapView(view: AreaView): AreaMapTransport {
  const names = componentNames(view);
  return {
    ...view,
    technicalRelationships: view.technicalRelationships.map((relation) => {
      const { id, detail, ...compact } = relation;
      return {
        ...compact,
        ...(id === generatedId(relation) ? {} : { id }),
        ...(detail === generatedDetail(relation, names) ? {} : { detail }),
      };
    }),
  };
}

function collapsedCard<T extends AreaComponentView>(component: T): T {
  return {
    ...component,
    repository: null,
    explorer: null,
    endpoints: [],
    resources: [],
    dependencies: [],
  };
}

function nativeCollapsedCard<T extends AreaComponentView>(component: T): T {
  return { ...collapsedCard(component), entries: [], citations: [] };
}

/** Authored work and boundary identities open immediately; code sites load on exploration. */
function nativeOverview(
  view: AreaView,
  boundaries: NonNullable<AreaView['boundaries']>,
): AreaMapTransport {
  return packAreaMapView({
    area: view.area,
    workspace: view.workspace,
    reviewed: view.reviewed,
    scope: view.scope,
    limitation: view.limitation,
    relationships: view.relationships,
    collaborations: view.collaborations,
    valueFlow: view.valueFlow,
    boundaries: boundaries.map((boundary) => ({
      ...nativeCollapsedCard(boundary),
      explorer: boundary.explorer,
    })),
    technicalRelationships: [],
    systems: view.systems.map(({ narratives: _narratives, ...system }) => ({
      ...system,
      resources: [],
      components: system.components.map(nativeCollapsedCard),
    })),
  });
}

/** The collapsed view retains every identity and exchange; component contracts load on exploration. */
export function packAreaMapOverview(view: AreaView): AreaMapTransport {
  if (view.valueFlow === undefined) return packAreaMapView(view);
  if (view.boundaries !== undefined) return nativeOverview(view, view.boundaries);
  const components = view.systems.flatMap((system) => system.components);
  return packAreaMapView({
    ...view,
    technicalRelationships: view.technicalRelationships.map((relation) => ({
      ...relation,
      summary: connectionSummary(relation, components, view.valueFlow?.summaries),
    })),
    systems: view.systems.map((system) => ({
      ...system,
      resources: [],
      components: system.components.map(collapsedCard),
    })),
  });
}

/** Restore the complete view before either map draws or exposes connection details. */
export function unpackAreaMapView(payload: AreaMapTransport): AreaView {
  const names = componentNames(payload);
  return {
    ...payload,
    technicalRelationships: payload.technicalRelationships.map((relation) => {
      const id = relation.id ?? generatedId(relation);
      const detail = relation.detail ?? generatedDetail(relation, names);
      if (detail === undefined) throw new Error(`Missing connection detail: ${id}`);
      return { ...relation, id, detail };
    }),
  };
}
