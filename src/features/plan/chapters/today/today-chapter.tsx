import type { BodyProps } from '@/features/plan/screen-bodies';

import { DomainScreen } from './domain-screen';
import { GraphScreen } from './graph-screen';
import { ScreensScreen } from './screens-screen';
import { SystemScreen } from './system-screen';

// Chapter 2: the systems as they run today, with no change coloured in: the words, the map, the graph and the screens.
export function TodayChapter({ page, ...rest }: BodyProps) {
  switch (page.screen) {
    case 'domain': {
      return <DomainScreen {...rest} page={page} />;
    }
    case 'graph': {
      return <GraphScreen {...rest} page={page} />;
    }
    case 'screens': {
      return <ScreensScreen {...rest} page={page} />;
    }
    default: {
      return <SystemScreen {...rest} page={page} />;
    }
  }
}
