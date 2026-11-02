import type { ExplorerPage, ExplorerService } from '@/domain/service-explorer';

/** Expand a small published entry catalogue without assigning unexamined schemas or source ranges. */
export function explorerServiceOverview(
  page: ExplorerPage,
  service: ExplorerService,
): ExplorerPage {
  if (page.kind !== 'overview' || service.entries.length > 12) return page;
  const component = page.nodes.find((node) => node.kind === 'component');
  if (component === undefined || service.entries.length === 0) return page;
  const groups = new Set(page.nodes.filter((node) => node.kind === 'entry').map((node) => node.id));
  const entries = service.entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    detail:
      'Published entry. Open its implementation to inspect source logic and declared contracts.',
    kind: 'entry' as const,
    sourceIds: [],
    target: entry.file,
  }));
  return {
    ...page,
    nodes: [...page.nodes.filter((node) => !groups.has(node.id)), ...entries],
    links: [
      ...page.links.filter((link) => !groups.has(link.from) && !groups.has(link.to)),
      ...entries.map((entry) => ({
        id: `published:${entry.id}`,
        from: component.id,
        to: entry.id,
        label: 'Exposes entry',
        kind: 'interaction' as const,
        sourceIds: [],
      })),
    ],
  };
}
