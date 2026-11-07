import { areaSystemBounds, type AreaSystemBox } from '@/application/area-system-layout';
import type { AreaBoundaryView, AreaView } from '@/application/workspace-area';

export interface AreaBoundaryBox extends AreaSystemBox {
  readonly boundary: AreaBoundaryView;
  readonly componentBoxes: readonly never[];
  readonly componentRelationships: readonly never[];
}
export function areaBoundaryOf(
  view: AreaView,
  id: string | undefined,
): AreaBoundaryView | undefined {
  return view.boundaries?.find((boundary) => boundary.id === id);
}
/** Boundary rows are geometry only; they never become systems or components in the model. */
export function areaBoundaryBoxes(
  view: AreaView,
  systems: readonly AreaSystemBox[],
): readonly AreaBoundaryBox[] {
  const bounds = areaSystemBounds(systems);
  return (view.boundaries ?? []).map((boundary, position): AreaBoundaryBox => ({
    id: boundary.id,
    boundary,
    x: 48 + (position % 3) * 400,
    y: bounds.height + 100 + Math.floor(position / 3) * 240,
    width: 320,
    height: 180,
    rank: 0,
    componentBoxes: [],
    componentRelationships: [],
  }));
}
