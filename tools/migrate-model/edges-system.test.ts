import { expect, it } from 'vitest';

import { migrationCitations } from './citations';
import { reconcileEdges } from './edges';
import { migrationReview } from './review';

it.each(['service', 'system'])('keeps a %s provider at its declared system boundary', (facet) => {
  const review = migrationReview();
  const citations = migrationCitations([], review, 'sys:about-us');
  const cites = ['repo:src/about-us.ts@abc#L1-20'];
  const handlers = [
    {
      id: 'h:about-us',
      component: 'app:about-us',
      on: 'api:about-us',
      steps: [
        { id: 'names', call: 'api:rde-names', cites },
        { id: 'download', call: 'api:rde-download', cites },
        { id: 'store', write: 'sch:deck', to: 'st:deck', cites },
      ],
    },
  ];
  const scopes = [
    {
      folder: 'about-us',
      citations,
      source: {
        id: 'sys:about-us',
        components: [
          {
            id: 'app:about-us',
            talks_to: [
              { to: 'sys:rde', via: 'api' },
              { to: 'sys:unknown', via: 'api' },
              { to: 'st:deck', via: 'store' },
            ],
          },
          { id: 'sys:rde', type: 'external' },
          { id: 'sys:unknown', type: 'external' },
          { id: 'st:deck' },
        ],
      },
      contracts: {
        interfaces: [
          {
            id: 'if:rde',
            [facet]: 'sys:rde',
            entries: [{ id: 'api:rde-names' }, { id: 'api:rde-download' }],
            cites,
          },
        ],
      },
    },
  ];
  const systems = new Map([
    [
      'about-us',
      { system: { id: 'sys:about-us' }, contracts: scopes[0]?.contracts ?? {}, handlers },
    ],
  ]);
  const before = JSON.stringify({ scopes, handlers });
  const result = reconcileEdges(scopes, systems, review).get('about-us');
  expect(result?.connections).toEqual([
    { to: 'sys:rde', says: 'api', backs: ['h:about-us#download', 'h:about-us#names'] },
  ]);
  expect(review.rows()['review-edges']).toHaveLength(2);
  expect(review.rows()['review-edges']).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        edge: { to: 'sys:unknown', via: 'api' },
        evidence: [],
        reason: 'No cited handler or contract backing.',
      }),
      expect.objectContaining({
        edge: { to: 'st:deck', via: 'store' },
        evidence: [expect.objectContaining({ site: 'h:about-us#store', cites })],
        reason: 'Internal component relationship remains in its exact detail.',
      }),
    ]),
  );
  expect(JSON.stringify({ scopes, handlers })).toEqual(before);
});

it('keeps a shared external provider separate from both consuming systems', () => {
  const review = migrationReview();
  const citations = migrationCitations([], review, 'sys:car-selector');
  const cites = ['repo:src/rockar.ts@abc#L5-25'];
  const handler = {
    id: 'h:rockar-login',
    component: 'app:car-selector',
    steps: [{ id: 'login', call: 'api:rockar-login', cites }],
  };
  const scopes = ['car-selector', 'marketing'].map((folder) => ({
    folder,
    citations,
    source: {
      id: `sys:${folder}`,
      components: [
        { id: `app:${folder}`, talks_to: [{ to: 'ext:rockar', via: 'api' }] },
        { id: 'ext:rockar', type: 'external' },
      ],
    },
    contracts: {
      interfaces: [
        { id: 'if:rockar', external: 'ext:rockar', entries: [{ id: 'api:rockar-login' }] },
      ],
    },
  }));
  const systems = new Map(
    scopes.map((scope) => [
      scope.folder,
      {
        system: { id: scope.source.id },
        contracts: scope.contracts,
        handlers: scope.folder === 'car-selector' ? [handler] : [],
      },
    ]),
  );
  const result = reconcileEdges(scopes, systems, review);
  expect(result.get('car-selector')?.connections).toBeUndefined();
  expect(result.get('marketing')?.connections).toBeUndefined();
  expect(review.rows()['review-edges']).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        from: 'app:car-selector',
        edge: { to: 'ext:rockar', via: 'api' },
        evidence: [expect.objectContaining({ site: 'h:rockar-login#login', cites })],
        reason: 'No mapped destination system or summary label.',
      }),
    ]),
  );
  expect(systems.get('car-selector')?.handlers).toEqual([handler]);
});
