import type { ReactNode } from 'react';

import { planHref } from '@/application/plan-pages';
import { refHead } from '@/application/reference/headings';
import { teamNames } from '@/application/reference/model';
import { isReferenceKind } from '@/application/reference/query';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { planJsonOf } from '@/features/plan/plan-model';
import type { BodyProps } from '@/features/plan/screen-bodies';

import { CATALOGUES } from './ref-catalogues';
import { ReferenceIndex } from './reference-index';

// Reference: every kind of thing the plan holds, one catalogue each, with a filter box and the team lens.
export function RefChapter({ model, outline, page, lens = null, searchParams }: BodyProps) {
  const { headline, lede } = refHead(model, page.screen);
  const props = {
    model,
    teams: teamNames(model),
    base: planHref(outline),
    src: planJsonOf(page),
    lens,
  };
  const Cat = CATALOGUES[page.screen];
  let content: ReactNode = null;
  if (isReferenceKind(page.screen)) {
    content = (
      <ReferenceIndex
        kind={page.screen}
        model={model}
        {...(searchParams === undefined ? {} : { params: searchParams })}
      />
    );
  } else if (Cat !== undefined) content = <Cat {...props} />;
  return (
    <>
      <ScreenHead headline={headline} outline={outline} page={page}>
        <p>{lede}</p>
      </ScreenHead>
      {content}
    </>
  );
}
