import { entryFlowHref } from '@/application/entry-flow-paths';
import {
  modelCatalogueOf,
  modelOfferedBy,
  modelSystemEntriesOf,
} from '@/application/model-catalogue';
import { modelChipOf, modelKindPresentation } from '@/application/model-chip';
import {
  modelDomainOf,
  modelFlowEntriesOf,
  modelJourneyCardsOf,
  modelNeighboursOf,
} from '@/application/model-domain';
import { modelFlowOf, type ModelFlowView } from '@/application/model-flow';
import type { ModelEdge, ModelIndex } from '@/application/model-index';
import type { Catalogue } from '@/application/today-catalogue';
import type { ComponentCard } from '@/application/today-components';
import { journeysHref } from '@/application/today-reader';
import type { RepoRow } from '@/application/today-repos';
import { flowSlug, systemFlowHref, workspaceHref } from '@/application/workspace-paths';
import type { SystemView } from '@/application/workspace-system';
import { homeUrlOf } from '@/domain/code-links';
import { stripPrefix } from '@/domain/ids';
import { codeCitationResolver } from '@/domain/model-cite-resolution';
import {
  modelText,
  type ModelCite,
  type ModelDomain,
  type ModelGap,
  type ModelSystem,
  type WorkspaceModel,
} from '@/domain/workspace-model';
import { plural } from '@/shared/text';

export interface ModelSystemPath {
  readonly domain: string;
  readonly system: string;
}
export interface ModelSystemView extends SystemView {
  readonly id: string;
  readonly domainId: string;
  readonly mapped: boolean;
  readonly catalogue: Catalogue;
  readonly entries: readonly {
    readonly id: string;
    readonly name: string;
    readonly kind: string;
    readonly href: string;
  }[];
  readonly allEntriesHref: string;
  readonly narratives: ModelSystem['narratives'];
  readonly narrativeLabels: Readonly<Record<string, string>>;
  readonly gaps: readonly ModelGap[];
  readonly provenance: readonly ModelEdge[];
  readonly cites: readonly ModelCite[];
}
export function modelSystemAt(
  index: ModelIndex,
  path: ModelSystemPath,
): { readonly domain: ModelDomain; readonly system: ModelSystem } | null {
  const domain = modelDomainOf(index, path.domain);
  const system = domain?.systems.find(
    (candidate) => candidate.id === path.system || stripPrefix(candidate.id, 'sys') === path.system,
  );
  return domain === null || system === undefined ? null : { domain, system };
}
function systemFlows(
  index: ModelIndex,
  at: { readonly domain: ModelDomain; readonly system: ModelSystem },
) {
  return modelFlowEntriesOf(
    index,
    new Set([at.system.id]),
    (flow) =>
      systemFlowHref(
        {
          workspace: index.model.id,
          domain: stripPrefix(at.domain.id, 'dom'),
          system: stripPrefix(at.system.id, 'sys'),
        },
        flow,
      ),
    index.label,
  );
}
/** Select only a declared flow whose narrative actually touches this system. */
export function modelSystemFlowOf(
  index: ModelIndex,
  path: ModelSystemPath,
  slug?: string,
): ModelFlowView | null {
  const at = modelSystemAt(index, path);
  if (at === null) return null;
  const flows = systemFlows(index, at);
  const selected =
    slug === undefined
      ? flows[0]
      : flows.find((flow) => flow.id === slug || flowSlug(flow.id) === slug);
  return selected === undefined ? null : modelFlowOf(index, selected.id);
}
const unique = (ids: readonly string[]): readonly string[] => [...new Set(ids)];
/** Component relationships use canonical queries; a resource's owner never moves its file placement. */
function modelComponentCardsOf(index: ModelIndex, system: string): readonly ComponentCard[] {
  return index.entities
    .filter(
      (node) =>
        node.place.system === system && ['service', 'app', 'store', 'topic'].includes(node.kind),
    )
    .map((node) => {
      const edges = index.edges(node.id);
      const chips = (ids: readonly string[]) => unique(ids).map((id) => modelChipOf(index, id));
      const messages = index.entities.filter((candidate) => candidate.kind === 'message');
      return {
        chip: modelChipOf(index, node.id),
        kind: [modelKindPresentation(node.kind).word, modelText(node.data.tech)]
          .filter(Boolean)
          .join(' · '),
        does: modelText(node.data.does) ?? modelText(node.data.summary) ?? '',
        summary: modelText(node.data.summary) ?? '',
        offers: chips(modelOfferedBy(index, node.id)),
        calls: chips(
          edges
            .filter((edge) => edge.kind === 'call' && edge.from === node.id)
            .map((edge) => edge.via),
        ),
        announces: chips(
          messages
            .filter((message) => index.producers(message.id).includes(node.id))
            .map((message) => message.id),
        ),
        listens: chips(
          messages
            .filter((message) => index.consumers(message.id).includes(node.id))
            .map((message) => message.id),
        ),
        keeps: chips(
          index.entities
            .filter(
              (resource) =>
                ['store', 'topic'].includes(resource.kind) &&
                index.resourceOwner(resource.id) === node.id,
            )
            .map((resource) => resource.id),
        ),
        uses: chips(
          edges
            .filter(
              (edge) =>
                ['read', 'write'].includes(edge.kind) &&
                edge.from === node.id &&
                index.resourceOwner(edge.to) !== node.id,
            )
            .map((edge) => edge.to),
        ),
      };
    });
}
const citations = new WeakMap<
  WorkspaceModel['evidence'],
  ReturnType<typeof codeCitationResolver>
