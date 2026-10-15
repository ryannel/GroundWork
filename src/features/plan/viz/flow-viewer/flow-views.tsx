import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import { type Moment, flowExperience } from '@/application/plan/flow-experience';
import { type FlowStep, type FlowMode, flowSteps } from '@/application/plan/flow-steps';
import { flowToMermaid } from '@/application/plan/mermaid';
import {
  type ExperienceAt,
  experienceOf,
  momentOf,
  systemNav,
} from '@/application/plan-viz-experience';
import {
  type ChangeMarkers,
  changeMarkers,
  decisionsOf,
  stepChanges,
} from '@/application/plan-viz-flow-changes';
import { type FlowView, flowKey } from '@/application/plan-viz-flow-key';
import { narrate } from '@/application/plan-viz-flow-narration';
import { type Stop, stepStops } from '@/application/plan-viz-flow-stops';
import { Experience } from '@/features/plan/viz/experience/experience';
import { SystemStepper } from '@/features/plan/viz/experience/system-stepper';
import { JourneyStrip } from '@/features/plan/viz/screens/journey-strip';
import { Sequence } from '@/features/plan/viz/sequence/sequence';
import { Legend } from '@/ui/legend';

import { CopyMermaid } from './copy-mermaid.client';
import type { FlowShellProps, StopView } from './flow-shell.client';
import { StepCard } from './step-card';
import { StopDiagram } from './stop-diagram';

/** What a journey adds to each stop's experience. */
export interface ExperienceSlots {
  /** Marks under each moment's title, in the order of the moments. */
  readonly tabMarks?: readonly ReactNode[];
  readonly systemMarks?: ReadonlyMap<string, ReactNode>;
  /** What the plan changes at the stop, shown under the moment's heading. */
  readonly comparison?: (stop: Stop, index: number) => ReactNode;
  /** In a compact viewer, the screen the stop happens on, under the step. */
  readonly screen?: (moment: Moment | null) => ReactNode;
}

export interface FlowViewsOptions {
  /** Where the plan's pictures are served from. */
  readonly base: string;
  /** Today's flow or the plan's; the plan's unless the flow only exists today. */
  readonly mode?: FlowMode;
  /** One stop for each step, never grouped. */
  readonly singleSteps?: boolean;
  /** Draw the ◇ on the steps the plan changes. */
  readonly markers?: boolean;
  /** The experience is part of a journey that already says whether it is today's or the plan's. */
  readonly bare?: boolean;
  /** The step's card under a folded drawing, with its screen below, in place of the experience. */
  readonly compact?: boolean;
  readonly slots?: ExperienceSlots;
}

type Parts = Pick<FlowShellProps, 'stops' | 'keys' | 'tools' | 'sideFirst'>;

interface Ctx {
  readonly model: Model;
  readonly flowId: string;
  readonly base: string;
  readonly mode: FlowMode;
  readonly steps: readonly FlowStep[];
  readonly stops: readonly Stop[];
  readonly moments: readonly Moment[];
  readonly marks: ChangeMarkers | null;
  /** The flow has screens, so the experience view tells each stop rather than the step card. */
  readonly withExperience: boolean;
  readonly opts: FlowViewsOptions;
}

const screenMode = (mode: FlowMode): 'asIs' | 'toBe' => (mode === 'asIs' ? 'asIs' : 'toBe');

function experienceSide(ctx: Ctx, stop: Stop, i: number): ReactNode {
  const { model, base, mode, moments, opts } = ctx;
  const current = Math.max(momentOf(moments, stop.indices[0] ?? 0), 0);
  const at: ExperienceAt = {
    current,
    steps: ctx.steps,
    stops: ctx.stops,
    selected: stop.indices,
    mode: screenMode(mode),
  };
  const data = experienceOf(model, moments, at);
  const moment = moments[current];
  if (data === null || moment === undefined) return null;
  const nav = systemNav(moment, ctx.stops, i);
  return (
    <Experience
      bare={opts.bare}
      base={base}
      comparison={opts.slots?.comparison?.(stop, i)}
      data={data}
      mode={screenMode(mode)}
      model={model}
      stepper={<SystemStepper next={nav.next} prev={nav.prev} />}
      systemMarks={opts.slots?.systemMarks}
      tabMarks={opts.slots?.tabMarks}
    />
  );
}

