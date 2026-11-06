import { describe, expect, it, vi } from 'vitest';

import { modelList, modelRecord } from '@/domain/workspace-model';
import { modelProblems } from '@/infrastructure/model-schema';

import { migrationCitations } from './citations';
import { migrateNarratives } from './narratives';
import { migrationReview } from './review';

vi.mock(import('server-only'), () => ({}));
const input = {
  format: 1,
  label: 'Inferred',
  authored: '2026-10-30',
  generator: 'Synthetic review fixture',
  basis: 'a'.repeat(64),
  stories: [
    {
      id: 'overview',
      name: 'Overview',
      summary: 'The recorded path',
      confidence: 'medium',
      reasoning: 'Read from the referenced facts',
      limitations: ['Runtime delivery is not established'],
      relatedSystems: ['sys:remote'],
      connections: [
        {
          from: 'app:shop',
          to: 'ext:supplier',
          label: 'Requests a quote',
          kind: 'api',
          evidence: ['h:request'],
        },
      ],
      stages: [
        {
          component: 'app:shop',
          title: 'Request',
          summary: 'Requests the quote',
          supporting: ['ext:supplier', 'lib:client'],
          evidence: ['h:request'],
        },
        {
          component: 'sys:remote',
          title: 'Keep',
          summary: 'Keeps the record',
          supporting: [],
          evidence: ['sch:record#status'],
        },
      ],
    },
  ],
};
const file = { path: 'domains/sales/systems/shop/narratives.yaml', text: '', value: input };
describe('narrative migration', () => {
  it('retains inferred meaning and model backing while deriving only existing code citations', async () => {
    const review = migrationReview();
    const before = JSON.stringify(input);
    const cites = ['orders:src/Order.ts#L1-20'];
    const result = migrateNarratives(
      file,
      migrationCitations([], review, 'sys:shop'),
      new Map([
        ['h:request', cites],
        ['sch:record', cites],
      ]),
      review,
    );
    await expect(modelProblems('workspace', 'NarrativesFile', result)).resolves.toEqual([]);
    const story = modelRecord(modelList(result.stories)[0]);
    expect(result.format).toBe(2);
    expect(result.basis).toBe(input.basis);
    expect(story).toMatchObject({
      confidence: 'medium',
      limitations: input.stories[0]?.limitations,
      connections: [{ backs: ['h:request'], cites }],
      stages: [
        {
          component: 'app:shop',
          supporting: ['ext:supplier', 'lib:client'],
          backs: ['h:request'],
          cites,
        },
        { component: 'sys:remote', backs: ['sch:record#status'], cites },
      ],
    });
    expect(JSON.stringify(input)).toBe(before);
    expect(review.pending('documents')).toBe(0);
  });
  it('retains missing backing for explicit reconciliation instead of fabricating citations', () => {
    const review = migrationReview();
    const result = migrateNarratives(
      file,
      migrationCitations([], review, 'sys:shop'),
      new Map(),
      review,
    );
    const story = modelRecord(modelList(result.stories)[0]);
    expect(modelRecord(modelList(story?.stages)[0])?.cites).toBeUndefined();
    expect(review.pending('documents')).toBe(1);
    expect(review.rows().documents?.[0]?.original).toEqual(input);
  });
});
