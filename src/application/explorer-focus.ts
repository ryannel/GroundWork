import type { ExplorerLink, ExplorerNode, ExplorerPage } from '@/domain/service-explorer';

function visible(node: ExplorerNode, page: ExplorerPage, selected: string | null): boolean {
  if (node.kind !== 'call' || node.target !== null || node.id === selected) return true;
  const containers = new Set(['call', 'branch', 'return', 'failure']);
  return !page.links.some(
    (link) =>
      link.to === node.id &&
      page.nodes.some((parent) => parent.id === link.from && containers.has(parent.kind)),
  );
}
function kind(path: readonly ExplorerLink[]): ExplorerLink['kind'] {
  if (path.some((link) => link.kind === 'interaction')) return 'interaction';
  if (path.some((link) => link.kind === 'failure')) return 'failure';
  if (path.some((link) => link.kind === 'branch')) return 'branch';
  if (path.some((link) => link.kind === 'async')) return 'async';
  return path[0]?.kind ?? 'control';
}
function linksFrom(
  page: ExplorerPage,
  from: string,
  retained: ReadonlySet<string>,
): ExplorerLink[] {
  const pending = page.links.filter((link) => link.from === from).map((link) => [link]);
  const seen = new Set<string>();
  const links: ExplorerLink[] = [];
  while (pending.length > 0) {
    const path = pending.shift();
    const edge = path?.at(-1);
    if (edge === undefined || path === undefined || seen.has(edge.to)) continue;
    seen.add(edge.to);
    if (retained.has(edge.to)) {
      links.push({
        id: `focused:${from}:${edge.to}`,
        from,
        to: edge.to,
        kind: kind(path),
        label: path
          .map((link) => link.label)
          .join(' → ')
          .slice(0, 256),
        sourceIds: [...new Set(path.flatMap((link) => link.sourceIds))],
      });
    } else {
      pending.push(
        ...page.links.filter((link) => link.from === edge.to).map((link) => [...path, link]),
      );
    }
  }
  return links;
}
/** Rendering selection only: the delivered source graph and its snapshot are never modified. */
export function focusExplorerPage(page: ExplorerPage, selected: string | null): ExplorerPage {
  if (page.kind !== 'flow') return page;
  const nodes = page.nodes.filter((node) => visible(node, page, selected));
  if (nodes.length === page.nodes.length) return page;
  const retained = new Set(nodes.map((node) => node.id));
  return {
    ...page,
    nodes,
    links: nodes.flatMap((node) => linksFrom(page, node.id, retained)),
    gaps: [
      ...page.gaps,
      `${String(page.nodes.length - nodes.length)} nested expression operations are collapsed. Choose All source operations to inspect them; they may contain further behaviour.`,
    ],
  };
}
