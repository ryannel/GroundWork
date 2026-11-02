'use client';

import type { SystemMapInput } from '@/application/plan-viz-system-map-types';
import { useStopFocus } from '@/features/plan/viz/stops/stop-focus.client';
import { ZoomPane } from '@/features/plan/viz/zoompane/zoom-pane.client';
import { Legend, type LegendItem } from '@/ui/legend';

import { MapFigure } from './map-figure';
import { MapStages } from './map-stages';
import { MapToolbar } from './map-toolbar';
import { type LineFilter, useSystemMap } from './use-system-map';

const KEY: readonly LegendItem[] = [
  { label: 'call', line: 'solid' },
  { label: 'event', line: 'dashed' },
  { label: 'data', line: 'dotted' },
  {
    label:
      'Hover to trace connections · select a component for details · expand a system to explore it',
  },
];

function focusOf(stop: string | null): LineFilter {
  return stop === 'api' || stop === 'msg' || stop === 'data' ? stop : 'all';
}

interface MapPaneProps {
  readonly input: SystemMapInput;
  readonly focus: LineFilter;
  readonly outside: string | null;
}

function keyOf(outside: string | null): readonly LegendItem[] {
  return outside === null
    ? KEY
    : [...KEY.slice(0, -1), { label: outside, swatch: 'out' }, ...KEY.slice(-1)];
}

function MapPane({ input, focus, outside }: MapPaneProps) {
  const map = useSystemMap(input, focus);
  const { drawing, fold: handleFold, setTarget: handleTrace } = map;
  if (drawing === null) return null;
  return (
    <ZoomPane
      h={drawing.h}
      inline={<MapStages bands={drawing.bands} />}
      label="System map, full screen"
      legend={<Legend items={keyOf(outside)} />}
      tools={<MapToolbar map={map} />}
      w={drawing.w}
      what="the map"
      wide
    >
      <MapFigure
        drawing={drawing}
        filter={map.filter}
        onFold={handleFold}
        onTrace={handleTrace}
        trace={map.trace}
      />
    </ZoomPane>
  );
}

interface SystemMapViewProps {
  readonly input: SystemMapInput;
  /** What the dotted cards of a scoped map are, for the key: "outside this domain, one step away". */
  readonly outside?: string | null;
}

/** The system map: what the reader chose to see, drawn and traced as the pointer moves. A stop of the page can pick the lines. */
export function SystemMapView({ input, outside }: SystemMapViewProps) {
  const stop = useStopFocus();
  const focus = focusOf(stop);
  return <MapPane focus={focus} input={input} outside={outside ?? null} />;
}
