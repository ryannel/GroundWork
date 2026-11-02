import { evidenceAnchor } from '@/domain/knowledge/evidence-anchor';
import type { ExplorerIndex } from '@/domain/scan-explorer/contracts';
import {
  currentCorrespondence,
  type CurrentCorrespondence,
} from '@/domain/scan-explorer/current-connections';
import type {
  CurrentBounds,
  CurrentScanInput,
  CurrentView,
} from '@/domain/scan-explorer/current-contracts';

import { retainedCallerAddresses } from './current-caller-adapter';

interface CallerPage {
  readonly items: readonly CurrentCorrespondence[];
  readonly sourceLinks: CurrentView['sourceLinks'];
  readonly truncated: boolean;
  readonly nextOffset: number | null;
  readonly total: number;
  readonly coverage: readonly { readonly snapshot: string; readonly scope: readonly string[] }[];
  readonly limitsHit: readonly ('records' | 'bytes')[];
  readonly exhaustive: false;
}

function sources(
  inputs: readonly CurrentScanInput[],
  matches: readonly CurrentCorrespondence[],
  index: ExplorerIndex | undefined,
): CurrentView['sourceLinks'] {
  const addresses = matches.flatMap((match) => [
    match.caller,
    ...(match.provider === null ? [] : [match.provider]),
  ]);
  const native = inputs.flatMap((input) => {
    const wanted = new Set(
      addresses
        .filter((address) => address.snapshot === input.snapshot)
        .flatMap((address) => address.sourceIds),
    );
    return input.sources
      .filter((source) => wanted.has(source.id))
      .map((source) => ({
        id: source.id,
        snapshot: input.snapshot,
        url: `https://github.com/${source.repo}/blob/${source.commit}/${source.path.split('/').map(encodeURIComponent).join('/')}#L${String(source.lines[0])}-L${String(source.lines[1])}`,
      }));
  });
  const external = addresses.flatMap((address) => {
    const reader = index?.selections.find(
      (selection) => selection.reader.snapshot === address.snapshot,
    )?.reader;
    if (reader === undefined) return [];
    return address.sourceIds.flatMap((id) => {
      const record = reader.get(id);
      if (record?.kind !== 'evidence') return [];
      const url = evidenceAnchor(record);
      return url === null ? [] : [{ id, snapshot: address.snapshot, url }];
    });
  });
  return [...native, ...external];
}

function page(
  inputs: readonly CurrentScanInput[],
  matches: readonly CurrentCorrespondence[],
  options: { readonly bounds: CurrentBounds; readonly index: ExplorerIndex | undefined },
): CallerPage {
  const { bounds, index } = options;
  const { limit, offset = 0, maxBytes = 524_288 } = bounds;
  if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid current callers offset');
  if (!Number.isInteger(maxBytes) || maxBytes < 4096 || maxBytes > 2_000_000) {
    throw new Error('Invalid current callers byte budget');
  }
  let result: CallerPage = {
    items: [],
    sourceLinks: [],
    truncated: false,
    nextOffset: null,
    total: matches.length,
    coverage: inputs.map((input) => ({ snapshot: input.snapshot, scope: input.coverage })),
    limitsHit: [],
    exhaustive: false,
  };
  for (const match of matches.slice(offset, offset + limit)) {
    const items = [...result.items, match];
    const candidate = { ...result, items, sourceLinks: sources(inputs, items, index) };
    if (new TextEncoder().encode(JSON.stringify(candidate)).byteLength + 512 > maxBytes) {
      result = { ...result, limitsHit: ['bytes'] };
      break;
    }
    result = candidate;
  }
  return complete(result, { offset, limit });
}

function complete(
  result: CallerPage,
  bounds: { readonly offset: number; readonly limit: number },
): CallerPage {
  const next = bounds.offset + result.items.length;
  const remaining = next < result.total;
  return {
    ...result,
    truncated: bounds.offset > 0 || remaining,
    nextOffset: remaining ? next : null,
    limitsHit: remaining && result.limitsHit.length === 0 ? ['records'] : result.limitsHit,
  };
}

export function currentCallers(
  inputs: readonly CurrentScanInput[],
  request: CurrentBounds & {
    readonly component: string;
  },
  index?: ExplorerIndex,
): CallerPage {
  if (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > 200) {
    throw new Error('Invalid current callers limit');
  }
  const matches = currentCorrespondence(
    inputs,
    index === undefined ? [] : retainedCallerAddresses(index),
  ).filter(
    (match) =>
      match.provider?.component === request.component ||
      match.caller.component === request.component,
  );
  return page(inputs, matches, { bounds: request, index });
}
