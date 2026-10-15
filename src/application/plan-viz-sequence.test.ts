import { describe, expect, it } from 'vitest';

import { sequencePlan } from '@/../test/sequence-kit';
import { derive } from '@/application/plan/derive';
import { holdsCurrent, sequenceView } from '@/application/plan-viz-sequence';
import type { SeqCell, SeqStep } from '@/application/plan-viz-sequence-cells';
import { type Item, entriesOf, treeOf } from '@/application/plan-viz-sequence-rows';
import {
  MAX_COLS,
  between,
  columnPlace,
  columnTier,
  fromCentre,
  isDense,
  levelName,
  longestWord,
  pillOf,
  plainText,
  toCentre,
} from '@/application/plan-viz-sequence-text';

const model = derive(sequencePlan());

describe('column geometry', () => {
  it('puts a column between two grid lines and its lifeline on the one between', () => {
    expect(columnPlace(0)).toEqual({ start: 1, span: 2 });
    expect(columnPlace(2)).toEqual({ start: 5, span: 2 });
  });

  it('runs an arrow from one lifeline to the other, whichever way it points', () => {
    expect(between(0, 2)).toEqual({ start: 2, span: 4 });
    expect(between(2, 0)).toEqual({ start: 2, span: 4 });
    expect(between(1, 1).span).toBe(1);
  });

  it('holds columns past the last it has rules for', () => {
    expect(columnPlace(MAX_COLS + 9).start).toBe(2 * MAX_COLS - 1);
  });

  it('runs a box from a lifeline outward, or from the edge to one', () => {
    expect(fromCentre(0)).toEqual({ start: 2, span: 6 });
    expect(fromCentre(MAX_COLS - 1).span).toBe(1);
    expect(toCentre(2)).toEqual({ start: 1, span: 5 });
  });

  it('sizes a column to its longest word, up to the last tier', () => {
    expect(longestWord('pricing-api service')).toBe(7);
    expect(columnTier([{ name: 'Web', mono: false }], 3)).toBe(84);
    expect(columnTier([{ name: 'Web', mono: false }], 9)).toBe(96);
    expect(columnTier([{ name: 'Authentication', mono: false }], 3)).toBe(120);
    expect(columnTier([{ name: 'Authentications', mono: false }], 3)).toBe(144);
    expect(columnTier([{ name: 'x'.repeat(80), mono: true }], 3)).toBe(208);
  });

  it('squeezes up to eight columns, then scrolls', () => {
    expect(isDense(8)).toBe(false);
    expect(isDense(9)).toBe(true);
  });
});

describe('words', () => {
  it('names the changed steps and leaves the rest', () => {
    expect(pillOf('added')).toEqual(['add', 'new step']);
    expect(pillOf('deprecated')?.[1]).toBe('Deprecated · still works');
    expect(pillOf('existing')).toBeNull();
  });

  it('names a test level', () => {
    expect(levelName('e2e')).toBe('end-to-end');
    expect(levelName()).toBe('test');
  });

  it('reads markdown and citations as plain words', () => {
    expect(plainText(model, 'The **shopper** opens [[svc:web]] and `waits`')).toBe(
      'The shopper opens Web and waits',
    );
    expect(plainText(model, null)).toBe('');
  });
});

describe('rows as a tree of frames', () => {
  it('encloses a step that can fail with the steps up to its reply and the else row', () => {
    const view = sequenceView(model, 'flow:rich', { mode: 'asIs' });
    const frame = view?.items.find((x) => x.kind === 'frame');
    expect(frame?.kind === 'frame' ? frame.frame : null).toBe('fails');
    const kinds = frame?.kind === 'frame' ? frame.items.map((x) => x.kind) : [];
    expect(kinds).toEqual(['step', 'step', 'frame', 'else']);
  });

  it('opens a group with its tab and holds the steps that happen together', () => {
    const view = sequenceView(model, 'flow:rich', { mode: 'asIs' });
    const outer = view?.items.find((x) => x.kind === 'frame');
    const group = outer?.kind === 'frame' ? outer.items.find((x) => x.kind === 'frame') : null;
    expect(group?.kind === 'frame' ? group.frame : null).toBe('group');
    expect(group?.kind === 'frame' ? group.items[0] : null).toMatchObject({
      kind: 'group',
      tab: 'On publish',
    });
  });

  it('survives rows that close what was never opened', () => {
    const tree = treeOf(
      entriesOf([{ kind: 'close', frame: 'group', beat: null, sharedSource: null }]),
      () => 1,
    );
    expect(tree).toEqual([]);
  });
});

