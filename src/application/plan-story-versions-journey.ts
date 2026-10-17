import { prop } from '@/application/plan/ids';
import type { Journey, JourneyStep } from '@/application/plan/impact-journeys';
import type { ScreenChange } from '@/application/plan/impact-screens';
import {
  type BeforeAfter,
  beforeAfter,
  carryText,
  type Mark,
  markOf,
} from '@/application/plan-story-versions-marks';
import {
  nameIn,
  teamOfService,
  valueText,
  type View,
} from '@/application/plan-story-versions-pair';
import { screenView, type ScreenView } from '@/application/plan-story-versions-screens';
import { unmark } from '@/application/plan-story-versions-words';
import { builtBy, type WorkRow } from '@/application/plan-story-versions-work';

// The flows a revision changes, one step per row, with the steps that don't change folded away.

export type StepPart =
  | { readonly kind: 'alarm'; readonly text: string }
  | {
      readonly kind: 'key';
      readonly label: string;
      readonly diff: BeforeAfter | null;
      readonly text: string;
      readonly struck: boolean;
    }
  | { readonly kind: 'carry'; readonly text: string }
  | { readonly kind: 'screen'; readonly screen: ScreenView };

export interface StepView {
  readonly n: number;
  readonly id: string;
  readonly action: string;
  readonly route: string;
  readonly mark: Mark | null;
  readonly newCall: boolean;
  readonly reopened: string | null;
  readonly parts: readonly StepPart[];
  readonly builtBy: readonly WorkRow[];
  readonly open: boolean;
}

export type JourneyRow =
  | { readonly kind: 'step'; readonly step: StepView }
  | { readonly kind: 'fold'; readonly text: string; readonly title: string | null };

export interface FlowView {
  readonly id: string;
  readonly name: string;
  readonly badge: Mark | null;
  readonly actor: string | null;
  readonly rows: readonly JourneyRow[];
}

export interface JourneyView {
  readonly flows: readonly FlowView[];
  readonly loose: readonly ScreenView[];
}

const KEY_WORD: Readonly<Record<string, string>> = {
  logic: 'What it does',
  action: 'Step',
  from: 'From',
  to: 'To',
  via: 'Goes through',
  reads: 'Reads',
  writes: 'Writes',
  screen: 'Screen',
  case: 'Case',
  purges: 'Purges',
};

const MOVING = new Set(['rework', 'changes', 'drop']);

const redone = (view: View, id: string): boolean =>
  builtBy(view.pair, view.tense, id).some((w) => MOVING.has(w.effect));

/** The new dependency a step creates, by step id. */
function edgeAlarms({ pair, tense }: View): Map<string, string> {
  const alarms = new Map<string, string>();
  for (const e of pair.im.edges.filter((x) => x.crossTeam)) {
    const [from, to] = [teamOfService(pair, e.from), teamOfService(pair, e.to)];
    const today = e.before === 'event' ? `; today it only sends ${to} events` : '';
    const call = tense.t('would call', 'calls', 'would have called');
    for (const id of e.steps) {
      alarms.set(id, `**New dependency:** ${from} ${call} ${to} here${today}.`);
    }
  }
  return alarms;
}

const keyPart = (label: string, text: string, struck = false): StepPart => ({
  kind: 'key',
  label,
  diff: null,
  text,
  struck,
});

/** What the step says in the new version when it is added: its logic and what it reads and writes. */
function addedParts({ pair }: View, s: JourneyStep): StepPart[] {
  return ['logic', 'reads', 'writes'].flatMap((k) => {
    const text = valueText(pair, prop(s.after, k));
    return text === '' ? [] : [keyPart(KEY_WORD[k] ?? k, text)];
  });
}

function keysOf(view: View, s: JourneyStep): StepPart[] {
  if (s.mark === 'behaviour') {
    return s.keys.map((k) => ({
      kind: 'key',
      label: KEY_WORD[k] ?? k,
      diff: beforeAfter(view.pair, prop(s.before, k), prop(s.after, k)),
      text: '',
      struck: false,
    }));
  }
  if (s.mark === 'added') return addedParts(view, s);
  const did = s.mark === 'removed' ? unmark(s.before?.logic) : '';
  return did === '' ? [] : [keyPart('What it did', did, true)];
}

function carryPart({ pair, tense }: View, s: JourneyStep): StepPart[] {
  if (s.carries.length === 0) return [];
  const verb = tense.t('Passes on', 'Passed on', 'Would have passed on');
  return [
    {
      kind: 'carry',
      text: `${verb} ${s.carries.map((c) => carryText(pair, c.schema)).join('; ')}.`,
    },
  ];
}

