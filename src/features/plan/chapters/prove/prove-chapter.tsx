import type { BodyProps } from '@/features/plan/screen-bodies';

import { ContractsScreen } from './contracts-screen';
import { CoverageScreen } from './coverage-screen';
import { E2eScreen } from './e2e-screen';

// Chapter 6: how the plan is proved — end-to-end tests over the flows, contract tests between services, and a matrix
// of every change against every kind of test. A small plan folds all three into the coverage screen.
export function ProveChapter(props: BodyProps) {
  switch (props.page.screen) {
    case 'e2e': {
      return <E2eScreen {...props} />;
    }
    case 'contracts': {
      return <ContractsScreen {...props} />;
    }
    default: {
      return <CoverageScreen {...props} />;
    }
  }
}