describe('the sequence of a flow', () => {
  const view = sequenceView(model, 'flow:rich', { mode: 'asIs', spans: true, step: [1] });
  const flat = (items: readonly Item<SeqCell>[]): SeqCell[] =>
    items.flatMap((x) => (x.kind === 'frame' ? flat(x.items) : [x]));
  const steps = flat(view?.items ?? []).filter((c): c is SeqStep => c.kind === 'step');
  const step = (id: string): SeqStep | undefined => steps.find((s) => s.id === id);
  const kinds = flat(view?.items ?? []).map((c) => c.kind);

  it('has no drawing when the flow has no steps', () => {
    expect(sequenceView(model, 'flow:nothing')).toBeNull();
  });

  it('gives the person the first column and each system the next in the order they act', () => {
    expect(view?.person).toBe('Shopper');
    expect(view?.parts.map((p) => [p.id, p.col])).toEqual([
      ['svc:web', 1],
      ['svc:pricing-api', 2],
      ['st:price-topic', 3],
      ['svc:purger', 4],
    ]);
    expect(view?.cols).toBe(5);
    expect(view?.dense).toBe(false);
  });

  it('names each participant by its type and its team', () => {
    const topic = view?.parts.find((p) => p.id === 'st:price-topic');
    expect(topic).toMatchObject({ glyph: '⇶', word: 'TOPIC', store: true });
    expect(view?.parts[0]?.team?.id).toBe('team:web');
    expect(view?.parts[0]?.tip).toBe('ui: Web · Web');
  });

  it('puts the way in first, then the trigger, then the steps', () => {
    expect(view?.items[0]).toMatchObject({ kind: 'link', role: 'enter' });
    expect(view?.items[1]).toMatchObject({ kind: 'trigger', text: 'The shopper opens Web' });
    expect(kinds.slice(0, 2)).toEqual(['link', 'trigger']);
    expect(steps.map((s) => s.index)).toEqual([0, 1, 2, 3]);
  });

  it('draws a call as an arrow, with its reply and the screen the person then sees', () => {
    expect(step('flow:rich#ask')?.arrow).toMatchObject({
      kind: 'api',
      ref: 'api:pricing-price',
      rev: false,
    });
    expect(
      flat(view?.items ?? []).find((c) => c.kind === 'link' && c.role === 'reply'),
    ).toMatchObject({
      arrow: { kind: 'reply', label: 'Price', rev: true },
    });
    expect(step('flow:rich#keep')?.see).toEqual({ ref: 'scr:cart', label: 'Cart' });
  });

  it('marks the step it is on and the steps before it as walked', () => {
    expect(steps.map((s) => s.walk)).toEqual(['walked', 'current', '', '']);
  });

  it('draws a step inside one service as a box with the store it writes to', () => {
    expect(step('flow:rich#keep')?.self).toMatchObject({
      left: false,
      stores: [{ id: 'st:pricing-db', label: 'pricing-db', title: 'Writes to pricing-db' }],
    });
    expect(step('flow:rich#keep')?.arrow).toBeNull();
    expect(step('flow:rich#keep')?.logic).toBe('Only when it **changed**.');
  });

  it('lists the records a step reads and writes with the store they are in', () => {
    expect(step('flow:rich#ask')?.recs).toEqual([
      { id: 'sch:price', label: 'Price', verb: 'r', title: 'Reads Price in pricing-db' },
    ]);
    expect(step('flow:rich#keep')?.recs[0]?.verb).toBe('w');
  });

  it('numbers the tests that walk the flow and gives each a lane', () => {
    expect(view?.key.map((k) => [k.n, k.test, k.level])).toEqual([
      [1, 'tst:rich-all', 'e2e'],
      [2, 'tst:rich-walk', 'unit'],
    ]);
    expect(view?.lanes).toBe(2);
    const marks = steps.flatMap((s) => s.gut.map((g) => `${String(g.n)}:${g.pos}`));
    expect(marks).toContain('1:first');
    expect(marks).toContain('2:first');
    expect(marks).toContain('2:last');
    expect(marks).toContain('1:last');
  });

  it('draws no brackets unless asked', () => {
    const plain = sequenceView(model, 'flow:rich', { mode: 'asIs' });
    expect(plain?.lanes).toBe(0);
    expect(plain?.key).toEqual([]);
  });

  it('leaves out the person when a job or the system starts the flow', () => {
    const purge = sequenceView(model, 'flow:price-purge', { mode: 'asIs' });
    expect(purge?.person).toBeNull();
    expect(purge?.cols).toBe(4);
  });

  it('draws the tests of one step as a single mark', () => {
    const one = sequenceView(model, 'flow:browse', { mode: 'asIs', spans: true });
    const only = flat(one?.items ?? []).flatMap((c) => (c.kind === 'step' ? c.gut : []));
    expect(only.map((g) => g.pos)).toEqual(['only']);
  });

  it('marks steps the plan changes, in the plan to come', () => {
    const marked = sequenceView(model, 'flow:rich', {
      mode: 'toBe',
      markers: { 'flow:rich#ask': '◇' },
      markerTitle: 'Planned',
    });
    const ask = flat(marked?.items ?? []).find(
      (c) => c.kind === 'step' && c.id === 'flow:rich#ask',
    );
    expect(ask).toMatchObject({ marker: '◇' });
    expect(marked?.mode).toBe('toBe');
  });

  it('says whether a frame holds the current step', () => {
    const now = sequenceView(model, 'flow:rich', { mode: 'asIs', step: 1 });
    const later = sequenceView(model, 'flow:rich', { mode: 'asIs', step: 3 });
    expect(holdsCurrent(now?.items ?? [])).toBe(true);
    expect(holdsCurrent(later?.items ?? [])).toBe(true);
    expect(holdsCurrent(sequenceView(model, 'flow:rich')?.items ?? [])).toBe(false);
  });

  it('draws the plan to come, and the two together, without pills on an unchanged flow', () => {
    const toBe = sequenceView(model, 'flow:price-purge');
    const diff = sequenceView(model, 'flow:price-purge', { mode: 'diff' });
    const pills = (v: typeof toBe) =>
      flat(v?.items ?? []).flatMap((c) => (c.kind === 'step' ? [c.pill] : []));
    expect(toBe?.mode).toBe('toBe');
    expect(diff?.mode).toBe('diff');
    expect(pills(toBe)).toHaveLength(3);
    expect(pills(diff)).toHaveLength(3);
  });

  it('keeps a self step on the left of a lifeline in the right half', () => {
    const purge = sequenceView(model, 'flow:price-purge', { mode: 'asIs' });
    const selfs = flat(purge?.items ?? []).flatMap((c) => (c.kind === 'step' ? [c.self] : []));
    expect(selfs.filter((s) => s !== null).every((s) => s.left)).toBe(true);
  });
});
