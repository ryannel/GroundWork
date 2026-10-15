import { behindStory } from '@/application/plan-story-journey-behind';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { Stops } from '@/features/plan/viz/stops/stops.client';

import { BehindBody } from './behind-body';

// What happens behind the button today: each operation the front end sends, one stop for each, with what it costs
// and whom to call when it is slow.
export function BehindScreen({ model, outline, page }: BodyProps) {
  const stops = behindStory(model).map((op) => ({
    key: op.id,
    title: op.name,
    headline: op.headline,
    lede: op.lede,
    body: <BehindBody model={model} op={op} outline={outline} />,
  }));
  return <Stops title={page.title} stops={stops} />;
}
