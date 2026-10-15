import { rootFields } from '@/application/plan/impact-fields';
import { type DiffRun, wordDiff } from '@/application/plan-story-versions-diff';
import { nameIn, type Pair, valueText } from '@/application/plan-story-versions-pair';
import type { Tense } from '@/application/plan-story-versions-words';

// How a step, screen or region shows what a revision does to it: a mark, a before and after, and the data it carries.

export type MarkClass = 'mod' | 'add' | 'dep' | 'data';

export interface Mark {
  readonly text: string;
  readonly cls: MarkClass;
}

type Wording = readonly [now: string, past: string, would: string, cls: MarkClass];

const MARKS: Readonly<Record<string, Wording>> = {
  behaviour: ['works differently', 'changed', 'would have changed', 'mod'],
  added: ['new step', 'new step', 'new step', 'add'],
  removed: ['removed', 'removed', 'would have been removed', 'dep'],
  data: [
    'passes the new data on',
    'passed the new data on',
    'would have passed the new data on',
    'data',
  ],
  layout: ['moves', 'moved', 'would have moved', 'data'],
};

/** The tag for a step's or region's mark, in the revision's tense. */
export function markOf(mark: string, tense: Tense): Mark {
  const [now, past, would, cls] = MARKS[mark] ?? [mark, mark, mark, 'mod'];
  return { text: tense.t(now, past, would), cls };
}

export interface Side {
  readonly label: string;
  readonly runs: readonly DiffRun[];
}

export interface BeforeAfter {
  readonly was: Side;
  readonly now: Side;
}

const plain = (text: string): DiffRun[] => (text === '' ? [] : [{ mark: 'same', text }]);

/** A value in both revisions: with words changed marked when both have one. */
export function beforeAfter(pair: Pair, was: unknown, now: unknown): BeforeAfter {
  const [a, b] = [valueText(pair, was), valueText(pair, now)];
  const diff = a !== '' && b !== '' ? wordDiff(a, b) : null;
  return {
    was: { label: pair.fromVersion, runs: diff?.was ?? plain(a) },
    now: { label: pair.toVersion, runs: diff?.now ?? plain(b) },
  };
}

const VERB = { added: 'gains', removed: 'loses', edited: 'changes' } as const;

/** "the **Invoice**, whose `bill_to` gains `vat_country`": what a step or region carries whose shape changes. */
export function carryText(pair: Pair, schema: string): string {
  const chain: string[] = [];
  const seen = new Set<string>();
  let id = schema;
  for (let via = pair.im.shape.get(id)?.via; via !== undefined && !seen.has(id);) {
    seen.add(id);
    chain.push(via.field);
    id = via.of;
    via = pair.im.shape.get(id)?.via;
  }
  const fields = rootFields(pair.im.shape, schema)
    .map((f) => `${VERB[f.kind]} \`${f.name}\``)
    .join(', ');
  const whose = chain.length > 0 ? `whose \`${chain.join('.')}\`` : 'which';
  return `the **${nameIn(pair, schema)}**, ${whose} ${fields}`;
}
