import { systemStops } from '@/application/plan-story-today-system';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { Stops } from '@/features/plan/viz/stops/stops.client';
import { SystemMap } from '@/features/plan/viz/system-map/system-map';

import { StopUnder } from './stop-under';

// One map of the whole system; its stops bring forward the owners, then the calls, the events and the stores.
export function SystemScreen({ model, page }: BodyProps) {
  const stops = systemStops(model).map((stop) => ({
    key: stop.key,
    title: stop.title,
    headline: stop.headline,
    lede: stop.lede,
    focus: stop.focus,
    body: <StopUnder below={stop.below} model={model} />,
  }));
  return (
    <Stops title={page.title} stops={stops}>
      <SystemMap model={model} />
    </Stops>
  );
}
