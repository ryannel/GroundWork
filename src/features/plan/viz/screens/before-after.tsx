import type { Model } from '@/application/plan/derive';
import type { ProposedMarks } from '@/application/plan/proposed';
import { comparablePictures, regionNumbers, regionsOf } from '@/application/plan-viz-screens';

import { BeforeAfterView } from './before-after.client';
import { ProposedTag } from './proposed-tag';
import { ScreenFigure } from './screen-figure';

export interface BeforeAfterProps {
  readonly model: Model;
  /** The screen. */
  readonly id: string;
  /** Where the plan's pictures are served from. */
  readonly base: string;
  /** Ids of the regions to light on both pictures. */
  readonly focus?: readonly string[];
  readonly proposed?: ProposedMarks | null;
}

// Today | with this plan for a screen the plan touches. Regions are numbered alike on both pictures and in the
// region list; one the plan removes is outlined dashed on today's picture and ghosted on the new one.
export function BeforeAfter({ model, id, base, focus = [], proposed = null }: BeforeAfterProps) {
  const diff = model.screenDiff(id);
  if (diff.before === null && diff.after === null) return null;
  const rows = regionsOf(model, id, { mode: 'toBe', status: true });
  const shared = { base, caption: false, focus, id, model, numbers: regionNumbers(rows) };
  const removed = diff.regions.filter((r) => r.status === 'removed').map((r) => r.id);
  const both = diff.before !== null && diff.after !== null;
  return (
    <BeforeAfterView
      pictures={both ? comparablePictures(model, id, base) : null}
      plan={
        diff.after === null ? null : (
          <ScreenFigure {...shared} ghosts={rows.filter((r) => r.gone)} />
        )
      }
      planTag={<ProposedTag id={id} marks={proposed} />}
      today={
        diff.before === null ? null : <ScreenFigure {...shared} mode="asIs" removed={removed} />
      }
    />
  );
}
