import type { ValueFlowRoute } from '@/application/area-map/value-flow-routing';
import type { ValueFlowDrawing } from '@/application/area-map/value-flow-system';
import { buildId } from '@/domain/ids';
import type { ConnectedCanvasFocus } from '@/ui/connected-canvas-types';

/** Frame all participants and their exact exchanges, including dispersed and independent contributions. */
export function selectedFlowFrame(
  layout: ValueFlowDrawing,
  selection: {
    readonly flow: string;
    readonly ids?: ReadonlySet<string> | undefined;
    readonly opened?: string | undefined;
  },
  routes: readonly Pick<ValueFlowRoute, 'points'>[],
): ConnectedCanvasFocus | undefined {
  const members = layout.nodes.filter((node) => selection.ids?.has(node.id) === true);
  if (members.length === 0) return undefined;
  const local = members.filter((node) => node.systemId === selection.opened);
  if (selection.opened !== undefined && local.length === 0) return undefined;
  const nodes = local.length === 0 ? members : local;
  const boxes = nodes;
  const points = local.length === 0 ? routes.flatMap((route) => route.points) : [];
  const x = Math.max(0, Math.min(...boxes.map((box) => box.x), ...points.map((p) => p.x)) - 32);
  const y = Math.max(0, Math.min(...boxes.map((box) => box.y), ...points.map((p) => p.y)) - 32);
  return {
    id: buildId('flow', `${selection.flow}:${selection.opened ?? ''}`),
    x,
    y,
    width: Math.max(
      600,
      ...boxes.map((box) => box.x + box.width + 32 - x),
      ...points.map((p) => p.x + 32 - x),
    ),
    height: Math.max(
      240,
      ...boxes.map((box) => box.y + box.height + 32 - y),
      ...points.map((p) => p.y + 32 - y),
    ),
    fit: true,
    maximumZoom: 1,
    revealViewport: true,
  };
}
