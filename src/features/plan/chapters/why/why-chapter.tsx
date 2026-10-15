import type { BodyProps } from '@/features/plan/screen-bodies';

import { ProblemScreen } from './problem-screen';
import { PromiseScreen } from './promise-screen';
import { ScenariosScreen } from './scenarios-screen';

// Chapter 1: the problem in the evidence's own words, what is promised, and the scenarios it must make work.
export function WhyChapter(props: BodyProps) {
  switch (props.page.screen) {
    case 'promise': {
      return <PromiseScreen {...props} />;
    }
    case 'scenarios': {
      return <ScenariosScreen {...props} />;
    }
    default: {
      return <ProblemScreen {...props} />;
    }
  }
}