function stepParts(view: View, s: JourneyStep, ctx: Context): StepPart[] {
  const alarm = ctx.alarms.get(s.id);
  const sc = s.screen === null ? undefined : ctx.screens.get(s.screen);
  // a screen that only shows the new data says nothing the step's own line doesn't
  const screen: StepPart[] =
    sc !== undefined && sc.mark !== 'data'
      ? [{ kind: 'screen', screen: screenView(view, sc, true) }]
      : [];
  return [
    ...(alarm === undefined ? [] : [{ kind: 'alarm', text: alarm } as const]),
    ...keysOf(view, s),
    ...carryPart(view, s),
    ...screen,
  ];
}

interface Context {
  readonly alarms: ReadonlyMap<string, string>;
  readonly screens: ReadonlyMap<string, ScreenChange>;
  readonly newFlow: boolean;
}

function stepView(
  view: View,
  at: { readonly s: JourneyStep; readonly n: number },
  ctx: Context,
): StepView {
  const { s, n } = at;
  const { pair, tense } = view;
  const { from, to } = s.step;
  const mark =
    s.mark !== null && !(ctx.newFlow && s.mark === 'added') ? markOf(s.mark, tense) : null;
  const rework = s.mark === 'data' && builtBy(pair, tense, s.id).some((w) => w.effect === 'rework');
  return {
    n,
    id: s.id,
    action: unmark(s.step.action),
    route: from !== '' && to !== '' ? `${nameIn(pair, from)} → ${nameIn(pair, to)}` : '',
    mark,
    newCall: ctx.alarms.has(s.id),
    reopened: rework
      ? tense.t('work reopened', 'work reopened', 'work would have been reopened')
      : null,
    parts: s.mark === null ? [] : stepParts(view, s, ctx),
    builtBy: s.mark === null ? [] : builtBy(pair, tense, s.id),
    // a step that only passes data on stays folded, unless the proposer says its work is redone
    open: s.mark !== 'data' || redone(view, s.id),
  };
}

type Group = 'same' | 'pass' | 'marked';

function groupOf(view: View, s: JourneyStep, ctx: Context): Group {
  if (s.mark === null) return 'same';
  const pass = s.mark === 'data' && !ctx.alarms.has(s.id) && !redone(view, s.id);
  return pass ? 'pass' : 'marked';
}

/** Three or more steps in a row that change nothing, or only pass the new data on, are one line. */
function foldRun(view: View, group: Group, run: readonly StepView[]): JourneyRow[] {
  const [first, last] = [run[0], run.at(-1)];
  if (run.length < 3 || first === undefined || last === undefined || group === 'marked') {
    return run.map((step) => ({ kind: 'step', step }));
  }
  if (group === 'same') {
    return [{ kind: 'fold', text: `${String(run.length)} steps unchanged`, title: null }];
  }
  const pass = view.tense.t('pass', 'passed', 'would have passed');
  return [
    {
      kind: 'fold',
      text: `Steps ${String(first.n)} to ${String(last.n)} ${pass} the new data on; nothing in them changes`,
      title: run.map((x) => x.action).join(' · '),
    },
  ];
}

function rowsOf(view: View, f: Journey, ctx: Context): JourneyRow[] {
  const runs: { readonly group: Group; readonly steps: readonly StepView[] }[] = [];
  for (const [i, s] of f.steps.entries()) {
    const group = groupOf(view, s, ctx);
    const last = runs.at(-1);
    const step = stepView(view, { s, n: i + 1 }, ctx);
    if (last?.group === group) runs[runs.length - 1] = { group, steps: [...last.steps, step] };
    else runs.push({ group, steps: [step] });
  }
  return runs.flatMap((r) => foldRun(view, r.group, r.steps));
}

function badgeOf(status: Journey['status']): Mark | null {
  if (status === 'added') return { text: 'new flow', cls: 'add' };
  if (status === 'removed') return { text: 'removed', cls: 'dep' };
  return null;
}

/** Every flow the revision touches, and the screens it changes that no flow step uses. */
export function journeyView(view: View): JourneyView {
  const { im } = view.pair;
  const screens = new Map(im.screens.map((s) => [s.id, s]));
  const alarms = edgeAlarms(view);
  const used = new Set(im.journeys.flatMap((f) => f.steps.map((s) => s.screen)));
  return {
    flows: im.journeys.map((f) => ({
      id: f.id,
      name: unmark(f.flow.name),
      badge: badgeOf(f.status),
      actor: f.flow.actor ?? null,
      rows: rowsOf(view, f, { alarms, screens, newFlow: f.status === 'added' }),
    })),
    loose: im.screens
      .filter((s) => !used.has(s.id) && s.mark !== 'data')
      .map((s) => screenView(view, s, false)),
  };
}
