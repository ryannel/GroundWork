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
  { label: 'Hover a card to trace it · click to keep it traced and read it' },
];

function focusOf(stop: string | null): LineFilter {
  return stop === 'api' || stop === 'msg' || stop === 'data' ? stop : 'all';
}

interface MapPaneProps {
  readonly input: SystemMapInput;
  readonly focus: LineFilter;
  readonly outside: string | null;
  readonly flow: boolean;
}

const FLOW_KEY: readonly LegendItem[] = [
  { label: 'made from', line: 'solid' },
  { label: 'Hover a card to trace it · click to keep it traced and read it' },
];

function keyOf(outside: string | null, flow: boolean): readonly LegendItem[] {
  const key = flow ? FLOW_KEY : KEY;
  return outside === null
    ? key
    : [...key.slice(0, -1), { label: outside, swatch: 'out' }, ...key.slice(-1)];
}

function MapPane({ input, focus, outside, flow }: MapPaneProps) {
  const map = useSystemMap(input, focus);
  const { drawing, fold: handleFold, setTarget: handleTrace } = map;
  if (drawing === null) return null;
  return (
    <ZoomPane
      h={drawing.h}
      inline={<MapStages bands={drawing.bands} />}
      label="System map, full screen"
      legend={<Legend items={keyOf(outside, flow)} />}
      tools={flow ? undefined : <MapToolbar map={map} />}
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
  /** Whether the lines are a flow of what is made from what, not today's calls, events and data. */
  readonly flow?: boolean;
}

/** The system map: what the reader chose to see, drawn and traced as the pointer moves. A stop of the page can pick the lines. */
export function SystemMapView({ input, outside, flow = false }: SystemMapViewProps) {
  const stop = useStopFocus();
  const focus = focusOf(stop);
  return <MapPane flow={flow} focus={focus} input={input} key={focus} outside={outside ?? null} />;
}
