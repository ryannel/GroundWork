import { evidenceAnchor } from '@/domain/knowledge/evidence-anchor';
import type {
  ExplorerIndex,
  ExplorerPage,
  PageRequest,
  SourceLink,
} from '@/domain/scan-explorer/contracts';

function explorerSources(
  index: ExplorerIndex,
  snapshot: string,
  ids: readonly string[],
): SourceLink[] {
  const reader = index.selections.find((item) => item.reader.snapshot === snapshot)?.reader;
  if (reader === undefined) throw new Error('Unknown explorer snapshot');
  const evidence = ids.flatMap((id) => {
    const record = reader.get(id);
    if (record?.kind === 'evidence') return [record];
    if (record !== undefined && 'evidence' in record) {
      return record.evidence.flatMap((ref) => {
        const anchor = reader.get(ref);
        return anchor?.kind === 'evidence' ? [anchor] : [];
      });
    }
    return [];
  });
  return [
    ...new Map(
      evidence.flatMap((record) => {
        const url = evidenceAnchor(record);
        return url === null ? [] : [[record.id, { snapshot, evidence: record.id, url }] as const];
      }),
    ).values(),
  ];
}

export function explorerPage<T>(
  index: ExplorerIndex,
  items: readonly T[],
  options: {
    readonly request: PageRequest;
    readonly references: (item: T) => readonly { readonly snapshot: string; readonly id: string }[];
  },
): ExplorerPage<T> {
  const { request, references } = options;
  const offset = request.offset ?? 0;
  if (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > 200) {
    throw new Error('Explorer limit must be an integer from 1 to 200');
  }
  if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid explorer offset');
  const delivered = items.slice(offset, offset + request.limit);
  const nextOffset = offset + delivered.length < items.length ? offset + delivered.length : null;
  const links = delivered
    .flatMap(references)
    .flatMap(({ snapshot, id }) => explorerSources(index, snapshot, [id]));
  return {
    items: delivered,
    total: items.length,
    nextOffset,
    truncated: offset > 0 || nextOffset !== null,
    sourceLinks: [
      ...new Map(links.map((link) => [`${link.snapshot}:${link.evidence}`, link])).values(),
    ],
    coverage: index.selections.map(({ scope, completeness, limitations }) => ({
      scope,
      completeness,
      limitations,
    })),
    exhaustive: false,
    deployment: 'not_verified',
  };
}