>();
function resolverOf(index: ModelIndex): ReturnType<typeof codeCitationResolver> {
  const cached = citations.get(index.model.evidence);
  if (cached !== undefined) return cached;
  const resolver = codeCitationResolver(index.model.evidence);
  citations.set(index.model.evidence, resolver);
  return resolver;
}
function codeCount(
  index: ModelIndex,
  system: string,
  home: { readonly repo: string; readonly path?: string },
): number {
  const resolver = resolverOf(index);
  return index.entities
    .filter(
      (node) =>
        node.place.system === system &&
        Array.isArray(node.data.cites) &&
        node.data.cites.length > 0,
    )
    .filter((node) =>
      resolver(index.cites(node.id)).some(
        (cite) =>
          cite.repo === home.repo &&
          (home.path === undefined ||
            cite.path === home.path ||
            cite.path.startsWith(`${home.path}/`)),
      ),
    ).length;
}
/** Source pins describe what was read; absent remote branch checks remain explicitly unknown. */
export function modelReposOf(index: ModelIndex, system: string): readonly RepoRow[] {
  const pins = index.freshness(system);
  return index.codeHomes(system).map((home) => {
    const recorded = pins.filter((pin) => pin.repo === home.repo);
    const count = codeCount(index, system, home);
    return {
      repo: [home.repo, home.path].filter(Boolean).join('/'),
      href: homeUrlOf(home),
      read:
        recorded.length === 0
          ? 'No repository scan pin recorded'
          : recorded.map((pin) => `Read at ${pin.commit}, ${pin.scannedAt}`).join('; '),
      scanned: recorded.length > 0,
      moved: 'Remote branch freshness not recorded',
      cited: `${plural(count, 'record')} ${count === 1 ? 'cites' : 'cite'} code here`,
    };
  });
}
function entriesOf(
  index: ModelIndex,
  system: ModelSystem,
  catalogue: Catalogue,
): ModelSystemView['entries'] {
  return modelSystemEntriesOf(index, system.id, catalogue).map((node) => ({
    id: node.id,
    name: index.label(node.id),
    kind: modelKindPresentation(node.kind).word,
    href: entryFlowHref(index.model.id, { entry: node.id }),
  }));
}
function gapsOf(
  index: ModelIndex,
  system: string,
  entries: ModelSystemView['entries'],
): readonly ModelGap[] {
  const gaps = [...index.gaps(system), ...entries.flatMap((entry) => index.gaps(entry.id))];
  return [...new Map(gaps.map((gap) => [JSON.stringify(gap), gap])).values()];
}
function narrativeLabels(index: ModelIndex, system: ModelSystem): Readonly<Record<string, string>> {
  const ids = (system.narratives?.stories ?? []).flatMap((story) => [
    ...(story.relatedSystems ?? []),
    ...(story.connections ?? []).flatMap((connection) => [
      connection.from,
      connection.to,
      ...(connection.backs ?? []),
    ]),
    ...story.stages.flatMap((stage) => [
      stage.component,
      ...stage.supporting,
      ...(stage.backs ?? []),
    ]),
  ]);
  return Object.fromEntries(unique(ids).map((id) => [id, index.label(id)]));
}
const systemViews = new WeakMap<ModelIndex, Map<string, ModelSystemView>>();

/** Use the same bounded view on a system and its flow pages while their exact index is current. */
export function modelSystemViewOf(
  index: ModelIndex,
  path: ModelSystemPath,
): ModelSystemView | null {
  const at = modelSystemAt(index, path);
  if (at === null) return null;
  const views = systemViews.get(index) ?? new Map<string, ModelSystemView>();
  const previous = views.get(at.system.id);
  if (previous !== undefined) return previous;
  const view = systemViewOf(index, at);
  views.set(at.system.id, view);
  systemViews.set(index, views);
  return view;
}
function systemViewOf(
  index: ModelIndex,
  at: { readonly domain: ModelDomain; readonly system: ModelSystem },
): ModelSystemView {
  const { domain, system } = at;
  const systems = new Set([system.id]);
  const catalogue = modelCatalogueOf(index, systems);
  const flows = systemFlows(index, at);
  const entries = entriesOf(index, system, catalogue);
  const team = index.owningTeam(system.id);
  const mapped = system.mapped !== false;
  const purpose = system.purpose ?? '';
  return {
    id: system.id,
    domainId: domain.id,
    mapped,
    catalogue,
    entries,
    allEntriesHref: entryFlowHref(index.model.id, { system: system.id }),
    narratives: system.narratives,
    narrativeLabels: narrativeLabels(index, system),
    trail: [
      { label: index.model.name, href: workspaceHref(index.model.id) },
      { label: domain.name, href: index.href(domain.id) },
    ],
    name: system.name,
    headline: [
      purpose === '' ? `${system.name} is a system in ${domain.name}.` : purpose,
      ...(mapped ? [] : ['Implementation not mapped.']),
    ].join(' '),
    about: team === null ? 'Team not recorded' : `Run by the ${index.label(team)} team`,
    facts: [
      plural(system.components.length, 'component'),
      plural(index.codeHomes(system.id).length, 'repo'),
      plural(flows.length, 'authored flow'),
      plural(entries.length, 'entry', 'entries'),
    ],
    repos: modelReposOf(index, system.id),
    journeys: modelJourneyCardsOf(index, systems, system.name),
    flows,
    allJourneys: journeysHref(index.model.id),
    components: modelComponentCardsOf(index, system.id),
    data: catalogue.data,
    neighbours: modelNeighboursOf(index, systems),
    gaps: gapsOf(index, system.id, entries),
    provenance: index
      .edges()
      .filter((edge) =>
        [edge.from, edge.to].some(
          (id) => index.get(id)?.place.system === system.id || id === system.id,
        ),
      ),
    cites: index.cites(system.id),
  };
}
