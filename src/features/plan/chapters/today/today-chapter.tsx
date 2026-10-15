import type { BodyProps } from '@/features/plan/screen-bodies';

import { DomainScreen } from './domain-screen';
import { GraphScreen } from './graph-screen';
import { ScreensScreen } from './screens-screen';
import { SystemScreen } from './system-screen';

// Chapter 2: the systems as they run today, with no change coloured in: the words, the map, the graph and the screens.
export function TodayChapter(props: BodyProps) {
  switch (props.page.screen) {
    case 'domain': {
      return <DomainScreen {...props} />;
    }
    case 'graph': {
      return <GraphScreen {...props} />;
    }
    case 'screens': {
      return <ScreensScreen {...props} />;
    }
    default: {
      return <SystemScreen {...props} />;
    }
  }
}
