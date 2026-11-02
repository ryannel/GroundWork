import type { AreaSystemBox, AreaSystemSize } from '@/application/area-system-layout';
import type { SystemNarrative } from '@/domain/system-narrative';

/** Columns describe one overview. Branches sit immediately beneath their related component. */
export function layoutNarrative(
  nodes: readonly AreaSystemSize[],
  story: SystemNarrative,
): readonly AreaSystemBox[] {
  const columns = story.stages.map((stage) =>
    [stage.component, ...stage.supporting].flatMap((id) => {
      const node = nodes.find((candidate) => candidate.id === id);
      return node === undefined ? [] : [node];
    }),
  );
  let x = 24;
  return columns.flatMap((column, rank) => {
    let y = 110;
    const boxes = column.map((node) => {
      const box = { ...node, x, y, rank };
      y += node.height + 100;
      return box;
    });
    x += Math.max(160, ...column.map((node) => node.width)) + 150;
    return boxes;
  });
}
