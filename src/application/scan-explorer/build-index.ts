import type { ExplorerIndex, ExplorerSelection } from '@/domain/scan-explorer/contracts';

export function buildScanExplorer(selections: readonly ExplorerSelection[]): ExplorerIndex {
  if (new Set(selections.map(({ reader }) => reader.snapshot)).size !== selections.length) {
    throw new Error('Duplicate explorer snapshot selection');
  }
  return {
    selections,
    components: selections.flatMap(({ reader }) =>
      reader
        .select('kind', 'runtime_component')
        .filter((record) => record.kind === 'runtime_component')
        .map((record) => ({ snapshot: reader.snapshot, record })),
    ),
    entries: selections.flatMap(({ reader }) =>
      reader
        .select('kind', 'entry_binding')
        .filter((record) => record.kind === 'entry_binding')
        .map((record) => ({ snapshot: reader.snapshot, record })),
    ),
    interactions: selections.flatMap(({ reader }) =>
      reader
        .select('kind', 'interaction')
        .filter((record) => record.kind === 'interaction')
        .map((record) => ({ snapshot: reader.snapshot, record })),
    ),
  };
}
