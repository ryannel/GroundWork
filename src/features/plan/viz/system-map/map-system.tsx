import type { DrawnNode } from '@/application/plan-viz-system-map-types';
import { SystemBoundaryHeader, SystemCard } from '@/ui/canvas/system-card';
import { CanvasBoundary, CanvasSystemScope } from '@/ui/connected-canvas.client';

export interface MapSystemProps {
  readonly node: DrawnNode;
  readonly onFold: (id: string) => void;
}

/** The same system identity, collapsed to a card or opened as a boundary around its components. */
export function MapSystem({ node, onFold }: MapSystemProps) {
  const handleToggle = (): void => {
    onFold(node.id);
  };
  return (
    <CanvasSystemScope colour={node.teamSlot}>
      {node.folded ? (
        <foreignObject height={node.h} pointerEvents="auto" width={node.w} x={0} y={0}>
          <SystemCard
            density="dense"
            inspect={node.id}
            meta={node.size}
            name={node.name}
            onExpand={handleToggle}
            owner={node.owner}
            purpose={node.role.join(' ')}
          />
        </foreignObject>
      ) : (
        <CanvasBoundary
          x={0}
          y={0}
          width={node.w}
          height={node.h}
          headerHeight={node.head - 20}
          header={
            <SystemBoundaryHeader
              dense
              inspect={node.id}
              name={node.name}
              onCollapse={handleToggle}
              purpose={node.role.join(' ')}
            />
          }
        />
      )}
    </CanvasSystemScope>
  );
}
