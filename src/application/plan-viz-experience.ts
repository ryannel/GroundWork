import type { Model } from '@/application/plan/derive';
import type { Moment, MomentKind } from '@/application/plan/flow-experience';
import type { FlowStep } from '@/application/plan/flow-steps';
import { chipInfo } from '@/application/plan-chips';
import { type ScreenMode, screenIn } from '@/application/plan-viz-screens';

// A flow walked as what the person sees: moments on screens, and the system work that follows each.

/** A call from a UI service can be automatic; direction alone does not establish a user action. */
export const MOMENT_WORDS: Readonly<Record<MomentKind, string>> = {
  action: 'On screen',
  update: 'Screen update',
  output: 'Output',
  linked: 'Screen reference',
  background: 'Background work',
};

/** The stop (1-based, as the drawing numbers them) that holds a step; 0 when none does. */
export const stopNumber = (
  stops: readonly { readonly indices: readonly number[] }[],
  step: number,
): number => stops.findIndex((s) => s.indices.includes(step)) + 1;

export interface MomentTab {
  readonly word: string;
  readonly screen: string | null;
  readonly title: string;
  /** The stop that opens the moment. */
  readonly stop: number;
  readonly current: boolean;
  readonly anchor: number;
}

export interface SystemStep {
  readonly n: number;
  readonly id: string;
  readonly stop: number;
  readonly current: boolean;
  readonly action: string;
  readonly from: string;
  readonly to: string;
  readonly event: boolean;
  readonly logic: string;
  readonly fails: string;
}

export type ScreenShown =
  | { readonly kind: 'figure'; readonly id: string; readonly focus: readonly string[] }
  | { readonly kind: 'missing' }
  | { readonly kind: 'none' };

export interface ExperienceData {
  /** Whether it is today's experience or the planned one. */
  readonly topline: string;
  readonly tabs: readonly MomentTab[];
  readonly word: string;
  readonly screenName: string | null;
  readonly title: string;
  /** What the region shows, in markdown. */
  readonly shows: string;
  readonly linked: boolean;
  readonly screen: ScreenShown;
  /** The stop that traces the system work, when the moment is an action with system steps after it. */
  readonly trace: number | null;
  readonly next: { readonly stop: number; readonly title: string } | null;
  readonly systems: readonly SystemStep[];
  /** The key the scroll position is remembered under. */
  readonly key: string;
}

interface Where {
  readonly screen: string | null;
  readonly region: string | null;
}

function regionOf(model: Model, where: Where, mode: ScreenMode) {
  const screen = where.screen === null ? undefined : screenIn(model, where.screen, mode);
  const region =
    where.region === null ? undefined : screen?.regions.find((r) => r.id === where.region);
  return { screen, region };
}

function screenShown(model: Model, m: Moment, mode: ScreenMode): ScreenShown {
  if (m.screen === null) return { kind: 'none' };
  const graph = model[mode];
  if (!graph.has(m.screen)) return { kind: 'missing' };
  return { kind: 'figure', id: m.screen, focus: m.region === null ? [] : [m.region] };
}

function systemStep(
  model: Model,
  step: FlowStep,
  at: { readonly i: number; readonly stop: number; readonly on: boolean },
) {
  return {
    n: at.i + 1,
    id: step.id,
    stop: at.stop,
    current: at.on,
    action: step.action === '' ? step.id : step.action,
    from: chipInfo(model, step.from).label,
    to: chipInfo(model, step.to).label,
    event: step.via.startsWith('msg:'),
    logic: step.logic ?? '',
    fails: step.fails ?? '',
  };
}

/**
 * What the experience view shows for one moment: the moments as tabs, the screen, and the system steps it
 * leads to. `selected` is the step indices of the stop the reader is on.
 */
export interface ExperienceAt {
  /** The moment the reader is in. */
  readonly current: number;
  readonly steps: readonly FlowStep[];
  readonly stops: readonly { readonly indices: readonly number[] }[];
  /** The step indices of the stop the reader is on. */
  readonly selected: readonly number[];
  readonly mode: ScreenMode;
}

export function experienceOf(
  model: Model,
  moments: readonly Moment[],
  at: ExperienceAt,
): ExperienceData | null {
  const m = moments[at.current];
  if (m === undefined) return null;
  const { mode } = at;
  const { screen, region } = regionOf(model, m, mode);
  const next = moments[at.current + 1];
  const systems = m.indices.flatMap((i) => {
    const step = at.steps[i];
    return step === undefined
      ? []
      : [
          systemStep(model, step, {
            i,
            stop: stopNumber(at.stops, i),
            on: at.selected.includes(i),
          }),
        ];
  });
  const second = m.indices[1];
  return {
    topline: mode === 'asIs' ? 'The experience today' : 'The planned experience',
    tabs: moments.map((x, i) => ({
      word: MOMENT_WORDS[x.kind],
      screen: x.screen === null ? null : chipInfo(model, x.screen).label,
      title: x.title,
      stop: stopNumber(at.stops, x.anchor),
      current: i === at.current,
      anchor: x.anchor,
    })),
    word: MOMENT_WORDS[m.kind],
    screenName: screen?.name ?? null,
    title: m.title,
    shows: region?.shows ?? '',
    linked: m.kind === 'linked',
    screen: screenShown(model, m, mode),
    trace: m.kind === 'action' && second !== undefined ? stopNumber(at.stops, second) : null,
    next:
      next === undefined ? null : { stop: stopNumber(at.stops, next.anchor), title: next.title },
    systems,
    key: `${mode}:${at.steps[m.anchor]?.id ?? ''}`,
  };
}

export interface LinkedScreen {
  readonly label: string;
  readonly id: string;
  readonly focus: readonly string[];
  readonly present: boolean;
}

/** The screen a moment is linked to, for the side column. */
export function linkedScreen(model: Model, moment: Moment, mode: ScreenMode): LinkedScreen | null {
  if (moment.screen === null) return null;
  return {
    label: chipInfo(model, moment.screen).label,
    id: moment.screen,
    focus: moment.region === null ? [] : [moment.region],
    present: model[mode].has(moment.screen),
  };
}

export interface SystemNav {
  readonly stop: number;
  readonly title: string;
}

/** The stops before and after the one the reader is on, among those that belong to the moment. */
export function systemNav(
  moment: Moment,
  stops: readonly { readonly title: string; readonly indices: readonly number[] }[],
  selected: number,
): { readonly prev: SystemNav | null; readonly next: SystemNav | null } {
  const available = stops.flatMap((s, i) =>
    s.indices.some((x) => moment.indices.includes(x)) ? [{ title: s.title, stop: i + 1 }] : [],
  );
  const at = available.findIndex((a) => a.stop === selected + 1);
  return { prev: available[at - 1] ?? null, next: available[at + 1] ?? null };
}

/** The moment that holds a stop's first step, or -1. */
export const momentOf = (moments: readonly Moment[], first: number): number =>
  moments.findIndex((m) => m.indices.includes(first));
