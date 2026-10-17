import { planHref } from '@/application/plan-pages';
import { teamNames } from '@/application/plan-story-ref';
import { refHead } from '@/application/plan-story-ref-words';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { planJsonOf } from '@/features/plan/plan-model';
import type { BodyProps } from '@/features/plan/screen-bodies';

import { CATALOGUES } from './ref-catalogues';

// Reference: every kind of thing the plan holds, one catalogue each, with a filter box and the team lens.
export function RefChapter({ model, outline, page }: BodyProps) {
  const { headline, lede } = refHead(model, page.screen);
  const props = { model, teams: teamNames(model), base: planHref(outline), src: planJsonOf(page) };
  const Cat = CATALOGUES[page.screen];
  return (
    <>
      <ScreenHead headline={headline} outline={outline} page={page}>
        <p>{lede}</p>
      </ScreenHead>
      {Cat === undefined ? null : <Cat {...props} />}
    </>
  );
}
