import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { endpointConcerns } from '@/domain/scan/check-scan-answers';
import type { Answer, LocalSummary, ScanDocument } from '@/domain/scan/scan.generated';

import { scanValidator } from './scan-format';

vi.mock(import('server-only'), () => ({}));

function endpoint(): ScanDocument {
  const document = scanFixture();
  document.obligations = endpointConcerns.map((concern) => ({
    id: `obligation:${concern}`,
    kind: 'obligation',
    version: 'questions/v1',
    profile: 'endpoint',
    scope: 'summary:handler',
    concern,
    allowedInapplicabilityRules: [],
  }));
  const [first, ...rest] = document.obligations;
  if (first === undefined) throw new Error('Missing obligation');
  document.receipts = [
    {
      id: 'receipt:endpoint',
      kind: 'receipt',
      profile: 'endpoint',
      scope: 'summary:handler',
      authority: 'declared',
      obligations: [first.id, ...rest.map((item) => item.id)],
      answers: [
        { obligation: first.id, answer: { state: 'not_examined', obligation: first.id } },
        ...rest.map((item) => ({
          obligation: item.id,
          answer: { state: 'not_examined', obligation: item.id } satisfies Answer,
        })),
      ],
    },
  ];
  return document;
}

function summary(): LocalSummary {
  return {
    id: 'summary:handler',
    kind: 'summary',
    host: 'host:server',
    source: 'source:handler',
    implementation: 'implementation:handler',
    support: ['source:handler'],
    context: { arguments: [], captures: [], typeArguments: [], configuration: [], policy: [] },
    operations: [],
    frontiers: [],
    effects: { state: 'unresolved', reason: 'unsupported', gap: 'gap:unknown' },
  };
}

describe('scan/v1 contract validation', () => {
  it('accepts partial knowledge while retaining every required question', async () => {
    const parse = await scanValidator();
    const document = endpoint();
    expect(parse(document)).toEqual(document);
  });

  it('rejects missing obligations and missing applicable answers', async () => {
    const parse = await scanValidator();
    const document = endpoint();
    document.obligations.pop();
    expect(() => parse(document)).toThrow('missing obligation freshness');
    document.obligations = endpoint().obligations;
    document.receipts[0]?.answers.pop();
    expect(() => parse(document)).toThrow('missing or duplicate answer');
  });

  it('rejects unknown keys and unsupported inapplicability', async () => {
    const parse = await scanValidator();
    expect(() => parse({ ...scanFixture(), surprise: true })).toThrow('additional properties');
    const document = endpoint();
    const answer = document.receipts[0]?.answers[0];
    if (answer === undefined) throw new Error('Missing fixture answer');
    answer.answer = { state: 'not_applicable', rule: 'rule:made-up', support: ['source:handler'] };
    expect(() => parse(document)).toThrow('unsupported inapplicability');
  });

  it('requires evidence and complete closure for known absence', async () => {
    const parse = await scanValidator();
    const document = scanFixture();
    const local = summary();
    document.summaries.push(local);
    local.effects = { state: 'supported', value: [], support: ['source:handler'] };
    expect(() => parse(document)).toThrow('known absence');
    document.closures.push({
      id: 'closure:effects',
      complete: true,
      dependencies: [],
      searches: ['search:effects'],
      containingScope: local.id,
    });
    document.rules.push({
      id: 'rule:search',
      kind: 'rule',
      version: '1',
      concerns: ['storage'],
      applicability: 'extraction',
      prerequisites: [],
    });
    document.searches = [
      {
        id: 'search:effects',
        kind: 'search',
        scope: local.id,
        rule: 'rule:search',
        sources: ['source:handler'],
        inventoryFingerprint: 'pinned-inventory',
        complete: true,
        queries: ['all calls in handler'],
      },
    ];
    local.effects.closure = 'closure:effects';
    expect(parse(document)).toEqual(document);
    expect(() =>
      parse({ ...document, summaries: [{ ...local, effects: { ...local.effects, support: [] } }] }),
    ).toThrow('fewer than 1');
  });

  it('rejects wrong-kind concern refs, source/host mismatch and opaque no-effects', async () => {
    const parse = await scanValidator();
    const document = endpoint();
    const slot = document.receipts[0]?.answers.find(
      (item) => item.obligation === 'obligation:inputs',
    );
    if (slot === undefined) throw new Error('Missing fixture answer');
    slot.answer = { state: 'supported', value: ['host:server'], support: ['source:handler'] };
    expect(() => parse(document)).toThrow('must reference contract');
    document.receipts = [];
    const local = summary();
    document.summaries.push(local);
    document.hosts.push({
      kind: 'host',
      id: 'host:other',
      component: 'component:other',
      environment: 'server',
      support: ['source:handler'],
    });
    local.host = 'host:other';
    expect(() => parse(document)).toThrow('source/host mismatch');
    local.host = 'host:server';
    document.closures.push({
      id: 'closure:effects',
      complete: true,
      dependencies: [],
      searches: ['search:effects'],
      containingScope: local.id,
    });
    local.effects = {
      state: 'supported',
      value: [],
      support: ['source:handler'],
      closure: 'closure:effects',
    };
    local.frontiers.push({
      id: 'frontier:opaque',
      kind: 'frontier',
      reason: 'unsupported',
      source: 'source:handler',
      nextQuestion: 'Expand callback',
      contextLoss: [],
    });
    expect(() => parse(document)).toThrow('unexpanded frontier');
  });

  it('keeps absent fields, nullable payloads and void returns distinct', async () => {
    const parse = await scanValidator();
    const document = scanFixture();
    document.contracts.push({
      kind: 'contract',
      id: 'contract:input',
      support: ['source:handler'],
      shape: {
        kind: 'object',
        spelling: '{ name?: string | null }',
        additionalProperties: false,
        enforcement: 'source',
        fields: [
          {
            name: 'name',
            presence: 'optional',
            nullable: true,
            shape: { kind: 'scalar', name: 'string', spelling: 'string' },
          },
        ],
      },
    });
    const local = summary();
    local.operations.push({
      kind: 'return',
      id: 'operation:return',
      source: 'source:handler',
      value: { kind: 'void' },
    });
    document.summaries.push(local);
    expect(parse(document)).toEqual(document);
    expect(() =>
      parse({
        ...document,
        summaries: [{ ...local, operations: [{ ...local.operations[0], value: null }] }],
      }),
    ).toThrow('ScanDocument');
  });
});
