// Native inspection commands use recorded identities and exchanges from the one model index.
import type { ModelEdge, ModelIndex } from '@/application/model-index';
import { modelMarkdownOf } from '@/application/model-map';
import { codeCitationResolver } from '@/domain/model-cite-resolution';
import { modelText, type ModelEntity } from '@/domain/workspace-model';

function score(node: ModelEntity, label: string, words: readonly string[]): number {
  const id = node.id.toLowerCase();
  const name = label.toLowerCase();
  const summary = ['summary', 'does', 'description', 'purpose']
    .map((key) => modelText(node.data[key]) ?? '')
    .join(' ')
    .toLowerCase();
  let total = 0;
  for (const word of words) {
    const value =
      (id === word ? 50 : 0) +
      (name.includes(word) ? 10 : 0) +
      (id.includes(word) ? 6 : 0) +
      (summary.includes(word) ? 2 : 0);
    if (value === 0) return 0;
    total += value;
  }
  return total;
}
type Direction = 'in' | 'out';
function walkKeys(edge: ModelEdge, direction: Direction): readonly string[] {
  if (direction === 'in') {
    const keys = edge.kind === 'consume' ? [edge.to, edge.entry] : [edge.to, edge.via];
    return keys.filter((key) => key !== null);
  }
  return [
    edge.from,
    edge.entry,
    edge.handler,
    edge.site,
    edge.kind === 'consume' ? edge.via : null,
  ].filter((key) => key !== null);
}
function nextKey(edge: ModelEdge, direction: Direction): string | null {
  if (direction === 'in') return edge.kind === 'consume' ? edge.via : edge.entry;
  return edge.kind === 'consume' ? edge.entry : edge.via;
}
function recordedWalk(
  index: ModelIndex,
  id: string,
  direction: Direction,
  depth: number,
): readonly ModelEdge[] {
  const root = index.get(id);
  if (root === null) return [];
  const edges = index.edges();
  const visited = new Set<string>();
  const retained = new Set<ModelEdge>();
  let frontier = new Set([root.id]);
  for (let hop = 0; hop < depth && frontier.size > 0; hop += 1) {
    for (const key of frontier) visited.add(key);
    const reached = edges.filter((edge) =>
      walkKeys(edge, direction).some((key) => frontier.has(key)),
    );
    for (const edge of reached) {
      retained.add(edge);
    }
    frontier = new Set(
      reached
        .map((edge) => nextKey(edge, direction))
        .filter((target): target is string => target !== null && !visited.has(target)),
    );
  }
  return [...retained];
}
interface RepositoryFacts {
  readonly homes: readonly {
    readonly id: string;
    readonly home: ReturnType<ModelIndex['codeHomes']>[number];
    readonly pins: ReturnType<ModelIndex['freshness']>;
  }[];
  readonly repositories: readonly ModelIndex['model']['evidence'][number]['repository'][];
}
export interface ModelMapQueries {
  readonly find: (text: string, limit?: number) => readonly ModelEntity[];
  readonly callers: (id: string, depth?: number) => readonly ModelEdge[];
  readonly calls: (id: string, depth?: number) => readonly ModelEdge[];
  readonly owns: (file: string, repo?: string) => readonly ModelEntity[];
  readonly repos: () => RepositoryFacts;
  readonly markdown: () => string;
}
function sameFile(wanted: string, path: string): boolean {
  return path === wanted || path.endsWith(`/${wanted}`) || wanted.endsWith(path);
}
export function modelMapQueries(index: ModelIndex): ModelMapQueries {
  const locations = codeCitationResolver(index.model.evidence);
  return {
    find: (text: string, limit = 20): readonly ModelEntity[] => {
      const words = text.toLowerCase().split(/\s+/u).filter(Boolean);
      return index.entities
        .map((fact) => ({ fact, score: score(fact, index.label(fact.id), words) }))
        .filter((hit) => hit.score > 0)
        .toSorted((a, b) =>
          a.score === b.score ? a.fact.id.localeCompare(b.fact.id) : b.score - a.score,
        )
        .slice(0, limit)
        .map((hit) => hit.fact);
    },
    callers: (id: string, depth = 3): readonly ModelEdge[] => recordedWalk(index, id, 'in', depth),
    calls: (id: string, depth = 8): readonly ModelEdge[] => recordedWalk(index, id, 'out', depth),
    owns: (file: string, repo?: string): readonly ModelEntity[] => {
      const wanted = file.replace(/^\.?\//u, '');
      return index.entities.filter((node) =>
        locations(index.cites(node.id)).some(
          (cite) => (repo === undefined || cite.repo === repo) && sameFile(wanted, cite.path),
        ),
      );
    },
    repos: () => ({
      homes: index.entities
        .filter((node) =>
          ['system', 'service', 'app', 'store', 'topic', 'library'].includes(node.kind),
        )
        .flatMap((node) =>
          index.codeHomes(node.id).map((home) => ({
            id: node.id,
            home,
            pins: index.freshness(node.id),
          })),
        ),
      repositories: index.model.evidence.map(({ repository }) => repository),
    }),
    markdown: (): string => modelMarkdownOf(index),
  };
}
