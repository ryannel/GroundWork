// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { orderEventV2 } from '@/../test/fixtures/acme/plans/versions-order-event';
import { revisionImpact } from '@/application/plan/impact';
import type { Check } from '@/application/plan/impact-check-types';
import type { FieldDelta } from '@/application/plan/impact-fields';
import type { WorkImpact } from '@/application/plan/impact-work';
import { planDiff } from '@/application/plan/plan-diff';
import { type CheckView, checkViews } from '@/application/plan-story-versions-checks';
import type { Pair } from '@/application/plan-story-versions-pair';
import { tenseOf } from '@/application/plan-story-versions-words';
import type { Plan } from '@/domain/plan/plan.generated';

const base = orderEventV2();
const dated: Plan = {
  ...base,
  milestones: [
    { id: 'ms:dual', name: 'M1 · Both versions', exit: 'v2 is out.', due: '2026-10-16' },
    { id: 'ms:moved', name: 'Everyone on v2', exit: 'Nothing reads v1.' },
  ],
};
const im = revisionImpact({ from: base, to: dated });
const entry = {
  version: '1.1',
  status: 'proposed',
  date: '2026-05-01',
  summary: 'A try.',
} as const;

function pairWith(checks: readonly Check[], work: readonly WorkImpact[] = []): Pair {
  return {
    from: base,
    to: dated,
    fromVersion: '1.0',
    toVersion: '1.1',
    entry,
    diff: planDiff(base, dated),
    im: { ...im, checks, work },
  };
}

const live = tenseOf('proposed');
const past = tenseOf('approved');
const would = tenseOf('rejected');

function only(check: Check, tense = live, work: readonly WorkImpact[] = []): CheckView {
  const [view] = checkViews(pairWith([check], work), tense);
  if (view === undefined) throw new Error('no view');
  return view;
}

const edge = (call: 'call' | 'event', before: 'event' | null): Check => ({
  kind: 'new-edge',
  level: 'warn',
  from: 'svc:order-desk',
  to: 'svc:nowhere',
  call,
  before,
  steps: ['flow:place-order#desk'],
  message: null,
});

const work = (edit: Partial<WorkImpact>): WorkImpact => ({
  id: 'wi:publish-v2',
  title: 'Publish v2',
  team: 'team:orders',
  size: null,
  milestone: null,
  state: 'done',
  effect: 'rework',
  why: [],
  authored: false,
  note: null,
  inferred: true,
  gone: false,
  ...edit,
});

const delta = (name: string): FieldDelta => ({
  schema: 'sch:order-placed-v2',
  name,
  kind: 'added',
  before: null,
  after: null,
  keys: [],
  cosmetic: false,
  verdict: 'safe',
  breaking: false,
  stored: false,
});

const breaking = (change: FieldDelta['kind'], stored: boolean): Check => ({
  kind: 'breaking',
  level: 'warn',
  schema: 'sch:order-placed-v2',
  field: 'total_cents',
  change,
  verdict: 'breaking',
  stored,
});

const sets = (
  writes: readonly { readonly step: string; readonly schema: string }[],
  note: string | null,
): Check => ({
  kind: 'who-sets',
  level: 'warn',
  schema: 'sch:order-placed-v2',
  field: 'total_cents',
  note,
  candidates: ['flow:place-order#publish'],
  writes,
});

const contract = (consumers: readonly string[], breaks: boolean): Check => ({
  kind: 'contract',
  level: breaks ? 'warn' : 'note',
  message: 'msg:order-placed-v2',
  consumers,
  fields: [delta('total_cents'), delta('currency')],
  breaking: breaks,
});

const moved = (fromDue: string | null, toDue: string | null): Check => ({
  kind: 'milestone',
  level: 'warn',
  milestone: 'ms:dual',
  fromDue,
  toDue,
});

const field = (tests: readonly string[]): Check => ({
  kind: 'untested-field',
  level: 'ask',
  schema: 'sch:order-placed-v2',
  field: 'total_cents',
  tests,
});

