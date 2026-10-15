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
  { label: 'call (the caller waits)', line: 'solid' },
  { label: 'event (the publisher does not wait)', line: 'dashed' },
  { label: 'reads or writes another team’s store', line: 'dotted' },
  { label: 'system: components built and run as one', glyph: '⧉' },
  { label: 'Hover a card to trace it · click to open it' },
];

const MANY_STAGES = 4;

function focusOf(stop: string | null): LineFilter {
  return stop === 'api' || stop === 'msg' || stop === 'data' ? stop : 'all';
}

interface MapPaneProps {
  readonly input: SystemMapInput;
  readonly focus: LineFilter;
}

function MapPane({ input, focus }: MapPaneProps) {
  const map = useSystemMap(input, focus);
  const { drawing } = map;
  if (drawing === null) return null;
  return (
    <ZoomPane
      h={drawing.h}
      inline={<MapStages bands={drawing.bands} />}
      label="System map, full screen"
      legend={<Legend items={KEY} />}
      tools={<MapToolbar map={map} />}
      w={drawing.w}
      what="the map"
      wide
      {...(drawing.columns > MANY_STAGES ? { more: `${String(drawing.columns)} stages` } : {})}
    >
      <MapFigure
        drawing={drawing}
        filter={map.filter}
        onFold={map.fold}
        onTrace={map.setTarget}
        trace={map.trace}
      />
    </ZoomPane>
  );
}

/** The system map: what the reader chose to see, drawn and traced as the pointer moves. A stop of the page can pick the lines. */
export function SystemMapView({ input }: { readonly input: SystemMapInput }) {
  const stop = useStopFocus();
  const focus = focusOf(stop);
  return <MapPane focus={focus} input={input} key={focus} />;
}
