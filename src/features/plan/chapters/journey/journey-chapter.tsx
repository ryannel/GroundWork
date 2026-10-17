import { ScreenHead } from '@/features/plan/chapters/screen-head';
import type { BodyProps } from '@/features/plan/screen-bodies';

import { BehindScreen } from './behind-screen';
import { ExecutionScreen } from './execution-screen';
import { GroupScreen } from './group-screen';

// Chapter 3: each flow as it runs today and as it runs with the plan, one scenario at a time; how the plan plays
// out; and what happens behind the button today.
export function JourneyChapter({ page, outline, ...rest }: BodyProps) {
  switch (page.screen) {
    case 'empty': {
      return (
        <ScreenHead headline="No journeys are recorded in this plan." outline={outline} page={page}>
          <p>The system today and what changes give the context there is.</p>
        </ScreenHead>
      );
    }
    case 'execution': {
      return <ExecutionScreen {...rest} outline={outline} page={page} />;
    }
    case 'behind': {
      return <BehindScreen {...rest} outline={outline} page={page} />;
    }
    default: {
      return <GroupScreen {...rest} outline={outline} page={page} />;
    }
  }
}
