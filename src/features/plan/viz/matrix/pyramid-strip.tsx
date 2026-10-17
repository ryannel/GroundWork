import type { Model } from '@/application/plan/derive';
import { pyramidView } from '@/application/plan-viz-tests';

import { type DrawProps, PyramidDrawing } from './pyramid-drawing';
import { PyramidByLens } from './pyramid-lens.client';

interface PyramidStripProps extends DrawProps {
  readonly model: Model;
  /** Follow the team lens in the address: each team's numbers go to the page, not each team's drawing. */
  readonly lensed?: boolean;
}

/**
 * Five rows, end-to-end on top and unit at the bottom, each bar sized by its test count, so the shape reads as a pyramid
 * (or does not). Per row: the tests, how many of the shown changes have one, and where it is a gap, a note beside it.
 */
export function PyramidStrip({ model, lensed = false, ...rest }: PyramidStripProps) {
  const everyone = pyramidView(model);
  if (!lensed) return <PyramidDrawing view={everyone} {...rest} />;
  const teams = Object.fromEntries(model.plan.teams.map((t) => [t.id, pyramidView(model, t.id)]));
  return <PyramidByLens everyone={everyone} teams={teams} {...rest} />;
}
