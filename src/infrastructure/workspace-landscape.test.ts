import { rm } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { tempDir, writeWorkspace } from '@/../test/workspace-kit';

import { readAuthoredLandscape } from './workspace-landscape';

vi.mock(import('server-only'), () => ({}));

const root = await tempDir('workspace-landscape-');
afterAll(async () => rm(root, { recursive: true, force: true }));

const base = {
  format: 1,
  label: 'Inferred',
  reviewed: '2026-10-26',
  scope: 'The inspected repositories.',
  limitation: 'Partial coverage.',
  areas: [
    {
      id: 'sell',
      name: 'Sell products',
      purpose: 'Make products available.',
      activities: ['Publish an offer'],
      boundary: 'Does not prove fulfilment.',
      confidence: 'medium',
      evidence_count: 4,
    },
  ],
  relationships: [],
  details: [],
} as const;

await writeWorkspace(path.join(root, 'acme'), {
  'workspace.yaml': { format: 1, id: 'acme', name: 'Acme' },
  'landscape.yaml': base,
});
await writeWorkspace(path.join(root, 'broken'), {
  'workspace.yaml': { format: 1, id: 'broken', name: 'Broken' },
  'landscape.yaml': {
    ...base,
    relationships: [
      { id: 'lost', from: 'sell', to: 'missing', label: 'Unknown', kind: 'exchange' },
    ],
  },
});

describe('readAuthoredLandscape', () => {
  it('reads the optional authored entrances without making them workspace levels', async () => {
    const landscape = await readAuthoredLandscape('acme', root);
    expect(landscape?.areas[0]).toMatchObject({ id: 'sell', evidenceCount: 4 });
    await expect(readAuthoredLandscape('absent', root)).resolves.toBeNull();
  });

  it('rejects relationships to areas the view does not define', async () => {
    await expect(readAuthoredLandscape('broken', root)).rejects.toThrow('unknown area');
  });
});

it('reads saved connection explanations and requires their evidence', async () => {
  const flow = {
    columns: [
      { system: 'products', column: 0 },
      { system: 'shop', column: 1 },
    ],
    overview: [
      {
        from: 'svc:shop',
        to: 'svc:products',
        kind: 'api',
        label: 'Read products',
        evidence: ['api:products'],
      },
    ],
    title: 'Inputs to use',
    summary: 'Explain the work.',
    confidence: 'medium',
    reasoning: 'Recorded calls.',
    limitations: [],
    bands: [
      {
        id: 'read',
        title: 'Read products',
        summary: 'Use products.',
        nodes: [{ component: 'svc:shop', column: 0 }],
      },
    ],
    connections: [],
    summaries: [
      {
        from: 'svc:shop',
        to: 'svc:products',
        kind: 'api',
        label: 'Find available products',
        evidence: ['api:products'],
      },
    ],
  };
  const withFlow = (value: typeof flow) => ({
    ...base,
    details: [
      {
        area: 'sell',
        systems: ['shop', 'products'],
        relationships: [],
        collaborations: [],
        valueFlow: value,
      },
    ],
  });
  await writeWorkspace(path.join(root, 'explained'), {
    'workspace.yaml': { format: 1, id: 'explained', name: 'Explained' },
    'landscape.yaml': withFlow(flow),
  });
  const explained = await readAuthoredLandscape('explained', root);
  expect(explained?.details[0]?.valueFlow?.summaries?.[0]?.label).toBe('Find available products');
  expect(explained?.details[0]?.valueFlow?.overview?.[0]?.label).toBe('Read products');
  expect(explained?.details[0]?.valueFlow?.columns).toEqual(flow.columns);
  await writeWorkspace(path.join(root, 'independent'), {
    'workspace.yaml': { format: 1, id: 'independent', name: 'Independent' },
    'landscape.yaml': withFlow({ ...flow, overview: [] }),
  });
  const independent = await readAuthoredLandscape('independent', root);
  expect(independent?.details[0]?.valueFlow?.overview).toEqual([]);
  await writeWorkspace(path.join(root, 'unproven'), {
    'workspace.yaml': { format: 1, id: 'unproven', name: 'Unproven' },
    'landscape.yaml': withFlow({
      ...flow,
      summaries: flow.summaries.map((summary) => ({ ...summary, evidence: [] })),
    }),
  });
  await expect(readAuthoredLandscape('unproven', root)).rejects.toThrow('evidence');
});
