import type { BodyProps } from '@/features/plan/screen-bodies';

import { OrderScreen } from './order-screen';
import { WorkScreen } from './work-screen';

/** Chapter 7, how we build it: the build order, then the work by team. */
export function BuildChapter({ page, ...rest }: BodyProps) {
  return page.screen === 'work-by-team' ? (
    <WorkScreen {...rest} page={page} />
  ) : (
    <OrderScreen {...rest} page={page} />
  );
}
