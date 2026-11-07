import { domainNavOf, type DomainNav, type SystemSections } from '@/application/domain-nav';
import { modelCatalogueOf } from '@/application/model-catalogue';
import { modelChipOf } from '@/application/model-chip';
import type { ModelEdge, ModelIndex } from '@/application/model-index';
import { modelTeamSlotOf } from '@/application/model-team';
import { keyOf } from '@/application/plan-pages-key';
import { andList } from '@/application/plan-viz-ladder-order';
import type { FlowEntry } from '@/application/today-flow-list';
import type { Neighbour, Neighbours } from '@/application/today-neighbours';
import { journeyHref, journeysHref } from '@/application/today-reader';
import type { JourneyCard } from '@/application/today-scope';
import type { DomainTeam, DomainView, SystemCatalogue } from '@/application/workspace-domain';
import { domainFlowHref, workspaceHref } from '@/application/workspace-paths';
import { stripPrefix } from '@/domain/ids';
import { plain } from '@/domain/plain-text';
import {
  modelText,
  type ModelData,
  type ModelDomain,
  type ModelGap,
} from '@/domain/workspace-model';
import { plural } from '@/shared/text';

export interface ModelDomainView extends DomainView {
  readonly domainId: string;
  readonly provenance: readonly ModelEdge[];
  readonly gaps: readonly ModelGap[];
}
export interface ModelWordsPreview {
  readonly summary: string;
  readonly words: readonly {
    readonly id: string;
    readonly label: string;
    readonly glyph: string;
  }[];
}
export interface JourneyRecord {
  readonly id: string;
  readonly name: string;
  readonly kind: 'journey' | 'flow';
  readonly actor: string;
  readonly trigger: string;
  readonly outcome: string;
  readonly flows: readonly string[];
  readonly steps: readonly ModelData<'FlowStep'>[];
  readonly interactions: readonly string[];
}
export function modelDomainOf(index: ModelIndex, slug: string): ModelDomain | null {
  return (
    index.model.domains.find(
      (domain) => domain.id === slug || stripPrefix(domain.id, 'dom') === slug,
    ) ?? null
  );
}
function scopeIds(index: ModelIndex, systems: ReadonlySet<string>): ReadonlySet<string> {
  return new Set(
    index.entities
      .filter((node) => node.place.system !== null && systems.has(node.place.system))
      .map((node) => node.id),
  );
}
function systemOf(index: ModelIndex, id: string): string | null {
  const node = index.get(id);
  return node?.kind === 'system' ? node.id : (node?.place.system ?? null);
}
function teamOf(index: ModelIndex, id: string | undefined): DomainTeam | null {
  const team = index.get(id ?? '');
  if (team?.kind !== 'team') return null;
  return { name: index.label(team.id), slot: modelTeamSlotOf(index, team.id) };
}
function flowRecords(index: ModelIndex): readonly JourneyRecord[] {
  return index.model.flows.map((flow) => ({
    id: flow.id,
    name: flow.name,
    kind: 'flow',
    actor: flow.actor ?? '',
    trigger: flow.trigger ?? '',
    outcome: flow.outcome ?? '',
    flows: [flow.id],
    steps: flow.steps,
    interactions: [],
  }));
}
function interactionTrigger(index: ModelIndex, id: string): string | null {
  const first = index.get(id);
  return modelText(first?.data.name) ?? modelText(first?.data.action);
}
function journeyWords(
  index: ModelIndex,
  interactions: readonly string[],
  flows: readonly ModelData<'FlowFile'>[],
): { readonly trigger: string; readonly outcome: string } {
  const last = index.get(interactions.at(-1) ?? '');
  return {
    trigger: interactionTrigger(index, interactions[0] ?? '') ?? flows[0]?.trigger ?? '',
    outcome: modelText(last?.data.effect) ?? flows.at(-1)?.outcome ?? '',
  };
}
function journeyRecords(index: ModelIndex): readonly JourneyRecord[] {
  return index.model.journeys.map((journey) => {
    const flows = (journey.flows ?? []).flatMap(
      (id) => index.model.flows.find((flow) => flow.id === id) ?? [],
    );
    return {
      id: journey.id,
      name: journey.name,
      kind: 'journey',
      actor: journey.actor ?? '',
      ...journeyWords(index, journey.interactions ?? [], flows),
      flows: flows.map((flow) => flow.id),
      steps: flows.flatMap((flow) => flow.steps),
      interactions: journey.interactions ?? [],
    };
  });
}
function recordSystems(index: ModelIndex, record: JourneyRecord): readonly string[] {
  return [
    ...new Set(
      [...record.steps.flatMap((step) => [step.from, step.to]), ...record.interactions].flatMap(
        (id) => systemOf(index, id) ?? [],
      ),
    ),
  ];
}
function stepsHere(
  index: ModelIndex,
  steps: JourneyRecord['steps'],
  systems: ReadonlySet<string>,
): number {
  return steps.filter((step) =>
    [step.from, step.to].some((id) => systems.has(systemOf(index, id) ?? '')),
  ).length;
}
/** Every authored journey remains visible, including those without mapped flows or systems. */
export function modelJourneyRecordsOf(index: ModelIndex): readonly JourneyRecord[] {
  return [...journeyRecords(index), ...flowRecords(index)];
}
/** Narrative records select and describe cards; they never create an execution edge. */
export function modelJourneyCardsOf(
  index: ModelIndex,
  systems: ReadonlySet<string>,
  name: string,
): readonly JourneyCard[] {
  return modelJourneyRecordsOf(index).flatMap((record) => {
    const crossed = recordSystems(index, record);
    if (!crossed.some((id) => systems.has(id))) return [];
    const here = stepsHere(index, record.steps, systems);
    const flowCount = record.kind === 'journey' ? `${plural(record.flows.length, 'flow')}, ` : '';
    return [
      {
        key: keyOf(record.id),
        href: journeyHref(index.model.id, keyOf(record.id)),
        kind: record.kind,
        title: record.name,
        claim: `${flowCount}${plural(record.steps.length, 'recorded step')} across ${plural(crossed.length, 'system')}.`,
        actor: record.actor === '' ? '' : index.label(record.actor),
        trigger: plain(record.trigger, index.label),
        outcome: plain(record.outcome, index.label),
        through: andList(crossed.map(index.label)),
        systems: crossed,
        here: `${String(here)} of its ${String(record.steps.length)} recorded steps touch ${name}`,
      },
    ];
  });
}
/** Actual declared flows, ordered by the number of narrated steps in this scope. */
export function modelFlowEntriesOf(
  index: ModelIndex,
  systems: ReadonlySet<string>,
  hrefOf: (id: string) => string,
  groupOf: (id: string) => string = (id) => index.label(systemOf(index, id) ?? id),
): readonly FlowEntry[] {
  return index.model.flows
    .flatMap((flow) => {
      const touched = [...new Set(flow.steps.flatMap((step) => [step.from, step.to]))];
      const first = touched.find((id) => systems.has(systemOf(index, id) ?? ''));
      if (first === undefined) return [];
      return [
        {
          id: flow.id,
          name: flow.name,
          href: hrefOf(flow.id),
          steps: flow.steps.length,
          here: stepsHere(index, flow.steps, systems),
          entry: groupOf(first),
          terms: [
            flow.name,
            ...touched.map(index.label),
            ...flow.steps.flatMap((step) => [step.action, index.label(step.via ?? '')]),
          ]
            .join(' ')
            .toLowerCase(),
        },
      ];
    })
    .toSorted((a, b) => b.here - a.here);
}
const HOW: Readonly<Record<ModelEdge['kind'], string>> = {
  call: 'calls',
  publish: 'publishes events',
  consume: 'receives events',
  read: 'reads data',
  write: 'writes data',
  causes: 'sets off work',
};
function neighbourPlace(index: ModelIndex, id: string): string {
  const node = index.get(id);
  if (node?.kind === 'external') return 'External party';
  const domain = node?.place.domain;
  return domain === null || domain === undefined ? '' : `${index.label(domain)} domain`;
}
export function modelNeighboursOf(index: ModelIndex, systems: ReadonlySet<string>): Neighbours {
  const edges = index.edges(undefined, { level: 'system' });
  const near = (own: 'from' | 'to', other: 'from' | 'to'): readonly Neighbour[] => {
    const ways = new Map<string, Set<string>>();
    for (const edge of edges) {
      if (systems.has(edge[own]) && !systems.has(edge[other])) {
        const id = edge[other];
        ways.set(id, new Set([...(ways.get(id) ?? []), HOW[edge.kind]]));
      }
    }
    return [...ways].map(([id, how]) => ({
      id,
      name: index.label(id),
      href: index.href(id),
      place: neighbourPlace(index, id),
      how: andList([...how]),
    }));
  };
  return { reaches: near('from', 'to'), reachedBy: near('to', 'from') };
}
/** The language already declared by this domain, ready for the shared preview renderer. */
export function modelDomainWordsOf(index: ModelIndex, slug: string): ModelWordsPreview | null {
  const language = modelDomainOf(index, slug)?.language;
  return language === null || language === undefined
    ? null
    : {
        summary: language.summary ?? '',
        words: (language.concepts ?? []).map((word) => modelChipOf(index, word.id)),
      };
}
const domainViews = new WeakMap<ModelIndex, Map<string, ModelDomainView>>();

