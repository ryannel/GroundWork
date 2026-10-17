import type { ReactNode } from 'react';

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

// Every catalogue in Reference, by the screen it draws.
export const CATALOGUES: Readonly<Record<string, Catalogue>> = {
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
