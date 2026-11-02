import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { collectJavaBindings } from '@/infrastructure/scan/java-call-bindings';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';

import { orderPredicate } from './scan-order-review-graph';
import { profileGraph, type ProfileGraph } from './scan-profile-review-graph';

vi.mock(import('server-only'), () => ({}));
const GUARD = 'payload!=null&&StringUtils.hasText(payload.customerId())';

function fixture(body: string): ProfileGraph {
  const index = indexSource({
    path: 'src/OrderUpdateEventConsumer.java',
    language: 'java',
    content: `class OrderUpdateEventConsumer {
    boolean filter(Payload payload) { ${body} }
  }`,
  });
  expect(index.diagnostics).toEqual([]);
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Expected Java declarations');
  const facts = extractLocalFacts(index, {
    host: 'host:test',
    repo: 'fixture/repo',
    commit: 'a'.repeat(40),
  });
  const bindings = collectJavaBindings([index], [unit]);
  return profileGraph({
    ...scanFixture(),
    sources: [...facts.sources],
    semantic: [...(facts.semantic ?? [])],
    bindings: bindings.values.map((binding) => ({ ...binding, guards: [...binding.guards] })),
  });
}

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')('whole order predicates', () => {
  it('requires one direct return with the full typed predicate and lexical links', () => {
    expect(
      orderPredicate(
        fixture(`return payload != null && StringUtils.hasText(payload.customerId());`),
        'filter',
        GUARD,
      ),
    ).toBe(true);
    expect(
      orderPredicate(
        fixture(
          `if (payload == null) return true; return payload != null && StringUtils.hasText(payload.customerId());`,
        ),
        'filter',
        GUARD,
      ),
    ).toBe(false);
  }, 30_000);
  it('rejects a correct return hidden inside an unreachable branch', () => {
    expect(
      orderPredicate(
        fixture(
          `if (false) return payload != null && StringUtils.hasText(payload.customerId()); return true;`,
        ),
        'filter',
        GUARD,
      ),
    ).toBe(false);
  }, 30_000);
});