function cardSide(ctx: Ctx, stop: Stop, i: number): ReactNode {
  const narration = narrate(ctx.steps, stop);
  if (narration === null) return null;
  const changes = [
    ...new Set(
      stop.indices.flatMap((n) => {
        const step = ctx.steps[n];
        return step === undefined ? [] : stepChanges(ctx.model, step);
      }),
    ),
  ];
  return (
    <>
      <StepCard
        changes={changes}
        decisions={decisionsOf(ctx.model, changes)}
        marks={ctx.marks?.markers}
        mode={screenMode(ctx.mode)}
        model={ctx.model}
        narration={narration}
        reasons={ctx.marks?.reasons}
      />
      {ctx.opts.slots?.comparison?.(stop, i)}
    </>
  );
}

function compactSide(ctx: Ctx, stop: Stop, i: number): ReactNode {
  const narration = narrate(ctx.steps, stop);
  const moment = ctx.moments[momentOf(ctx.moments, stop.indices[0] ?? 0)] ?? null;
  return (
    <>
      {narration === null ? null : (
        <StepCard mode={screenMode(ctx.mode)} model={ctx.model} narration={narration} />
      )}
      {ctx.opts.slots?.comparison?.(stop, i)}
      {ctx.opts.slots?.screen?.(moment)}
    </>
  );
}

function sideOf(ctx: Ctx, stop: Stop, i: number): ReactNode {
  if (ctx.opts.compact === true) return compactSide(ctx, stop, i);
  return ctx.withExperience ? experienceSide(ctx, stop, i) : cardSide(ctx, stop, i);
}

function stopView(ctx: Ctx, stop: Stop, i: number): StopView {
  const { model, flowId, mode } = ctx;
  return {
    key: stop.stepIds.join('+'),
    title: stop.title,
    marked: stop.stepIds.some((id) => ctx.marks?.markers[id] !== undefined),
    diagram: (
      <StopDiagram
        flowId={flowId}
        indices={stop.indices}
        markers={ctx.marks?.markers}
        mode={mode}
        model={model}
      />
    ),
    sequence: (
      <Sequence
        action="go"
        flowId={flowId}
        markers={ctx.marks?.markers}
        mode={mode}
        model={model}
        step={stop.indices}
      />
    ),
    strip:
      ctx.opts.compact === true ? null : (
        <JourneyStrip
          action="go"
          base={ctx.base}
          currentStepIds={stop.stepIds}
          flowId={flowId}
          mode={screenMode(mode)}
          model={model}
          stops={ctx.stops}
        />
      ),
    side: sideOf(ctx, stop, i),
  };
}

/**
 * Everything the viewer shows, drawn ahead for every stop: the diagram, the sequence, the screens strip, and the
 * experience or step card. The client shell only chooses which stop and view to reveal. Null when the flow has no steps.
 */
export function flowViews(model: Model, flowId: string, opts: FlowViewsOptions) {
  const mode = opts.mode ?? 'toBe';
  const stops = stepStops(model, flowId, { mode, singleSteps: opts.singleSteps === true });
  if (stops.length === 0) return null;
  const moments = flowExperience(model, flowId, mode);
  const marks = opts.markers === false ? null : changeMarkers(model, flowId);
  const withExperience = moments.some((m) => m.screen !== null);
  const ctx: Ctx = {
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
  const keyOf = (view: FlowView): ReactNode => (
    <Legend items={flowKey(model, flowId, { mode, view, marked, walkable: true })} />
  );
  const parts: Parts = {
    stops: stops.map((s, i) => stopView(ctx, s, i)),
    keys: { diagram: keyOf('diagram'), sequence: keyOf('sequence') },
    tools: <CopyMermaid text={flowToMermaid(model, flowId, { mode })} />,
    sideFirst: withExperience && opts.compact !== true,
  };
  return parts;
}
