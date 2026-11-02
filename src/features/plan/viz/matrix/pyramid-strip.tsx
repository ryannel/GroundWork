import type { Model } from '@/application/plan/derive';
import { lensTeam } from '@/application/plan-pages-team';
import { pyramidView } from '@/application/plan-viz-tests';

import { type DrawProps, PyramidDrawing } from './pyramid-drawing';

interface PyramidStripProps extends DrawProps {
  readonly model: Model;
  /** The team lens in the address: the pyramid counts that team's changes. */
  readonly lens?: string | null | undefined;
}

/**
 * Five rows, end-to-end on top and unit at the bottom, each bar sized by its test count, so the shape reads as a pyramid
 * (or does not). Per row: the tests, how many of the shown changes have one, and where it is a gap, a note beside it.
 */
export function PyramidStrip({ model, lens = null, ...rest }: PyramidStripProps) {
  const team = lensTeam(model, lens);
  return (
    <PyramidDrawing
      view={team === null ? pyramidView(model) : pyramidView(model, team)}
      {...rest}
    />
  );
}
