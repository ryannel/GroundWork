import type { ExplorerPage } from '@/domain/service-explorer';
import type { ExplorerDrawing, ExplorerDrawingNode } from '@/shared/explorer-drawing';

interface ServiceDrawing {
  readonly positions: ReadonlyMap<string, readonly [number, number]>;
  readonly shapes: ReadonlyMap<string, ExplorerDrawingNode['shape']>;
  readonly groups: NonNullable<ExplorerDrawing['groups']>;
  readonly component: string;
}

/** A service owns its entries; containment is a visual boundary, not another runtime call. */
export function explorerServiceDrawing(page: ExplorerPage): ServiceDrawing | null {
  const component = page.nodes.find((node) => node.kind === 'component');
  const entries = page.nodes.filter((node) => node.kind === 'entry');
  if (page.kind !== 'overview' || component === undefined || entries.length === 0) return null;
  const shapes = new Map<string, ExplorerDrawingNode['shape']>([[component.id, 'header']]);
  const internal = [...entries, ...page.nodes.filter((node) => node.kind === 'schema')];
  const columns = internal.length > 3 ? 2 : 1;
  const positions = new Map<string, readonly [number, number]>([
    [component.id, [64 + (columns - 1) * 152, 40]],
  ]);
  for (const [index, node] of internal.entries()) {
    positions.set(node.id, [64 + (index % columns) * 304, 160 + Math.floor(index / columns) * 112]);
    shapes.set(node.id, 'row');
  }
  const dependencies = page.nodes.filter((node) => !positions.has(node.id));
  for (const [index, node] of dependencies.entries()) {
    positions.set(node.id, [
      560 + (columns - 1) * 304 + Math.floor(index / 6) * 380,
      40 + (index % 6) * 160,
    ]);
  }
  return {
    positions,
    shapes,
    component: component.id,
    groups: [
      {
        id: component.id,
        label: 'Service boundary',
        x: 40,
        y: 24,
        width: 328 + (columns - 1) * 304,
        height: 160 + Math.ceil(internal.length / columns) * 112,
      },
    ],
  };
}
