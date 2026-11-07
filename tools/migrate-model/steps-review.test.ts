import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { modelList, modelRecord } from '@/domain/workspace-model';

import { fingerprint, migrationReview, type ReviewRow } from './review';
import { migrateSteps, type StepContext } from './steps';

function alphabetical(a: unknown, b: unknown): number {
  return String(a).localeCompare(String(b));
}
function context(review = migrationReview()): StepContext {
  return { path: 'h:example', assigned: null, review, cites: [], cite: () => [] };
}
const source = [
  {
    do: [
      { call: 'api:next', does: 'Load current price' },
      { call: 'api:next', does: 'Load prior price' },
    ],
  },
  {
    do: [
      { call: 'api:next', does: 'Load current terms' },
      { call: 'api:next', does: 'Load prior terms' },
    ],
  },
];
const choices = new Map([
  [fingerprint(source[0]), 'load-prices'],
  [fingerprint(source[1]), 'load-terms'],
  ...source.flatMap((parent) =>
    parent.do.map(
      (step) => [fingerprint(step), step.does.toLowerCase().replaceAll(' ', '-')] as const,
    ),
  ),
]);
function acceptedRows(): readonly ReviewRow[] {
  const review = migrationReview();
  migrateSteps(source, context(review));
  const rows = review.rows()['step-ids'] ?? [];
  expect(rows).toHaveLength(6);
  return rows.map((row) => ({ ...row, status: 'accepted', id: choices.get(row.fingerprint) }));
}
describe('source-addressed nested step reviews', () => {
  it('applies all six choices in one pass without parent ids changing child review keys', () => {
    const rows = acceptedRows();
    const review = migrationReview([rows]);
    const result = migrateSteps(source, context(review));
    expect(review.pending('step-ids')).toBe(0);
    expect(
      review
        .rows()
        ['step-ids']?.map((row) => row.key)
        .toSorted(alphabetical),
    ).toEqual(rows.map((row) => row.key).toSorted(alphabetical));
    expect(result).toMatchObject([
      { id: 'load-prices', steps: [{ id: 'load-current-price' }, { id: 'load-prior-price' }] },
      { id: 'load-terms', steps: [{ id: 'load-current-terms' }, { id: 'load-prior-terms' }] },
    ]);
    const child = review
      .rows()
      ['step-ids']?.find((row) => row.fingerprint === fingerprint(source[0]?.do[0]));
    expect(child).toMatchObject({
      path: 'h:example#load-prices',
      sourcePath: 'h:example/steps/0/do/0',
    });
  });
  it('keeps stale fingerprint rejection separate from source addressing', () => {
    const rows = acceptedRows();
    const stale = rows.map((row) =>
      row.fingerprint === fingerprint(source[0]?.do[0]) ? { ...row, fingerprint: 'stale' } : row,
    );
    expect(() => migrateSteps(source, context(migrationReview([stale])))).toThrow(
      'Stale acceptance:',
    );
  });
  it('gives identical reviewed occurrences separate source selectors without assigning ids by rank', () => {
    const review = migrationReview();
    const result = migrateSteps(
      [{ do: [{ call: 'api:next' }, { call: 'api:next' }] }],
      context(review),
    );
    const rows = review.rows()['step-ids'] ?? [];
    expect(result[0]?.id).toBe('');
    expect(modelList(modelRecord(result[0])?.steps).map((step) => modelRecord(step)?.id)).toEqual([
      '',
      '',
    ]);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((row) => row.key)).size).toBe(3);
    expect(rows.filter((row) => row.proposed === 'call-next').map((row) => row.sourcePath)).toEqual(
      ['h:example/steps/0/do/0', 'h:example/steps/0/do/1'],
    );
  });
  it('records authored branch, lane and retry selectors without generated parent ids', () => {
    const review = migrationReview();
    migrateSteps(
      [
        parse(`id: root
then: [{ call: 'api:next', does: Then }]
else: [{ call: 'api:next', does: Else }]
parallel:
  - [{ call: 'api:next', does: List lane }]
  - lane: named
    steps: [{ call: 'api:next', does: Named lane }]
  - { call: 'api:next', does: Single lane }
retry:
  until: ready
  exhausted: [{ call: 'api:next', does: Exhausted }]
`),
      ],
      context(review),
    );
    expect(
      review
        .rows()
        ['step-ids']?.map((row) => row.sourcePath)
        .toSorted(alphabetical),
    ).toEqual(
      [
        'h:example/steps/0/then/0',
        'h:example/steps/0/else/0',
        'h:example/steps/0/parallel/0/0',
        'h:example/steps/0/parallel/1/steps/0',
        'h:example/steps/0/parallel/2',
        'h:example/steps/0/retry/exhausted/0',
      ].toSorted(alphabetical),
    );
  });
  it('keeps raw source positions when empty wrappers are omitted', () => {
    const review = migrationReview();
    migrateSteps([{ do: [] }, source[0]], context(review));
    expect(
      review
        .rows()
        ['step-ids']?.map((row) => row.sourcePath)
        .toSorted(alphabetical),
    ).toEqual(
      ['h:example/steps/1', 'h:example/steps/1/do/0', 'h:example/steps/1/do/1'].toSorted(
        alphabetical,
      ),
    );
  });

  it('retains exact authored occurrence receipts for identical descendant captions', () => {
    const review = migrationReview();
    const does =
      'Reads the recorded financing product and preserves the source terms without changing their units.';
    migrateSteps(
      [
        {
          id: 'parent',
          do: [
            { id: 'first', does },
            { id: 'second', does },
          ],
        },
      ],
      context(review),
    );
    expect(review.rows().headlines).toEqual([
      expect.objectContaining({
        path: 'h:example#parent/first',
        sourcePath: 'h:example/steps/0/do/0',
        does,
      }),
      expect.objectContaining({
        path: 'h:example#parent/second',
        sourcePath: 'h:example/steps/0/do/1',
        does,
      }),
    ]);
  });
});
