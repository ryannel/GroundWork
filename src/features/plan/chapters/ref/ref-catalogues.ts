import type { ReactNode } from 'react';

import type { CatProps } from './catalogue-bits';
import { DecisionsCat } from './decisions-cat';
import { MilestonesCat } from './milestones-cat';
import { RisksCat } from './risks-cat';
import { TeamsCat } from './teams-cat';
import { TestsCat } from './tests-cat';
import { WorkCat } from './work-cat';

type Catalogue = (props: CatProps & { readonly base: string }) => ReactNode;

// Every catalogue in Reference, by the screen it draws.
export const CATALOGUES: Readonly<Record<string, Catalogue>> = {
  tests: TestsCat,
  work: WorkCat,
  milestones: MilestonesCat,
  risks: RisksCat,
  teams: TeamsCat,
  decisions: DecisionsCat,
};