/** Reuse the same domain values while their exact canonical index is current. */
export function modelDomainViewOf(index: ModelIndex, slug: string): ModelDomainView | null {
  const domain = modelDomainOf(index, slug);
  if (domain === null) return null;
  const views = domainViews.get(index) ?? new Map<string, ModelDomainView>();
  const previous = views.get(domain.id);
  if (previous !== undefined) return previous;
  const view = domainViewOf(index, domain);
  views.set(domain.id, view);
  domainViews.set(index, views);
  return view;
}

/** One native domain as the existing page's bounded display values, never as a legacy workspace/model. */
function domainViewOf(index: ModelIndex, domain: ModelDomain): ModelDomainView {
  const systems = new Set(domain.systems.map((system) => system.id));
  const focus = scopeIds(index, systems);
  const catalogue = modelCatalogueOf(index, focus);
  const flows = modelFlowEntriesOf(index, systems, (id) =>
    domainFlowHref(index.model.id, stripPrefix(domain.id, 'dom'), id),
  );
  const teams = [...new Set(domain.systems.flatMap((system) => system.team ?? []))].flatMap(
    (id) => teamOf(index, id) ?? [],
  );
  return {
    domainId: domain.id,
    workspace: { name: index.model.name, href: workspaceHref(index.model.id) },
    name: domain.name,
    href: index.href(domain.id),
    purpose: domain.purpose ?? null,
    headline: `${domain.name} maps ${plural(systems.size, 'system')} and ${plural(flows.length, 'flow')}.`,
    counts: {
      systems: systems.size,
      components: domain.systems.flatMap((system) => system.components).length,
      flows: flows.length,
      calls: catalogue.apis.reduce((count, row) => count + row.items.length, 0),
      events: catalogue.events.length,
      stores: catalogue.data.length,
    },
    teams,
    journeys: modelJourneyCardsOf(index, systems, domain.name),
    allJourneys: journeysHref(index.model.id),
    flows,
    systems: domain.systems.map((system) => ({
      id: system.id,
      name: system.name,
      href: index.href(system.id),
      does: [
        system.purpose ?? '',
        ...(system.mapped === false ? ['Implementation not mapped.'] : []),
      ]
        .filter(Boolean)
        .join(' '),
      team: teamOf(index, system.team),
      components: system.components.length,
      repos: index
        .codeHomes(system.id)
        .map((home) => [home.repo, home.path].filter(Boolean).join('/')),
    })),
    neighbours: modelNeighboursOf(index, systems),
    catalogue,
    provenance: index.edges().filter((edge) => focus.has(edge.from) || focus.has(edge.to)),
    gaps: index.gaps().filter((gap) => focus.has(index.get(gap.id)?.id ?? gap.id)),
  };
}
/** Per-system catalogues share the same native projection as the domain totals. */
export function modelSystemCataloguesOf(
  index: ModelIndex,
  slug: string,
): readonly SystemCatalogue[] {
  return (modelDomainOf(index, slug)?.systems ?? []).flatMap((system) => {
    const catalogue = modelCatalogueOf(index, new Set([system.id]));
    return catalogue.apis.length + catalogue.events.length + catalogue.data.length === 0
      ? []
      : [{ id: system.id, name: system.name, href: index.href(system.id), catalogue }];
  });
}
export function modelDomainNavOf(
  index: ModelIndex,
  view: ModelDomainView,
  plans: number,
  system?: SystemSections,
): DomainNav {
  const domain = modelDomainOf(index, view.domainId);
  return domainNavOf({ name: index.model.name }, view, {
    words: domain?.language?.concepts?.length ?? 0,
    plans,
    stages: domain?.target?.stages?.length ?? 0,
    ...(system === undefined ? {} : { system }),
  });
}
