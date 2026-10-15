import type { ReactNode } from 'react';

import { planHref } from '@/application/plan-pages';
import { teamNames } from '@/application/plan-story-ref';
import { refHead } from '@/application/plan-story-ref-words';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import type { BodyProps } from '@/features/plan/screen-bodies';

import { ApisCat } from './apis-cat';
import type { CatProps } from './catalogue-bits';
import { DecisionsCat } from './decisions-cat';
import { EventsCat } from './events-cat';
import { FlowsCat } from './flows-cat';
import { LedgerCat } from './ledger-cat';
import { MilestonesCat } from './milestones-cat';
import { OperationsCat } from './operations-cat';
import { RisksCat } from './risks-cat';
import { SchemasCat } from './schemas-cat';
import { ScreensCat } from './screens-cat';
import { ServicesCat } from './services-cat';
import { StoresCat } from './stores-cat';
import { TeamsCat } from './teams-cat';
import { TestsCat } from './tests-cat';
import { WorkCat } from './work-cat';

type Catalogue = (props: CatProps & { readonly base: string }) => ReactNode;

const CATALOGUES: Readonly<Record<string, Catalogue>> = {
  services: ServicesCat,
  stores: StoresCat,
  apis: ApisCat,
  schemas: SchemasCat,
  events: EventsCat,
  flows: FlowsCat,
  screens: ScreensCat,
  operations: OperationsCat,
  ledger: LedgerCat,
  tests: TestsCat,
  work: WorkCat,
  milestones: MilestonesCat,
  risks: RisksCat,
  teams: TeamsCat,
  decisions: DecisionsCat,
};

// Reference: every kind of thing the plan holds, one catalogue each, with a filter box and the team lens.
export function RefChapter({ model, outline, page }: BodyProps) {
  const { headline, lede } = refHead(model, page.screen);
  const props = { model, teams: teamNames(model), base: planHref(outline) };
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
