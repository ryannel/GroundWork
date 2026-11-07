import { describe, expect, it } from 'vitest';

import {
  type CitationScope,
  codeCitationResolver,
  resolveModelCitations,
} from '@/domain/model-cite-resolution';
import { modelRecord, type ModelRepository } from '@/domain/workspace-model';

const pin = 'a'.repeat(40);
const repository: ModelRepository = {
  repository: {
    format: 'groundwork-evidence/v2',
    repo: 'example/orders',
    commit: pin,
    scannedAt: '2026-11-06T00:00:00Z',
    language: 'typescript',
    trackedFiles: 1,
    selectedFiles: 1,
    passes: ['source'],
  },
  records: [
    {
      family: 'files',
      data: { kind: 'file', id: 'ev:file', path: 'apps/orders/Confirm.ts', blob: 'b'.repeat(40) },
    },
    {
      family: 'sources',
      data: {
        kind: 'source',
        id: 'ev:source',
        file: 'ev:file',
        lines: [1, 100],
        host: 'ev:host',
        authority: 'declared',
      },
    },
    {
      family: 'claims',
      data: {
        kind: 'purpose',
        id: 'ev:claim',
        label: 'Inferred',
        statement: 'Synthetic fixture',
        reasoning: 'Synthetic fixture',
        confidence: 'low',
        limitations: [],
        cites: ['ev:source'],
      },
    },
  ],
  discovery: null,
};
const scope: CitationScope = {
  entity: 'sys:orders',
  file: 'handlers/orders.yaml',
  homes: { orders: [{ repo: 'example/orders', path: 'apps/orders' }] },
  evidence: [repository],
};

function handler(cites: readonly string[] = ['orders:Confirm.ts#L1-100 Confirm']) {
  return {
    id: 'h:confirm',
    component: 'svc:orders',
    on: 'api:confirm',
    cites,
    steps: [
      {
        id: 'tx',
        transaction: true,
        steps: [{ id: 'save', write: 'sch:order', to: 'st:orders', cites: ['#L12-15'] }],
      },
    ],
    failures: [{ id: 'db-down', when: 'Unavailable', return: 503, cites: ['#L90-92'] }],
  };
}

