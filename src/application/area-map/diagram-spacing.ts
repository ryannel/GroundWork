import { diagramCaption } from '@/shared/diagram-caption';

/** Stable minimum corridors use displayed captions, not a fixed gap or a selected subset. */
export function diagramSpacing(
  edges: readonly { readonly from: string; readonly to: string; readonly label: string }[],
): { readonly horizontal: number; readonly vertical: number } {
  const captions = edges.map((edge) => diagramCaption(edge.label));
  return {
    horizontal: Math.max(160, ...captions.map((caption) => caption.width + 64)),
    vertical: Math.max(80, ...captions.map((caption) => caption.height * 2 + 32)),
  };
}
