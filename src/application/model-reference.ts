import { modelChipOf, type ModelChip } from '@/application/model-chip';
import { modelGapSummary } from '@/application/model-gap-summary';
import type { ModelIndex } from '@/application/model-index';
import { countWord } from '@/application/plan-viz-text';
import type { ReferencePage } from '@/application/reference/query';
import { stripPrefix } from '@/domain/ids';
import { plain } from '@/domain/plain-text';
import { modelText, type ModelGap } from '@/domain/workspace-model';
import { firstParam, type SearchParams } from '@/shared/search-params';

const KINDS = [
  {
    kind: 'components',
    title: 'Components',
    one: 'component',
    nodes: ['service', 'app', 'library', 'external'],
    lede: 'Services, apps, libraries and external parties, with their recorded interfaces and connections.',
  },
  {
    kind: 'stores',
    title: 'Stores',
    one: 'store',
    nodes: ['store', 'topic'],
    lede: 'Stores, topics and queues, with their recorded owners, data and access.',
  },
  {
    kind: 'apis',
    title: 'APIs',
    one: 'endpoint',
    nodes: ['endpoint'],
    lede: 'Offered endpoints, with their declared providers, callers, request and response.',
  },
  {
    kind: 'schemas',
    title: 'Schemas',
    one: 'schema',
    nodes: ['schema'],
    lede: 'Records, request bodies, event data and graph types, with their fields and relationships.',
  },
  {
    kind: 'events',
    title: 'Events',
    one: 'message',
    nodes: ['message'],
    lede: 'Messages, with their recorded publishers, subscribers and delivery.',
  },
  {
    kind: 'flows',
    title: 'Flows',
    one: 'flow',
    nodes: ['flow'],
    lede: 'Authored narratives, retaining their steps, actor, trigger and outcome.',
  },
  {
    kind: 'screens',
    title: 'Screens',
    one: 'screen',
    nodes: ['screen'],
    lede: 'Pages, modals, emails and prints, with their recorded regions and app.',
  },
  {
    kind: 'operations',
    title: 'Operations',
    one: 'operation',
    nodes: ['operation'],
    lede: 'Cited GraphQL documents and selections. An unknown client remains a gap.',
  },
];
export interface ModelReferenceEntry {
  readonly kind: string;
  readonly title: string;
  readonly count: number;
  readonly size: string;
  readonly headline: string;
  readonly lede: string;
}
export function modelReferenceOf(index: ModelIndex): readonly ModelReferenceEntry[] {
  return KINDS.flatMap((entry) => {
    const count = index.entities.filter((node) => entry.nodes.includes(node.kind)).length;
    const size = countWord(count, entry.one);
    return count === 0 ? [] : [{ ...entry, count, size, headline: `${size} recorded.` }];
  });
}
interface ReferenceGap extends Pick<ModelGap, 'kind' | 'message'> {
  readonly count?: number;
}

export interface ModelReferencePage extends Omit<ReferencePage, 'rows'> {
  readonly teams: Readonly<Record<string, string>>;
  readonly rows: readonly {
    readonly chip: ModelChip;
    readonly owner: ModelChip | null;
    readonly summary: string;
    readonly gaps: readonly ReferenceGap[];
  }[];
}
export function modelReferencePage(
  index: ModelIndex,
  kind: string,
  params: SearchParams = {},
): ModelReferencePage | null {
  const entry = KINDS.find((candidate) => candidate.kind === kind);
  if (entry === undefined) return null;
  const team = (index.model.teams ?? []).find(
    (candidate) =>
      candidate.id === firstParam(params.team) ||
      stripPrefix(candidate.id, 'team') === firstParam(params.team),
  );
  const q = firstParam(params.q).trim();
  const words = q.toLowerCase().split(/\s+/u).filter(Boolean);
  const found = index.entities.filter(
    (node) =>
      entry.nodes.includes(node.kind) &&
      (team === undefined || index.owningTeam(node.id) === team.id) &&
      words.every((word) =>
        `${index.label(node.id)} ${JSON.stringify(node.data)}`.toLowerCase().includes(word),
      ),
  );
  const pages = Math.max(1, Math.ceil(found.length / 30));
  const requested = Number(firstParam(params.page));
  const page = Math.min(Number.isSafeInteger(requested) && requested > 0 ? requested : 1, pages);
  const query: ReferencePage['query'] = { q, team: team?.id ?? '', show: 'asis', page };
  return {
    query,
    total: found.length,
    pages,
    teams: Object.fromEntries((index.model.teams ?? []).map((item) => [item.id, item.name])),
    rows: found.slice((page - 1) * 30, page * 30).map((node) => ({
      chip: modelChipOf(index, node.id),
      owner:
        index.resourceOwner(node.id) === null
          ? null
          : modelChipOf(index, index.resourceOwner(node.id) ?? ''),
      summary: plain(
        modelText(node.data.summary) ?? modelText(node.data.does) ?? modelText(node.data.why) ?? '',
        index.label,
      ),
      gaps: node.kind === 'operation' ? modelGapSummary(index.gaps(node.id)) : index.gaps(node.id),
    })),
  };
}