describe('schema-directed citation resolution', () => {
  it('inherits a directly cited evidence file without fabricating a symbol', () => {
    const result = resolveModelCitations('Handler', handler(['ev:file']), scope);
    expect(result.problems).toEqual([]);
    expect(result.data).toMatchObject({
      steps: [
        {
          steps: [
            {
              cites: [
                {
                  kind: 'code',
                  repo: 'example/orders',
                  commit: pin,
                  path: 'apps/orders/Confirm.ts',
                  lines: [12, 15],
                },
              ],
            },
          ],
        },
      ],
    });
  });
  it('uses a normalised evidence reference on an existing handler when a plan adds a step', () => {
    const result = resolveModelCitations(
      'Step',
      { id: 'new', does: 'Synthetic step', cites: ['#L5-8'] },
      {
        ...scope,
        entity: 'h:confirm',
        handler: { cites: [{ kind: 'evidence', id: 'ev:source' }] },
      },
    );
    expect(result.problems).toEqual([]);
    expect(result.data).toMatchObject({
      cites: [
        {
          kind: 'code',
          repo: 'example/orders',
          commit: pin,
          path: 'apps/orders/Confirm.ts',
          lines: [5, 8],
        },
      ],
    });
  });
  it('keeps dangling and cyclic evidence chains as gaps rather than choosing a file', () => {
    const cyclic = structuredClone(repository);
    const claim = modelRecord(cyclic.records.find((record) => record.family === 'claims')?.data);
    if (claim === null) throw new Error('Missing claim');
    Object.assign(claim, { cites: ['ev:claim', 'ev:absent'] });
    const result = resolveModelCitations('Handler', handler(['ev:claim']), {
      ...scope,
      evidence: [cyclic],
    });
    expect(result.problems.map((problem) => problem.reference)).toEqual(['#L12-15', '#L90-92']);
    expect(result.data).toMatchObject({
      steps: [{ steps: [{ cites: [] }] }],
      failures: [{ cites: [] }],
    });
  });
  it('refuses to inherit through a source pointing to another repository’s file or a non-file record', () => {
    const changed: ModelRepository = {
      ...repository,
      records: repository.records.map((record) =>
        record.family === 'sources'
          ? { family: 'sources', data: { ...record.data, file: 'ev:other-file' } }
          : record,
      ),
    };
    const other: ModelRepository = {
      ...repository,
      repository: { ...repository.repository, repo: 'example/other', commit: 'c'.repeat(40) },
      records: [
        {
          family: 'files',
          data: { kind: 'file', id: 'ev:other-file', path: 'Other.ts', blob: 'd'.repeat(40) },
        },
      ],
    };
    const result = resolveModelCitations('Handler', handler(['ev:source']), {
      ...scope,
      evidence: [changed, other],
    });
    expect(result.problems.map((problem) => problem.reference)).toEqual(['#L12-15', '#L90-92']);
    const wrongKind = structuredClone(repository);
    const file = wrongKind.records.find((record) => record.data.id === 'ev:file');
    if (file === undefined) throw new Error('Missing file');
    Object.assign(file.data, { kind: 'route' });
    expect(
      resolveModelCitations('Handler', handler(['ev:source']), { ...scope, evidence: [wrongKind] })
        .problems,
    ).toHaveLength(2);
  });
  it('reports invalid author values and invalid normalised parent references without inventing locations', () => {
    const invalid = resolveModelCitations('Handler', { ...handler(), cites: [42] }, scope);
    expect(invalid.problems.map((problem) => problem.reference)).toEqual(
      expect.arrayContaining(['42', '#L12-15', '#L90-92']),
    );
    expect(invalid.problems).toHaveLength(3);
    const parent = resolveModelCitations(
      'Step',
      { id: 'new', does: 'Synthetic step', cites: ['#L5-8'] },
      {
        ...scope,
        entity: 'h:confirm',
        handler: {
          cites: [{ kind: 'code', repo: 'example/orders', commit: 42, path: 'Unknown.ts' }],
        },
      },
    );
    expect(parent.problems).toContainEqual(expect.objectContaining({ reference: '#L5-8' }));
    expect(parent.data).toMatchObject({ cites: [] });
  });

  it('pins a home reference and inherits one file through nested steps and failures', () => {
    const result = resolveModelCitations('Handler', handler(), scope);
    expect(result.problems).toEqual([]);
    expect(result.data).toMatchObject({
      cites: [
        {
          kind: 'code',
          repo: 'example/orders',
          commit: pin,
          path: 'apps/orders/Confirm.ts',
          lines: [1, 100],
          symbol: 'Confirm',
        },
      ],
      steps: [
        {
          steps: [
            {
              cites: [
                {
                  kind: 'code',
                  repo: 'example/orders',
                  commit: pin,
                  path: 'apps/orders/Confirm.ts',
                  lines: [12, 15],
                },
              ],
            },
          ],
        },
      ],
      failures: [
        {
          cites: [
            {
              kind: 'code',
              repo: 'example/orders',
              commit: pin,
              path: 'apps/orders/Confirm.ts',
              lines: [90, 92],
            },
          ],
        },
      ],
    });
  });
  it('can inherit the single file behind an evidence-backed interpretation', () => {
    const result = resolveModelCitations('Handler', handler(['ev:claim']), scope);
    expect(result.problems).toEqual([]);
    expect(result.data).toMatchObject({
      cites: [{ kind: 'evidence', id: 'ev:claim' }],
      steps: [{ steps: [{ cites: [{ path: 'apps/orders/Confirm.ts', lines: [12, 15] }] }] }],
    });
  });
  it('keeps unresolved references visible and assigns gaps to frozen nested identities', () => {
    const result = resolveModelCitations('Handler', handler(['unknown:Confirm.ts']), scope);
    expect(result.data).toMatchObject({
      cites: [],
      steps: [{ steps: [{ cites: [] }] }],
      failures: [{ cites: [] }],
    });
    expect(result.problems).toHaveLength(3);
    expect(result.problems.map((problem) => [problem.id, problem.reference])).toEqual(
      expect.arrayContaining([
        ['h:confirm', 'unknown:Confirm.ts'],
        ['h:confirm#tx/save', '#L12-15'],
        ['h:confirm#!db-down', '#L90-92'],
      ]),
    );
  });
  it('does not choose a file when handler citations are ambiguous', () => {
    const result = resolveModelCitations(
      'Handler',
      handler(['orders:Confirm.ts#L1-100', 'orders:Other.ts#L1-100']),
      scope,
    );
    expect(result.problems).toHaveLength(2);
    expect(result.problems.map((problem) => problem.reference)).toEqual(['#L12-15', '#L90-92']);
  });
  it('does not turn business data named cites into source references', () => {
    const value = {
      id: 'sch:order',
      kind: 'dto',
      fields: [
        {
          id: 'amount',
          name: 'amount',
          default: { cites: ['business value'] },
          cites: ['ev:source'],
          args: [{ id: 'currency', name: 'currency', cites: ['ev:source'] }],
        },
      ],
    };
    const result = resolveModelCitations('Schema', value, scope);
    expect(result.problems).toEqual([]);
    expect(result.data).toMatchObject({
      fields: [
        {
          default: { cites: ['business value'] },
          cites: [{ kind: 'evidence', id: 'ev:source' }],
          args: [{ cites: [{ kind: 'evidence', id: 'ev:source' }] }],
        },
      ],
    });
    expect(
      resolveModelCitations(
        'TargetFile',
        { shifts: [{ id: 'move', cites: ['sys:orders'] }] },
        scope,
      ).data,
    ).toEqual({ shifts: [{ id: 'move', cites: ['sys:orders'] }] });
  });
  it('retains missing evidence ids as references with explicit gaps', () => {
    const result = resolveModelCitations(
      'StoreComponent',
      {
        id: 'st:orders',
        kind: 'store',
        name: 'Orders',
        owner: { id: 'svc:orders', cites: ['ev:missing'] },
      },
      scope,
    );
    expect(result.data).toMatchObject({
      owner: { cites: [{ kind: 'evidence', id: 'ev:missing' }] },
    });
    expect(result.problems).toEqual([
      expect.objectContaining({
        id: 'st:orders',
        reference: 'ev:missing',
        message: 'The cited evidence record is not present.',
      }),
    ]);
  });
  it('allows an explicit historical pin and never invents one for an unscanned repository', () => {
    const unscanned = { ...scope, evidence: [] };
    const missing = resolveModelCitations('Handler', handler(), unscanned);
    expect(missing.problems).toHaveLength(3);
    const historical = resolveModelCitations(
      'Handler',
      handler([`orders:Confirm.ts@${pin}#L1-100`]),
      unscanned,
    );
    expect(historical.problems).toEqual([]);
    expect(historical.data).toMatchObject({ cites: [{ commit: pin }] });
  });
  it('treats duplicate identical homes as one choice and distinct homes as a gap', () => {
    const value = handler();
    const identical = {
      ...scope,
      homes: { orders: [...(scope.homes.orders ?? []), ...(scope.homes.orders ?? [])] },
    };
    expect(resolveModelCitations('Handler', value, identical).problems).toEqual([]);
    const ambiguous = {
      ...scope,
      homes: { orders: [...(scope.homes.orders ?? []), { repo: 'other/orders' }] },
    };
    expect(resolveModelCitations('Handler', value, ambiguous).problems).toHaveLength(3);
  });
});

