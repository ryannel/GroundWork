import { ScreenHead } from '@/features/plan/chapters/screen-head';
import type { BodyProps } from '@/features/plan/screen-bodies';

import { BehindScreen } from './behind-screen';
import { ExecutionScreen } from './execution-screen';
import { GroupScreen } from './group-screen';

// Chapter 3: each flow as it runs today and as it runs with the plan, one scenario at a time; how the plan plays
// out; and what happens behind the button today.
export function JourneyChapter(props: BodyProps) {
  switch (props.page.screen) {
    case 'empty': {
      return (
        <ScreenHead
          headline="No journeys are recorded in this plan."
          outline={props.outline}
          page={props.page}
        >
          <p>The system today and what changes give the context there is.</p>
        </ScreenHead>
      );
    }
    case 'execution': {
      return <ExecutionScreen {...props} />;
    }
    case 'behind': {
      return <BehindScreen {...props} />;
    }
    default: {
      return <GroupScreen {...props} />;
    }
  }
}
