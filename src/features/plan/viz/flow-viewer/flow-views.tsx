import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import { flowExperience } from '@/application/plan/flow-experience';
import { flowSteps } from '@/application/plan/flow-steps';
import { flowToMermaid } from '@/application/plan/mermaid';
import { changeMarkers } from '@/application/plan-viz-flow-changes';
import { diagramFocus, flowDiagram } from '@/application/plan-viz-flow-diagram';
import type { FlowDiagramData } from '@/application/plan-viz-flow-drawn';
import { type FlowView, flowKey } from '@/application/plan-viz-flow-key';
import { type Stop, stepStops } from '@/application/plan-viz-flow-stops';
import { JourneyStrip } from '@/features/plan/viz/screens/journey-strip';
import { Sequence } from '@/features/plan/viz/sequence/sequence';
import { Legend } from '@/ui/legend';

import { CopyMermaid } from './copy-mermaid.client';
import type { FlowShellProps, StopView } from './flow-shell.client';
import { StopDiagram } from './stop-diagram';
import { type FlowViewsOptions, type StopCtx, screenMode, sideOf } from './stop-side';

type Parts = Pick<
  FlowShellProps,
  'stops' | 'keys' | 'tools' | 'sideFirst' | 'diagram' | 'sequence' | 'start'
>;

/** What every stop is drawn from, and the one drawing of the flow they share. */
type DrawnCtx = StopCtx & { readonly data: FlowDiagramData | null };

function stopView(ctx: DrawnCtx, stop: Stop, i: number): StopView {
  const { data } = ctx;
  const shown = new Set(stop.indices);
  return {
    key: stop.stepIds.join('+'),
    title: stop.title,
    marked: stop.stepIds.some((id) => ctx.marks?.markers[id] !== undefined),
    indices: stop.indices,
    focus: data === null ? null : diagramFocus(data, shown),
    strip:
      ctx.opts.compact === true ? null : (
        <JourneyStrip
          action="go"
          base={ctx.base}
          currentStepIds={stop.stepIds}
          flowId={ctx.flowId}
          mode={screenMode(ctx.mode)}
          model={ctx.model}
          stops={ctx.stops}
        />
      ),
    side: sideOf(ctx, stop, i),
  };
}

/**
 * Everything the viewer shows. The diagram and the sequence are drawn once, lit for the stop the viewer opens on, and
 * the client shell lights whichever stop it shows; drawing them for every stop made a page grow with the square of
 * its flow. The screens strip and the experience or step card are drawn for every stop. Null when the flow has no
 * steps.
 */
export function flowViews(model: Model, flowId: string, opts: FlowViewsOptions) {
  const mode = opts.mode ?? 'toBe';
  const stops = stepStops(model, flowId, { mode, singleSteps: opts.singleSteps === true });
  if (stops.length === 0) return null;
  const moments = flowExperience(model, flowId, mode);
  const marks = opts.markers === false ? null : changeMarkers(model, flowId);
  const withExperience = moments.some((m) => m.screen !== null);
  const ctx: StopCtx = {
    model,
    flowId,
    base: opts.base,
    mode,
    steps: flowSteps(model, flowId, mode),
    stops,
    moments,
    marks,
    withExperience,
    opts,
  };
  const marked = marks !== null && Object.keys(marks.markers).length > 0;
  const start = Math.max(
    stops.findIndex((s) => opts.stepId !== undefined && s.stepIds.includes(opts.stepId)),
    0,
  );
  const lit = stops[start]?.indices ?? [];
  const markers = marks?.markers;
  const data = flowDiagram(model, flowId, {
    mode,
    step: lit,
    ...(markers === undefined ? {} : { markers }),
  });
  const keyOf = (view: FlowView): ReactNode => (
    <Legend items={flowKey(model, flowId, { mode, view, marked, walkable: true })} />
  );
  const parts: Parts = {
    stops: stops.map((s, i) => stopView({ ...ctx, data }, s, i)),
    start,
    diagram: data === null ? null : <StopDiagram data={data} />,
    sequence: (
      <Sequence
        action="go"
        flowId={flowId}
        markers={markers}
        mode={mode}
        model={model}
        step={lit}
      />
    ),
    keys: { diagram: keyOf('diagram'), sequence: keyOf('sequence') },
    tools: <CopyMermaid text={flowToMermaid(model, flowId, { mode })} />,
    sideFirst: withExperience && opts.compact !== true,
  };
  return parts;
}
