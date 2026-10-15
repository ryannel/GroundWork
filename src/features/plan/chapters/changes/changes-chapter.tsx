import { changesLayout } from '@/application/plan-pages-screens-changes';
import type { BodyProps } from '@/features/plan/screen-bodies';

import { ContractsScreen } from './contracts-screen';
import { FlowsScreen } from './flow-screen';
import { GraphChangeScreen } from './graph-screen';
import { LedgerScreen } from './ledger-screen';
import { RecordsScreen } from './record-screen';
import { ScreensScreen } from './screen-panel';
import { MoreScreen, SmallFlowScreen } from './small-screens';

// Chapter 4: what changes. The layout says which screens exist and what each draws; this picks on the page's key.
export function ChangesChapter(props: BodyProps) {
  const found = changesLayout(props.model).find((s) => s.key === props.page.screen);
  if (found === undefined) return null;
  const { body } = found;
  switch (body.kind) {
    case 'flows': {
      return <FlowsScreen {...props} ids={body.ids} />;
    }
    case 'screens': {
      return <ScreensScreen {...props} ids={body.ids} />;
    }
    case 'graph': {
      return <GraphChangeScreen {...props} />;
    }
    case 'contracts': {
      return <ContractsScreen {...props} t={body.touched} />;
    }
    case 'records': {
      return <RecordsScreen {...props} ids={body.ids} />;
    }
    case 'ledger': {
      return <LedgerScreen {...props} />;
    }
    case 'small-flow': {
      return <SmallFlowScreen {...props} body={body} />;
    }
    case 'more': {
      return <MoreScreen {...props} body={body} />;
    }
  }
}
