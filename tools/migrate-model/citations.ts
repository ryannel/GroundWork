import { normaliseRepository, parseGitHostUrl } from '@/domain/code-links';
import { modelList, modelRecord, modelText, type ModelCite } from '@/domain/workspace-model';

import { fingerprint, type MigrationReview } from './review';
import { slug } from './steps';

type Node = Readonly<Record<string, unknown>>;
interface Home {
  readonly repo: string;
  readonly path?: string;
}
export interface MigrationCitations {
  readonly homes: () => Readonly<Record<string, Home>>;
  readonly convert: (value: Node, inherited?: readonly unknown[]) => readonly unknown[];
}
function sourceOf(value: unknown): Node | null {
  const source = modelRecord(value);
  if (source === null) return null;
  if (typeof source.url !== 'string') return source;
  const link = parseGitHostUrl(source.url);
  if (link?.kind !== 'blob') return null;
  return {
    ...source,
    repo: link.host === 'github.com' ? link.repo : `${link.host}/${link.repo}`,
    path: link.path,
    commit: link.commit,
    lines: link.lines,
  };
}
function sourceCite(source: Node, home: string): string | null {
  const path = modelText(source.path);
  const commit = modelText(source.commit);
  if (path === null) return null;
  const [start, end] = modelList(source.lines);
  let span = '';
  if (typeof start === 'number') {
    span = `#L${String(start)}`;
    if (typeof end === 'number' && end !== start) span += `-${String(end)}`;
  }
  const symbol = modelText(source.symbol);
  const history = commit === null ? '' : `@${commit}`;
  const label = symbol === null || span === '' ? '' : ` ${symbol}`;
  return `${home}:${path}${history}${span}${label}`;
}
export function migrationCitations(
  repos: readonly unknown[],
  review: MigrationReview,
  scope: string,
): MigrationCitations {
  const homes = new Map<string, Home>();
  const homeFor = (repo: string, homePath?: string): string => {
    const normal = normaliseRepository(repo);
    const suffix = homePath === undefined ? '' : `-${slug(homePath)}`;
    const key = `${slug(normal)}${suffix}`;
    const home = { repo: normal, ...(homePath === undefined ? {} : { path: homePath }) };
    const existing = homes.get(key);
    if (existing !== undefined && fingerprint(existing) !== fingerprint(home)) {
      throw new Error(`Code home collision: ${key}`);
    }
    homes.set(key, home);
    return key;
  };
  for (const value of repos) {
    if (typeof value === 'string') homeFor(value);
    const home = modelRecord(value);
    if (typeof home?.repo === 'string') homeFor(home.repo, modelText(home.path) ?? undefined);
  }
  return {
    homes: () => Object.fromEntries([...homes].toSorted(([a], [b]) => a.localeCompare(b))),
    convert: (value, inherited = []) => {
      const explicit = modelList(value.cites);
      const sources = modelList(value.sources);
      if (sources.length === 0) return explicit.length === 0 ? inherited : explicit;
      const cites = sources.flatMap((original) => {
        const source = sourceOf(original);
        const repo = modelText(source?.repo);
        if (source === null || repo === null) {
          review.add('citations', `${scope}/citation/${fingerprint(original)}`, original, {
            source: original,
            reason: 'No supported code location; preserve for review.',
          });
          return [];
        }
        if (
          source.note !== undefined ||
          source.heading !== undefined ||
          source.label !== undefined
        ) {
          review.add('source-notes', `${scope}/source-note/${fingerprint(original)}`, original, {
            source: original,
          });
        }
        const cite = sourceCite(source, homeFor(repo));
        return cite === null ? [] : [cite];
      });
      return [...new Set([...explicit, ...cites])];
    },
  };
}
export function convertCitations(value: unknown, citations: MigrationCitations): unknown {
  if (Array.isArray(value)) return value.map((item) => convertCitations(item, citations));
  const node = modelRecord(value);
  if (node === null) return value;
  const cites = node.sources === undefined ? undefined : citations.convert(node);
  return Object.fromEntries([
    ...Object.entries(node)
      .filter(([key]) => key !== 'sources' && key !== 'origin')
      .map(([key, item]) => [key, convertCitations(item, citations)]),
    ...(cites === undefined || cites.length === 0 ? [] : [['cites', cites]]),
  ]);
}

export function codeReference(
  value: unknown,
): Extract<ModelCite, { readonly kind: 'code' }> | null {
  const source = sourceOf(value);
  const repo = modelText(source?.repo);
  const path = modelText(source?.path);
  const commit = modelText(source?.commit);
  if (repo === null || path === null || commit === null) return null;
  const [start, end] = modelList(source?.lines);
  const symbol = modelText(source?.symbol);
  return {
    kind: 'code',
    repo,
    path,
    commit,
    ...(typeof start === 'number' && typeof end === 'number'
      ? { lines: [start, end] as const }
      : {}),
    ...(symbol === null ? {} : { symbol }),
  };
}
