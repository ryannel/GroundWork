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
export function ChangesChapter({ model, page, ...rest }: BodyProps) {
  const found = changesLayout(model).find((s) => s.key === page.screen);
  if (found === undefined) return null;
  const { body } = found;
  switch (body.kind) {
    case 'flows': {
      return <FlowsScreen {...rest} model={model} page={page} ids={body.ids} />;
    }
    case 'screens': {
      return <ScreensScreen {...rest} model={model} page={page} ids={body.ids} />;
    }
    case 'graph': {
      return <GraphChangeScreen {...rest} model={model} page={page} />;
    }
    case 'contracts': {
      return <ContractsScreen {...rest} model={model} page={page} t={body.touched} />;
    }
    case 'records': {
      return <RecordsScreen {...rest} model={model} page={page} ids={body.ids} />;
    }
    case 'ledger': {
      return <LedgerScreen {...rest} model={model} page={page} />;
    }
    case 'small-flow': {
      return <SmallFlowScreen {...rest} model={model} page={page} body={body} />;
    }
    case 'more': {
      return <MoreScreen {...rest} model={model} page={page} body={body} />;
    }
  }
}