describe('a new edge', () => {
  it('warns that a direct call replaces events, in each tense', () => {
    const now = only(edge('call', 'event'));
    expect(now).toMatchObject({ level: 'warn', icon: '!', word: 'Needs an answer' });
    expect(now.text).toBe(
      '**Orders would call nowhere directly.** Today Orders only sends nowhere events, so a nowhere outage would stop Orders.',
    );
    expect(now.at).toEqual(['flow:place-order#desk']);
    expect(now.atLabel).toBe('Where');
    expect(now.inline).toBe(false);
    expect(only(edge('call', 'event'), past).text).toContain('now calls');
    expect(only(edge('call', 'event'), past).text).toContain('can stop');
    expect(only(edge('call', 'event'), would).text).toContain('would have called');
    expect(only(edge('call', 'event'), would).text).toContain('would have stopped');
  });

  it('says the caller waits on a call that had no events before', () => {
    expect(only(edge('call', null)).text).toBe(
      '**Orders would call nowhere directly.** If nowhere is down, Orders waits.',
    );
  });

  it('says a team starts listening to events', () => {
    expect(only(edge('event', 'event')).text).toBe(
      "**Orders starts listening to nowhere's events.** If nowhere is down, Orders waits.",
    );
    expect(only(edge('event', null), past).text).toContain("Orders listens to nowhere's events");
    expect(only(edge('event', null), would).text).toContain('would have listened');
  });
});

describe('a breaking field', () => {
  it('says how the field changes and who breaks', () => {
    expect(only(breaking('removed', false))).toMatchObject({
      text: '**`total_cents` is removed from order.placed v2.** Everyone reading it breaks until they change.',
      at: ['sch:order-placed-v2'],
      atLabel: '',
    });
    expect(only(breaking('added', true)).text).toBe(
      '**`total_cents` arrives required on order.placed v2.** Data already stored has no value for it. Say how it is filled.',
    );
    expect(only(breaking('edited', false)).text).toContain(
      '`total_cents` on order.placed v2 changes type or becomes required',
    );
  });
});

describe('who sets a field', () => {
  it('says no step writes the record', () => {
    const view = only(sets([], null));
    expect(view.text).toBe(
      '**No step writes order.placed v2, so nothing fills `total_cents`.** Say which step sets it.',
    );
    expect(view.at).toEqual([]);
    expect(view.inline).toBe(false);
  });

  it('quotes the field note without its trailing stop', () => {
    const view = only(
      sets([{ step: 'flow:place-order#desk', schema: 'sch:order-placed-v2' }], 'In cents. . '),
    );
    expect(view.text).toBe(
      "**“Show the order on the desk” writes order.placed v2 but doesn't say it fills `total_cents`.** The field's note says: “In cents.” Say so in the step, or the field stays empty.",
    );
    expect(view).toMatchObject({
      at: ['flow:place-order#publish'],
      atLabel: 'First stored at',
      inline: true,
    });
  });

  it('keeps the note sentence when it has no stop to strip', () => {
    expect(only(sets([], 'Whole cents')).text).toContain("The field's note says: “Whole cents.”");
    expect(only(sets([], '...')).text).toContain("The field's note says: “.”");
  });
});

describe('a contract', () => {
  it('says one reader breaks', () => {
    const view = only(contract(['svc:order-mailer'], true));
    expect(view.text).toBe(
      'The order.placed event gains `total_cents` and `currency`. Orders reads it. It breaks until it changes.',
    );
    expect(view).toMatchObject({ level: 'warn', at: ['msg:order-placed-v2'] });
  });

  it('says several readers keep working with an optional field', () => {
    const view = only(contract(['svc:order-mailer', 'svc:nowhere'], false), past);
    expect(view).toMatchObject({ level: 'note', icon: '·', word: 'Good to know' });
    expect(view.text).toBe(
      'The order.placed event gained `total_cents` and `currency`. Orders and nowhere read it. It is optional, so they keep working as they are.',
    );
  });

  it('names no readers when there are none', () => {
    expect(only(contract([], true), would).text).toBe(
      'The order.placed event would have gained `total_cents` and `currency`. They break until they change.',
    );
    expect(only(contract([], false)).text).toContain('they keep working as they are');
  });
});

