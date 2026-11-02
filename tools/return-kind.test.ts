import { describe, expect, it, vi } from 'vitest';

import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import type { Implementation, KnowledgeRecord } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';

import { runtimeProofInput } from './runtime-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const { bundle } = await runtimeProofInput('soft-offer');
const parse = await knowledgeValidators();

// Synthetic source signatures reproduce a scanner assigning a value to a void call.
function changed(
  returnKind: Implementation['returnKind'],
  callResult: string | null,
  returnResult: string | null = null,
): KnowledgeRecord[] {
  return bundle.records.map((record): KnowledgeRecord => {
    if (record.kind === 'implementation' && record.id === 's2/add') {
      return returnKind === undefined ? record : { ...record, returnKind };
    }
    if (record.kind === 'operation' && record.id === 's2/http.add') {
      return { ...record, result: callResult };
    }
    if (record.kind === 'operation' && record.id === 's2/add.return') {
      return { ...record, result: returnResult };
    }
    return record;
  });
}

function problems(records: KnowledgeRecord[]): string[] {
  return checkKnowledge(parse.bundle({ ...bundle, records }));
}

describe('immediate source return contracts', () => {
  it('accepts a void call and bare return without inventing a result', () => {
    expect(problems(changed('void', null))).toEqual([]);
  });

  it('rejects a fabricated result at a bound void invocation', () => {
    expect(problems(changed('void', 's2/v/input'))).toContain(
      's2/http.add: bound void invocation cannot define a result',
    );
  });

  it('rejects a value return inside a void implementation', () => {
    expect(problems(changed('void', null, 's2/v/entity'))).toContain(
      's2/add.return: void implementation cannot return a value',
    );
  });

  it.each(['value', 'unresolved', undefined] as const)(
    'preserves a possible result when return kind is %s',
    (kind) => {
      expect(problems(changed(kind, 's2/v/input', 's2/v/entity'))).toEqual([]);
    },
  );

  it('permits discarding a Task/Promise handle or other source value', () => {
    expect(problems(changed('value', null))).toEqual([]);
  });

  it('does not infer a void target from unresolved dispatch candidates', () => {
    const records = changed('void', 's2/v/input').map((record): KnowledgeRecord =>
      record.kind === 'resolution' && record.id === 's2/resolve/http.add'
        ? { ...record, basis: 'unresolved', target: null, candidates: ['s2/add'] }
        : record,
    );
    expect(problems(records)).toEqual([]);
  });

  it('keeps archived schemas strict', () => {
    const implementation = bundle.records.find((record) => record.id === 's2/add');
    expect(implementation).toBeDefined();
    const archived = { ...bundle, format: 'groundwork-knowledge/v2', records: [implementation] };
    expect(() => parse.bundle(archived)).not.toThrow();
    expect(() =>
      parse.bundle({
        ...archived,
        records: [{ ...implementation, returnKind: 'void' }],
      }),
    ).toThrow(/additional properties/u);
  });
});
