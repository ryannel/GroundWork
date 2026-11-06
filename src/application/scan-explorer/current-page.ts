import { permalinkOf } from '@/domain/code-links';
import type {
  CurrentBounds,
  CurrentRecord,
  CurrentScanInput,
  CurrentView,
} from '@/domain/scan-explorer/current-contracts';

import { currentSourceIds } from './current-source-ids';

function links(
  input: CurrentScanInput,
  records: readonly CurrentRecord[],
): CurrentView['sourceLinks'] {
  const wanted = new Set([
    ...records.flatMap(currentSourceIds),
    ...input.binding.declarations.map((source) => source.id),
  ]);
  return [
    ...new Map(
      [...input.sources, ...input.binding.declarations]
        .filter((source) => wanted.has(source.id))
        .map((source) => [
          source.id,
          {
            id: source.id,
            snapshot: input.snapshot,
            url: permalinkOf(source, { encoding: 'segments', range: 'always' }),
          },
        ]),
    ).values(),
  ];
}

function bytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function currentPage(
  input: CurrentScanInput,
  records: readonly CurrentRecord[],
  bounds: CurrentBounds,
): CurrentView {
  const { limit, offset = 0, maxBytes = 524_288 } = bounds;
  validateBounds({ limit, offset, maxBytes });
  let result: CurrentView = {
    snapshot: input.snapshot,
    component: input.binding.component,
    items: [],
    total: records.length,
    sourceLinks: links(input, []),
    coverage: input.coverage,
    gaps: [
      ...input.binding.limitations,
      'Source reachability does not prove branch feasibility, deployment, delivery or durability',
    ],
    truncated: false,
    execution: 'source_reachability_runtime_unverified',
    exhaustive: false,
    deployment: 'not_verified',
    nextOffset: null,
    limitsHit: [],
    frontiers: [],
  };
  if (bytes(result) + 512 > maxBytes) throw new Error('Current view metadata exceeds byte budget');
  for (const record of records.slice(offset, offset + limit)) {
    const items = [...result.items, record];
    const candidate = { ...result, items, sourceLinks: links(input, items) };
    if (bytes(candidate) + 512 > maxBytes) {
      result = { ...result, limitsHit: ['bytes'] };
      break;
    }
    result = candidate;
  }
  return completePage(result, records, offset);
}

function completePage(
  result: CurrentView,
  records: readonly CurrentRecord[],
  offset: number,
): CurrentView {
  const next = offset + result.items.length;
  const remaining = next < records.length;
  return {
    ...result,
    truncated: offset > 0 || remaining,
    nextOffset: remaining ? next : null,
    limitsHit: remaining && result.limitsHit.length === 0 ? ['records'] : result.limitsHit,
    frontiers: remaining
      ? [
          {
            at: records[next]?.id ?? result.snapshot,
            reason:
              'Bounded records or supporting source links remain; continue with nextOffset or a larger byte budget',
          },
        ]
      : [],
  };
}

function validateBounds(bounds: Required<CurrentBounds>): void {
  const { limit, offset, maxBytes } = bounds;
  if (!Number.isInteger(limit) || limit < 1 || limit > 2000) {
    throw new Error('Current view limit must be 1 to 2000');
  }
  if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid current view offset');
  if (!Number.isInteger(maxBytes) || maxBytes < 4096 || maxBytes > 2_000_000) {
    throw new Error('Current byte limit must be 4096 to 2000000');
  }
}
