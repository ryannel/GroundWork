import type { BodyProps } from '@/features/plan/screen-bodies';

import { ProblemScreen } from './problem-screen';
import { PromiseScreen } from './promise-screen';
import { ScenariosScreen } from './scenarios-screen';

// Chapter 1: the problem in the evidence's own words, what is promised, and the scenarios it must make work.
export function WhyChapter({ page, ...rest }: BodyProps) {
  switch (page.screen) {
    case 'promise': {
      return <PromiseScreen {...rest} page={page} />;
    }
    case 'scenarios': {
      return <ScenariosScreen {...rest} page={page} />;
    }
    default: {
      return <ProblemScreen {...rest} page={page} />;
    }
  }
}
