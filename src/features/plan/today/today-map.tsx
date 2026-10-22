import type { ModelScope } from '@/application/model-scope';
import type { Model } from '@/application/plan/derive';
import { systemStops } from '@/application/plan-story-today-system';
import { systemMapInput } from '@/application/plan-viz-system-map-input';
import { scopeMapInput } from '@/application/plan-viz-system-map-scope';
import { tieredMapInput } from '@/application/plan-viz-system-map-tiers';
import { mapScopeOf, outsideOf } from '@/application/today-scope';
import type { Workspace } from '@/domain/workspace';
import { StopUnder } from '@/features/plan/chapters/today/stop-under';
import { SystemMapView } from '@/features/plan/viz/system-map/system-map.client';

import { TodayStops } from './today-stops.client';

interface TodayMapProps {
  readonly model: Model;
  readonly workspace: Workspace;
  /** What the page is about: the whole workspace, a domain or a system. */
  readonly scope: ModelScope;
}

const unplanned = (line: string): string =>
  line.replaceAll(' in this plan', '').replaceAll(' of it', ' of the work');

// The map of today for one scope. On the landscape it is read in stops: who owns what, the calls, the events and
// the stores. In a domain or a system it holds only what is there and what is one step away, marked as outside.
export function TodayMap({ model, workspace, scope }: TodayMapProps) {
  const tiered = tieredMapInput(systemMapInput(model), model, workspace);
  const input = scopeMapInput(tiered, mapScopeOf(workspace, scope));
  if (input.services.length === 0) return null;
  const map = <SystemMapView input={input} outside={outsideOf(scope)} />;
  if (scope.kind !== 'workspace') return map;
  const stops = systemStops(model).map((stop) => ({
    key: stop.key,
    title: stop.title,
    headline: unplanned(stop.headline),
    lede: stop.lede,
    focus: stop.focus,
    body: <StopUnder below={stop.below} model={model} />,
  }));
  return <TodayStops stops={stops}>{map}</TodayStops>;
}
