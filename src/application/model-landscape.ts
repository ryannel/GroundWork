import {
  domainMapFrom,
  lineIdOf,
  type DomainMap,
  type MapJourney,
} from '@/application/landscape-domains';
import { drawDomainMap } from '@/application/landscape-domains-layout';
import type { LandscapeMapInput, LinkKind, MapLink } from '@/application/landscape-map-input';
import type { ModelEdge, ModelIndex } from '@/application/model-index';
import { modelTeamSlotOf } from '@/application/model-team';
import { keyOf } from '@/application/plan-pages-key';
import { journeyHref } from '@/application/today-reader';
import type { Landscape } from '@/application/workspace-landscape';
import type { ModelData, ModelGap } from '@/domain/workspace-model';
import { plural } from '@/shared/text';

export interface ModelLandscape extends Landscape {
  readonly provenance: readonly ModelEdge[];
  readonly gaps: readonly ModelGap[];
}

function actorOf(index: ModelIndex, value: string | undefined): string | null {
  if (value === undefined) return null;
  const declared = index.get(value);
  if (declared?.kind === 'actor') return declared.id;
  const matches = (index.model.actors ?? []).filter((actor) => actor.name === value);
  return matches.length === 1 ? (matches[0]?.id ?? null) : null;
}
function linkKind(kind: ModelEdge['kind']): LinkKind {
  if (kind === 'call') return 'api';
  return kind === 'read' || kind === 'write' ? 'data' : 'msg';
}
function actorLinks(index: ModelIndex): readonly MapLink[] {
  const listed = (index.model.actors ?? []).flatMap((actor) =>
    (actor.uses ?? []).map((to) => ({
      from: actor.id,
      to: index.get(to)?.id ?? to,
      kind: 'use' as const,
      via: '',
    })),
  );
  const started = index.model.flows.flatMap((flow): readonly MapLink[] => {
    const actor = actorOf(index, flow.actor);
    const first = flow.steps[0];
    return actor === null || first === undefined
      ? []
      : [{ from: actor, to: index.get(first.from)?.id ?? first.from, kind: 'use', via: flow.name }];
  });
  return [...listed, ...started];
}
function mapInput(index: ModelIndex, edges: readonly ModelEdge[]): LandscapeMapInput {
  return {
    actors: (index.model.actors ?? []).map((actor) => ({
      id: actor.id,
      name: actor.name,
      summary: actor.summary ?? null,
      customer: actor.customer ?? false,
    })),
    domains: index.model.domains.map((domain) => ({
      id: domain.id,
      name: domain.name,
      purpose: domain.purpose ?? null,
      href: index.href(domain.id),
      systems: domain.systems.map((system) => ({
        id: system.id,
        name: system.name,
        does: system.purpose ?? '',
        href: index.href(system.id),
        team: index.owningTeam(system.id),
        teamSlot: modelTeamSlotOf(index, system.team),
        parts: system.components.length,
      })),
    })),
    externals: [],
    homes: Object.fromEntries(
      index.entities.flatMap((node) =>
        node.place.system === null ? [] : [[node.id, node.place.system]],
      ),
    ),
    links: [
      ...actorLinks(index),
      ...edges.flatMap((edge): readonly MapLink[] =>
        edge.kind === 'causes'
          ? []
          : [
              {
                from: edge.from,
                to: edge.to,
                kind: linkKind(edge.kind),
                via: index.label(edge.via),
              },
            ],
      ),
    ],
  };
}
function domainsOf(index: ModelIndex, ids: readonly string[]): readonly string[] {
  return [...new Set(ids.flatMap((id) => index.place(id)?.domain ?? []))];
}
function flowSteps(index: ModelIndex, ids: readonly string[]): readonly ModelData<'FlowStep'>[] {
  return ids.flatMap((id) => index.model.flows.find((flow) => flow.id === id)?.steps ?? []);
}
function journeyLines(
  index: ModelIndex,
  map: DomainMap,
  actor: string | null,
  steps: readonly ModelData<'FlowStep'>[],
): readonly string[] {
  const first = steps[0];
  const starts = actor === null || first === undefined ? [] : [[actor, first.from] as const];
  const pairs = [...starts, ...steps.map((step) => [step.from, step.to] as const)];
  const customers = new Set(
    map.people.filter((person) => person.customer).map((person) => person.id),
  );
  const box = (id: string): string | null =>
    customers.has(id) ? id : (index.place(id)?.domain ?? null);
  const available = new Set(map.links.map((link) => link.id));
  return [
    ...new Set(
      pairs.flatMap(([from, to]) => {
        const a = box(from);
        const b = box(to);
        if (a === null || b === null || a === b) return [];
        const line = lineIdOf(a, b);
        return available.has(line) ? [line] : [];
      }),
    ),
  ];
}
function journeysOf(index: ModelIndex, map: DomainMap): readonly MapJourney[] {
  const journeys = index.model.journeys.map((journey): MapJourney => {
    const steps = flowSteps(index, journey.flows ?? []);
    const actor = actorOf(index, journey.actor);
    return {
      key: keyOf(journey.id),
      title: journey.name,
      kind: 'journey',
      href: journeyHref(index.model.id, keyOf(journey.id)),
      actor,
      domains: domainsOf(index, [
        ...steps.flatMap((step) => [step.from, step.to]),
        ...(journey.interactions ?? []),
      ]),
      lines: journeyLines(index, map, actor, steps),
    };
  });
  const flows = index.model.flows.map((flow): MapJourney => {
    const actor = actorOf(index, flow.actor);
    return {
      key: keyOf(flow.id),
      title: flow.name,
      kind: 'flow',
      href: journeyHref(index.model.id, keyOf(flow.id)),
      actor,
      domains: domainsOf(
        index,
        flow.steps.flatMap((step) => [step.from, step.to]),
      ),
      lines: journeyLines(index, map, actor, flow.steps),
    };
  });
  return [...journeys, ...flows];
}
function actorGaps(index: ModelIndex): readonly ModelGap[] {
  return [...index.model.journeys, ...index.model.flows].flatMap((record) =>
    record.actor === undefined || actorOf(index, record.actor) !== null
      ? []
      : [
          {
            id: record.id,
            kind: 'unknown_actor',
            reference: record.actor,
            property: 'actor',
            message: `The actor ${record.actor} is not an unambiguous declared person.`,
          },
        ],
  );
}
function headlineOf(index: ModelIndex, count: number): string {
  const model = index.model;
  const runs =
    count === 0
      ? `None of ${model.name}'s systems is mapped yet.`
      : `${model.name} maps ${plural(count, 'system')} in ${plural(model.domains.length, 'domain')}.`;
  return model.description === undefined
    ? runs
    : `${model.description.replace(/\.$/u, '')}. ${runs}`;
}
/** The native index supplies facts once; the shared map only groups and draws bounded presentation records. */
export function modelLandscapeOf(index: ModelIndex): ModelLandscape {
  const provenance = index.edges();
  const input = mapInput(index, provenance);
  const base = domainMapFrom(input, []);
  const map = { ...base, journeys: journeysOf(index, base) };
  const systems = index.model.domains.flatMap((domain) => domain.systems);
  const unmapped = systems.filter((system) => system.mapped === false).length;
  const gaps = [...index.gaps(), ...actorGaps(index)];
  return {
    name: index.model.name,
    headline: headlineOf(index, systems.length),
    facts: [
      plural(map.domains.length, 'domain'),
      plural(systems.length, 'system'),
      plural(map.people.length, 'person', 'people'),
      plural(systems.flatMap((system) => system.components).length, 'component'),
      plural(map.journeys.length, 'journey and flow', 'journeys and flows'),
      ...(unmapped === 0
        ? []
        : [
            plural(
              unmapped,
              'system with unmapped implementation',
              'systems with unmapped implementation',
            ),
          ]),
      ...(gaps.length === 0 ? [] : [plural(gaps.length, 'recorded gap')]),
    ],
    map,
    drawing: drawDomainMap(map),
    provenance,
    gaps,
  };
}