it('inherits the actual historical span from a migrated GraphQL document', () => {
  const oldPin = 'c'.repeat(40);
  const historical: ModelRepository = {
    ...repository,
    records: [
      ...repository.records,
      {
        family: 'bindings',
        data: {
          kind: 'graphql_document_binding',
          id: 'ev:historical-document',
          document_name: 'Order',
          operation_type: 'query',
          operation_name: 'Order',
          variables: [],
          selections: [],
          document: 'query Order { order { id } }',
          source: {
            kind: 'code',
            repo: 'example/orders',
            commit: oldPin,
            path: 'queries/Order.ts',
            lines: [3, 8],
            symbol: 'Order',
          },
        },
      },
    ],
  };
  const result = resolveModelCitations('Handler', handler(['ev:historical-document']), {
    ...scope,
    evidence: [historical],
  });
  expect(result.problems).toEqual([]);
  expect(result.data).toMatchObject({
    steps: [
      {
        steps: [
          {
            cites: [
              { repo: 'example/orders', commit: oldPin, path: 'queries/Order.ts', lines: [12, 15] },
            ],
          },
        ],
      },
    ],
  });
});

it('resolves persisted evidence source chains to exact pinned locations for native inspection', () => {
  const resolve = codeCitationResolver([repository]);
  expect(
    resolve([
      { kind: 'evidence', id: 'ev:claim' },
      { kind: 'evidence', id: 'ev:source' },
      { kind: 'evidence', id: 'ev:missing' },
    ]),
  ).toEqual([
    {
      kind: 'code',
      repo: 'example/orders',
      commit: pin,
      path: 'apps/orders/Confirm.ts',
      lines: [1, 100],
    },
  ]);
});
