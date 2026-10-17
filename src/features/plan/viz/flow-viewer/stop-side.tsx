import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import type { Moment } from '@/application/plan/flow-experience';
import type { FlowStep, FlowMode } from '@/application/plan/flow-steps';
import {
  type ExperienceAt,
  experienceOf,
  momentOf,
  systemNav,
} from '@/application/plan-viz-experience';
import { type ChangeMarkers, decisionsOf, stepChanges } from '@/application/plan-viz-flow-changes';
import { narrate } from '@/application/plan-viz-flow-narration';
import type { Stop } from '@/application/plan-viz-flow-stops';
import { Experience } from '@/features/plan/viz/experience/experience';
import { SystemStepper } from '@/features/plan/viz/experience/system-stepper';

import { StepCard } from './step-card';

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
  /** Open on the stop that holds this step. */
  readonly stepId?: string | undefined;
}

/** What every stop of one flow is drawn from. */
export interface StopCtx {
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

export const screenMode = (mode: FlowMode): 'asIs' | 'toBe' => (mode === 'asIs' ? 'asIs' : 'toBe');

function experienceSide(ctx: StopCtx, stop: Stop, i: number): ReactNode {
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

function cardSide(ctx: StopCtx, stop: Stop, i: number): ReactNode {
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

function compactSide(ctx: StopCtx, stop: Stop, i: number): ReactNode {
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

/** What sits beside a stop's drawing: its experience, its step card, or the compact card and screen. */
export function sideOf(ctx: StopCtx, stop: Stop, i: number): ReactNode {
  if (ctx.opts.compact === true) return compactSide(ctx, stop, i);
  return ctx.withExperience ? experienceSide(ctx, stop, i) : cardSide(ctx, stop, i);
}
