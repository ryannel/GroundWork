import type { ExplorerNode, ExplorerPage, ExplorerSource } from '@/domain/service-explorer';

export function corpusIndexPages(input: {
  readonly id: string;
  readonly title: string;
  readonly nodes: readonly ExplorerNode[];
  readonly snapshot: string;
  readonly fileFor: (id: string) => string;
  readonly sources?: ReadonlyMap<string, ExplorerSource>;
}): readonly { readonly file: string; readonly page: ExplorerPage }[] {
  const batches = indexBatches(input.nodes, input.sources);
  const count = batches.length;
  return batches.map((nodes, index) => {
    const next: ExplorerNode[] =
      index + 1 < count
        ? [
            {
              id: 'next-page',
              label: `Next · ${String(index + 2)} of ${String(count)}`,
              detail: 'Continue the complete captured index.',
              kind: 'entry',
              sourceIds: [],
              target: input.fileFor(`${input.id}:${String(index + 1)}`),
            },
          ]
        : [];
    return {
      file: input.fileFor(`${input.id}:${String(index)}`),
      page: {
        format: 'service-explorer-page/v1',
        snapshot: input.snapshot,
        kind: 'overview',
        title: input.title,
        description: `${String(input.nodes.length)} captured items · page ${String(index + 1)} of ${String(count)}. Source presence does not establish runtime activation.`,
        nodes: [...nodes, ...next],
        links: [],
        fields: [],
        sources: [...new Set(nodes.flatMap((node) => node.sourceIds))].flatMap((id) => {
          const source = input.sources?.get(id);
          return source === undefined ? [] : [source];
        }),
        gaps: [],
        completeSelection: true,
      },
    };
  });
}

function indexBatches(
  nodes: readonly ExplorerNode[],
  sources: ReadonlyMap<string, ExplorerSource> | undefined,
): readonly (readonly ExplorerNode[])[] {
  const batches: ExplorerNode[][] = [];
  let current: ExplorerNode[] = [];
  let bytes = 0;
  for (const node of nodes) {
    const links = node.sourceIds.map((id) => sources?.get(id));
    const size = new TextEncoder().encode(JSON.stringify({ node, links })).byteLength;
    if (current.length > 0 && (current.length >= 60 || bytes + size > 48_000)) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(node);
    bytes += size;
  }
  if (current.length > 0 || batches.length === 0) batches.push(current);
  return batches;
}
