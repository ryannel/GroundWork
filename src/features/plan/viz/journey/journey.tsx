import type { Model } from '@/application/plan/derive';
import { type JourneyComparison, journeyComparison } from '@/application/plan/journey';
import { absenceOf, outlineOf } from '@/application/plan-viz-journey-outline';
import { type JourneyMode, stepIn } from '@/application/plan-viz-journey-words';
import { flowViews } from '@/features/plan/viz/flow-viewer/flow-views';

import { JourneyStepNotes } from './journey-notes';
import { JourneyScreen } from './journey-screen';
import { JourneyShell, type JourneyShellProps, type ModeView } from './journey-shell.client';

export interface JourneyProps {
  readonly model: Model;
  readonly flowId: string;
  /** Where the plan's pictures are served from. */
  readonly base: string;
  /** Open on this step; the first step when it is left out. */
  readonly stepId?: string | undefined;
  /** Open on today or on the plan; today unless the flow only exists with the plan. */
  readonly mode?: JourneyMode | undefined;
  /** A change the page already gives as its headline. */
  readonly omitChange?: string | undefined;
}

interface Build {
  readonly model: Model;
  readonly comparison: JourneyComparison;
  readonly base: string;
  readonly omitChange: string | undefined;
}

function notes(build: Build, mode: JourneyMode, stepId: string) {
  return (
    <JourneyStepNotes
      comparison={build.comparison}
      mode={mode}
      model={build.model}
      omitChange={build.omitChange}
      stepId={stepId}
    />
  );
}

function absences(
  build: Build,
  mode: JourneyMode,
  extraIds: readonly string[],
): ModeView['absences'] {
  const { model, comparison } = build;
  const ids = [
    ...comparison.rows.filter((r) => stepIn(r, mode) === null).map((r) => r.id),
    ...extraIds,
  ];
  return Object.fromEntries(
    ids.map((id) => [
      id,
      {
        view: absenceOf(model, comparison.id, { stepId: id, mode }),
        extra: notes(build, mode, id),
      },
    ]),
  );
}

function modeView(build: Build, mode: JourneyMode, extraIds: readonly string[]): ModeView {
  const { model, comparison, base } = build;
  const flow = mode === 'asIs' ? comparison.beforeFlow : comparison.afterFlow;
  const parts =
    flow === null
      ? null
      : flowViews(model, comparison.id, {
          base,
          mode,
          singleSteps: true,
          markers: false,
          bare: true,
          compact: true,
          slots: {
            comparison: (stop) => notes(build, mode, stop.stepIds[0] ?? ''),
            screen: (moment) => (
              <JourneyScreen base={base} mode={mode} model={model} moment={moment} />
            ),
          },
        });
  return {
    steps: parts?.stops.map((s) => s.key) ?? [],
    shell: parts,
    outline: outlineOf(model, comparison, mode),
    absences: absences(build, mode, extraIds),
  };
}

/** The first step of the view the reader opens on, else the first the plan knows of. */
function firstStep(comparison: JourneyComparison, mode: JourneyMode): string | undefined {
  const flow = mode === 'asIs' ? comparison.beforeFlow : comparison.afterFlow;
  return flow?.steps[0]?.id ?? comparison.rows[0]?.id;
}

function openMode(comparison: JourneyComparison, mode: JourneyMode | undefined): JourneyMode {
  if (mode !== undefined) return mode;
  return comparison.beforeFlow === null && comparison.afterFlow !== null ? 'toBe' : 'asIs';
}

interface ModesInput {
  readonly flowId: string;
  readonly base: string;
  /** Ids the reader may ask for that are not steps of the flow. */
  readonly extraIds?: readonly string[];
  readonly omitChange?: string | undefined;
}

/** Both views of a flow, ready to draw: the journey's whole picture, built once. */
export function journeyModes(model: Model, input: ModesInput): JourneyShellProps['modes'] {
  const comparison = journeyComparison(model, input.flowId);
  const build: Build = { model, comparison, base: input.base, omitChange: input.omitChange };
  const extra = input.extraIds ?? [];
  return { asIs: modeView(build, 'asIs', extra), toBe: modeView(build, 'toBe', extra) };
}

/**
 * A flow as it runs today and as it runs with the plan, one step at a time, with what the plan changes at each
 * step and where the steps one view lacks would sit.
 */
export function Journey({ model, flowId, base, stepId, mode, omitChange }: JourneyProps) {
  const comparison = journeyComparison(model, flowId);
  const opening = openMode(comparison, mode);
  const start = stepId ?? firstStep(comparison, opening);
  if (start === undefined) return <p>No steps are recorded in this flow.</p>;
  const unknown = comparison.rows.some((r) => r.id === start) ? [] : [start];
  const views = journeyModes(model, { flowId, base, extraIds: unknown, omitChange });
  return <JourneyShell modes={views} start={{ mode: opening, stepId: start }} />;
}