describe('reopened work', () => {
  const rework: Check = {
    kind: 'rework',
    level: 'warn',
    items: ['wi:publish-v2', 'wi:consumers-v2', 'wi:retire-v1', 'wi:gone'],
  };

  it('lists each item’s size and milestone, with the due day when there is one', () => {
    const view = only(rework, live, [
      work({ size: 'S', milestone: 'ms:dual' }),
      work({ id: 'wi:consumers-v2', size: null, milestone: 'ms:moved' }),
      work({ id: 'wi:retire-v1', size: 'XS', milestone: null }),
    ]);
    expect(view.text).toBe(
      '**Done work is reopened.** Orders (size S · M1 due 16 Oct), Orders (Everyone on v2) and Orders (size XS).',
    );
    expect(view.at).toEqual(rework.items);
  });

  it('falls back to the milestone id and to nothing at all', () => {
    const view = only(rework, live, [
      work({ milestone: 'ms:unknown' }),
      work({ id: 'wi:consumers-v2' }),
    ]);
    expect(view.text).toBe('**Done work is reopened.** Orders (ms:unknown) and Orders ().');
  });

  it('says only that work is reopened when no item is known', () => {
    expect(only(rework).text).toBe('**Done work is reopened.**');
  });
});

describe('a moved milestone', () => {
  it('says where it moves from and to', () => {
    expect(only(moved('2026-10-02', '2026-10-16')).text).toBe(
      '**Moves a milestone** from 2 Oct to 16 Oct.',
    );
    expect(only(moved(null, '2026-10-16')).text).toBe(
      '**Moves a milestone** from no date to 16 Oct.',
    );
    expect(only(moved('2026-10-02', null)).text).toBe(
      '**Moves a milestone** from 2 Oct to no date.',
    );
  });

  it('says only that it moves when the day is the same', () => {
    expect(only(moved('2026-10-02', '2026-10-02'))).toMatchObject({
      text: '**Moves a milestone**.',
      at: ['ms:dual'],
    });
  });
});

describe('what is untested', () => {
  it('names a step no test runs, in each tense', () => {
    const step: Check = { kind: 'untested-step', level: 'ask', step: 'flow:place-order#desk' };
    expect(only(step)).toMatchObject({
      icon: '?',
      word: 'Open point',
      text: '**No test runs “Show the order on the desk”**, which works differently.',
      at: ['flow:place-order#desk'],
    });
    expect(only(step, past).text).toContain('which changed.');
    expect(only(step, would).text).toContain('which would have changed.');
  });

  it('points at the nearest test, or where the value is set', () => {
    expect(only(field(['test:a']))).toMatchObject({
      text: '**No test checks `total_cents`.** Add a case to the nearest test.',
      at: ['test:a'],
      atLabel: 'Nearest test',
    });
    expect(only(field([]))).toMatchObject({
      text: '**No test checks `total_cents`.** Add one where the value is set.',
      at: [],
      atLabel: '',
    });
  });
});

describe('the plain checks', () => {
  it('says nobody uses a field', () => {
    expect(
      only({
        kind: 'who-uses',
        level: 'warn',
        schema: 'sch:order-placed-v2',
        field: 'total_cents',
        candidates: ['flow:place-order#email'],
      }),
    ).toMatchObject({
      text: '**No step or screen uses `total_cents`.** Say who reads it, or leave it out.',
      at: ['flow:place-order#email'],
      atLabel: 'Steps that receive it',
    });
  });

  it('says a picture is stale', () => {
    expect(only({ kind: 'stale-picture', level: 'ask', screen: 'scr:desk' })).toMatchObject({
      text: "**“desk” changes but its picture doesn't.** Reviewers see the old screen.",
      at: ['scr:desk'],
    });
  });

  it('asks a team to vote again', () => {
    const view = only({
      kind: 'stale-vote',
      level: 'note',
      team: 'team:orders',
      confidence: 4,
      said: 'Looks **fine**',
    });
    expect(view.text).toBe(
      'Orders rated its confidence 4 (“Looks fine”) before this change. Ask again.',
    );
    expect(view.at).toEqual([]);
  });

  it('points at the question and decision below', () => {
    const views = checkViews(
      pairWith([
        { kind: 'question', level: 'note', question: 'q:one' },
        { kind: 'decision', level: 'note', decision: 'dec:one' },
      ]),
      live,
    );
    expect(views.map((v) => [v.text, v.at])).toEqual([
      ['Opens the question below.', ['q:one']],
      ['Changes the decision below.', ['dec:one']],
    ]);
  });
});
