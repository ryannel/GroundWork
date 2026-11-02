import { describe, expect, it, vi } from 'vitest';

import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import type {
  InterfaceContract,
  Interaction,
  KnowledgeRecord,
} from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';

import { runtimeProofInput } from './runtime-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const { bundle } = await runtimeProofInput('soft-offer');
const parse = await knowledgeValidators();

function problems(record: KnowledgeRecord): string {
  return recordProblems(bundle.records.map((item) => (item.id === record.id ? record : item)));
}

function recordProblems(records: readonly KnowledgeRecord[]): string {
  return checkKnowledge(parse.bundle({ ...bundle, records })).join('\n');
}

function contract(id = 'u3/contract/soft-api'): InterfaceContract {
  const record = bundle.records.find((item) => item.id === id);
  if (record?.kind !== 'interface_contract') throw new Error('Missing contract fixture');
  return record;
}

function interaction(id = 'u3/interaction/publish'): Interaction {
  const record = bundle.records.find((item) => item.id === id);
  if (record?.kind !== 'interaction') throw new Error('Missing interaction fixture');
  return record;
}

describe('runtime contract integrity', () => {
  it.each(['candidate', 'unresolved', 'caller_construction'] as const)(
    'rejects %s contracts as inbound endpoint exposures',
    (authority) => {
      expect(problems({ ...contract(), authority })).toContain(
        'inbound exposure requires an established contract',
      );
    },
  );
  it('rejects a Kafka contract on a REST entry even when method and path agree', () => {
    expect(problems({ ...contract(), protocol: 'kafka' })).toContain(
      'REST entry requires an HTTP contract',
    );
  });
  it('accepts HTTPS endpoint contracts', () => {
    expect(problems({ ...contract(), protocol: 'https' })).toBe('');
  });
  it('rejects contradictory duplicate contract parts', () => {
    const original = contract();
    const body = original.request[0];
    if (body === undefined) throw new Error('Missing request body');
    expect(
      problems({
        ...original,
        request: [
          ...original.request,
          { ...body, presence: 'none', shape: null, sourceShape: null },
        ],
      }),
    ).toContain('request contract parts must be unique');
  });
  it('rejects a source schema for an explicitly absent message key', () => {
    const original = contract('u3/contract/soft-created');
    expect(
      problems({
        ...original,
        request: original.request.map((part) =>
          part.part === 'key' ? { ...part, sourceShape: 's2/shape/p-wire' } : part,
        ),
      }),
    ).toContain('absent contract parts must not assert a shape');
  });
  it('rejects write interactions pointing at read effects', () => {
    expect(problems({ ...interaction('u3/interaction/refetch'), mode: 'write' })).toContain(
      'mode must agree with its effect kind',
    );
  });
  it('rejects a blob write disguised as inbound consumption', () => {
    const result = problems({
      ...interaction('u3/interaction/cold'),
      mode: 'consume',
      handoff: null,
      gaps: [],
    });
    expect(result).toContain('consumption cannot assert an outbound effect');
    expect(result).toContain('consumption requires a topic component');
    expect(result).toContain('consumption must run at its implementation entry');
    expect(result).toContain('unmatched consumption requires an explicit handoff gap');
  });
  it('permits an unmatched genuine consumer only with a gap', () => {
    const original = interaction('u3/interaction/consume');
    expect(problems({ ...original, handoff: null, gaps: [] })).toContain(
      'unmatched consumption requires',
    );
    expect(problems({ ...original, handoff: null, gaps: ['s2/gap/sdk-policy'] })).toBe('');
  });
  it.each(['return', 'throw', 'entry'] as const)(
    'rejects outbound interactions on %s operations',
    (action) => {
      const operation = bundle.records.find((item) => item.id === 's2/publish.attempt');
      if (operation?.kind !== 'operation') throw new Error('Missing publish operation');
      expect(problems({ ...operation, action })).toContain(
        'outbound interaction requires an executing call site',
      );
    },
  );
  it('rejects network publication attached to a computation', () => {
    const operation = bundle.records.find((item) => item.id === 's2/publish.attempt');
    if (operation?.kind !== 'operation') throw new Error('Missing publish operation');
    expect(problems({ ...operation, action: 'compute' })).toContain(
      'requires a call or opaque operation',
    );
  });
  it('rejects invented fields in closed message schemas even when unrelated gaps exist', () => {
    const original = interaction();
    expect(
      problems({
        ...original,
        gaps: ['s2/gap/sdk-policy'],
        requestBindings: original.requestBindings.map((binding) =>
          binding.part === 'message' ? { ...binding, path: ['noSuchField'] } : binding,
        ),
      }),
    ).toContain('binding path contradicts its contract schema');
  });
  it('follows nested message fields rather than treating every nonempty path as valid', () => {
    const original = interaction();
    const requestBindings = [
      {
        part: 'message' as const,
        path: ['soft_offer', 'id'],
        value: 's2/v/message',
        transform: 'Nested source projection',
      },
    ];
    expect(problems({ ...original, requestBindings })).toBe('');
    expect(
      problems({
        ...original,
        requestBindings: requestBindings.map((binding) => ({
          ...binding,
          path: ['soft_offer', 'noSuchField'],
        })),
      }),
    ).toContain('binding path contradicts its contract schema');
  });
  it('retains partial header schemas and their explicit uncertainty', () => {
    const original = interaction();
    const requestBindings: Interaction['requestBindings'] = [
      {
        part: 'headers',
        path: ['sdk-added'],
        value: 's2/v/correlation',
        transform: 'Unverified SDK instrumentation',
      },
    ];
    expect(
      problems({
        ...original,
        requestBindings,
      }),
    ).toBe('');
    const records = bundle.records.map((record) => {
      if (record.id === original.id) return { ...original, requestBindings, gaps: [] };
      if (record.id === 'u3/shape/message-headers' && record.kind === 'shape') {
        return { ...record, gaps: [] };
      }
      if (record.id !== original.contract || record.kind !== 'interface_contract') return record;
      return { ...record, request: record.request.map((part) => ({ ...part, gaps: [] })) };
    });
    expect(recordProblems(records)).toContain(
      'unresolved transferred binding path requires an explicit schema gap',
    );
  });
});

describe('v3 source anchor integrity', () => {
  const evidence = bundle.records.find((record) => record.kind === 'evidence');
  if (evidence?.kind !== 'evidence') throw new Error('Missing evidence fixture');
  it.each([
    '../File.cs',
    './File.cs',
    '/File.cs',
    'src//File.cs',
    'src/../File.cs',
    String.raw`src\File.cs`,
    'src/\u0000File.cs',
  ])('rejects non-canonical source path %s', (path) => {
    expect(problems({ ...evidence, path })).toContain('relative POSIX file path without traversal');
  });
  it.each(['owner', 'owner/repo/more', '../repo', 'owner/..'])(
    'rejects invalid repository %s',
    (repo) => {
      expect(problems({ ...evidence, repo })).toContain('repository must be owner/repo');
    },
  );
  it.each(['..', 'github..com', '-github.com', 'github-.com'])(
    'rejects invalid hostname %s',
    (host) => {
      expect(problems({ ...evidence, host })).toContain('host must be a valid hostname');
    },
  );
  it('allows GitHub Enterprise hosts and encodable file names', () => {
    expect(problems({ ...evidence, host: 'github.example.org', path: 'src/a file#日本.cs' })).toBe(
      '',
    );
  });
});
