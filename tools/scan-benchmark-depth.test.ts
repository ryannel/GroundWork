import { describe, expect, it, vi } from 'vitest';

import goInput from '@/../test/fixtures/scan/scopes/go-dispatch-river.json' with { type: 'json' };
import nextInput from '@/../test/fixtures/scan/scopes/next-actor-endpoint.json' with { type: 'json' };
import springInput from '@/../test/fixtures/scan/scopes/spring-write-async.json' with { type: 'json' };
import { scanFixture } from '@/../test/scan-kit';
import type { LocalSummary, Operation } from '@/domain/scan/scan.generated';
import { parseScanScope } from '@/infrastructure/scan/scan-scope';

import { evaluateBenchmarkDepth } from './scan-benchmark-depth';

vi.mock(import('server-only'), () => ({}));
const spring = parseScanScope(springInput);
const go = parseScanScope(goInput);
const next = parseScanScope(nextInput);
const source = 'source:handler';

function invocation(
  id: string,
  callee: string,
  arguments_: string[],
): Extract<Operation, { readonly kind: 'call' }> {
  return {
    id,
    kind: 'call',
    source,
    callee,
    arguments: arguments_,
    waiting: 'sync',
    target: { state: 'unresolved', reason: 'missing_dependency', gap: 'gap:unknown' },
  };
}
function local(operations: Operation[]): LocalSummary {
  return {
    id: 'summary:root',
    kind: 'summary',
    source,
    host: 'host:server',
    implementation: 'root:0',
    context: { arguments: [], captures: [], typeArguments: [], configuration: [], policy: [] },
    effects: { state: 'unresolved', reason: 'missing_dependency', gap: 'gap:unknown' },
    operations,
    frontiers: [],
    support: [source],
  };
}
function springFixture() {
  const document = scanFixture();
  const path = spring.questions[0]?.path;
  const selectedSource = document.sources[0];
  if (path === undefined || path === '' || !selectedSource) throw new Error('Missing frozen root');
  Object.assign(selectedSource, {
    repo: spring.repo,
    commit: spring.commit,
    path,
    lines: [251, 263],
  });
  const summary = local([
    {
      id: 'op:guard',
      kind: 'control',
      source,
      predicate: {
        expression: 'updatedCustomer.equals(previousCustomer)',
        polarity: true,
        inputs: ['updatedCustomer', 'previousCustomer'],
      },
      consequent: ['op:return'],
      otherwise: [],
    },
    {
      id: 'op:return',
      kind: 'return',
      source,
      value: { kind: 'value', values: ['updatedCustomer'] },
    },
    invocation('op:validate', 'customerValidatorService.validate', ['updatedCustomer']),
    invocation('op:save', 'customerRepository.save', ['updatedCustomer']),
    invocation('op:post', 'savePostProcessor.postProcess', ['previousCustomer', 'updatedCustomer']),
  ]);
  document.summaries.push(summary);
  return { document, summary };
}
function checked(id: string, fixture = springFixture()) {
  const found = evaluateBenchmarkDepth(spring, fixture.document).find((entry) => entry.id === id);
  if (!found) throw new Error('Missing required depth check');
  return found;
}

describe('independent frozen semantic depth evaluator', () => {
  it('accepts a structured early-return branch with guarded later callsites', () => {
    expect(checked('spring-equal-branch')).toMatchObject({
      status: 'supported',
      evidence: ['op:guard', 'op:return', 'op:validate', 'op:save', 'op:post'],
    });
  });

  it('fails removal of a required branch even if the remaining calls are present', () => {
    const fixture = springFixture();
    fixture.summary.operations = fixture.summary.operations.filter(
      (entry) => entry.kind !== 'control',
    );
    expect(checked('spring-equal-branch', fixture).status).toBe('failed');
  });

  it('fails save moved into the equality branch instead of trusting call count', () => {
    const fixture = springFixture();
    const guard = fixture.summary.operations[0];
    if (guard?.kind !== 'control') throw new Error('Missing guard');
    guard.consequent.push('op:save');
    expect(checked('spring-equal-branch', fixture).status).toBe('failed');
  });

  it('does not turn correct actuals into an invented assignment binding', () => {
    expect(checked('spring-rebound-save-result').status).toBe('unresolved');
    expect(checked('spring-rebound-save-result').reason).toContain('assignment/reaching-value');
    const fixture = springFixture();
    const post = fixture.summary.operations.find((entry) => entry.id === 'op:post');
    if (post?.kind !== 'call') throw new Error('Missing call');
    post.arguments.pop();
    expect(checked('spring-rebound-save-result', fixture).status).toBe('failed');
  });

  it('fails wrong call order and does not infer semantics from source-looking strings', () => {
    const fixture = springFixture();
    const last = fixture.summary.operations.pop();
    if (!last) throw new Error('Missing call');
    fixture.summary.operations.unshift(last);
    expect(checked('spring-rebound-save-result', fixture).status).toBe('failed');
    fixture.document.summaries = [];
    expect(checked('spring-equal-branch', fixture).status).toBe('unresolved');
  });

  it('reports all 19 mandatory checks and makes every absent semantic root unresolved', () => {
    const document = scanFixture();
    const checks = [spring, go, next].flatMap((scope) => evaluateBenchmarkDepth(scope, document));
    expect(checks).toHaveLength(19);
    expect(
      checks.every((entry) => entry.status === 'unresolved' && entry.evidence.length === 0),
    ).toBe(true);
    expect(new Set(checks.map((entry) => entry.id)).size).toBe(19);
  });

  it('distinguishes a normal Go error return from a thrown fault', () => {
    const document = scanFixture();
    const selectedSource = document.sources[0];
    const path = go.questions[0]?.path;
    if (!selectedSource || path === undefined || path === '') throw new Error('Missing root');
    Object.assign(selectedSource, { repo: go.repo, commit: go.commit, path, lines: [28, 35] });
    const summary = local([
      {
        kind: 'control',
        id: 'op:missing',
        source,
        predicate: { expression: '!ok', polarity: true, inputs: [] },
        consequent: ['op:error'],
        otherwise: [],
      },
      {
        kind: 'return',
        id: 'op:error',
        source,
        value: { kind: 'value', values: ['errors.New("no handler found for command")'] },
      },
      {
        kind: 'return',
        id: 'op:handled',
        source,
        value: { kind: 'value', values: ['handler.(commandHandler[C]).Handle(ctx, cmd)'] },
      },
      {
        ...invocation('op:handle', 'handler.(commandHandler[C]).Handle', ['ctx', 'cmd']),
        waiting: 'returned',
      },
    ]);
    document.summaries.push(summary);
    const before = evaluateBenchmarkDepth(go, document);
    expect(before.find((entry) => entry.id === 'go-error-not-throw')?.status).toBe('supported');
    expect(before.find((entry) => entry.id === 'go-contextual-registry')?.status).toBe(
      'unresolved',
    );
    const guard = summary.operations[0];
    if (guard?.kind !== 'control') throw new Error('Missing Go guard');
    guard.predicate.polarity = false;
    expect(
      evaluateBenchmarkDepth(go, document).find((entry) => entry.id === 'go-error-not-throw')
        ?.status,
    ).toBe('failed');
    guard.predicate.polarity = true;
    summary.operations.push({ kind: 'throw', id: 'op:invented-throw', source, value: 'err' });
    expect(
      evaluateBenchmarkDepth(go, document).find((entry) => entry.id === 'go-error-not-throw')
        ?.status,
    ).toBe('failed');
  });

  it('detects omitted SQL actuals without promoting the remaining argument list into a column map', () => {
    const document = scanFixture();
    const selectedSource = document.sources[0];
    const path = go.questions[2]?.path;
    if (!selectedSource || path === undefined || path === '') throw new Error('Missing root');
    Object.assign(selectedSource, { repo: go.repo, commit: go.commit, path, lines: [110, 140] });
    const exec = invocation('op:exec', 'tx.Exec', [
      'ctx',
      '`INSERT INTO policy_rulesets ...`',
      'policyRuleset.Car.Pno12.String()',
      'policyRuleset.Car.ModelYear',
      'policyRuleset.Car.SpecMarket',
      'policyRuleset.Car.LocalEditionCode',
      'policyRuleset.PolicyID',
      'policyRuleset.RulesetPath',
    ]);
    document.summaries.push(local([exec]));
    expect(
      evaluateBenchmarkDepth(go, document).find(
        (entry) => entry.id === 'go-sql-positional-bindings',
      )?.status,
    ).toBe('unresolved');
    exec.arguments.pop();
    expect(
      evaluateBenchmarkDepth(go, document).find(
        (entry) => entry.id === 'go-sql-positional-bindings',
      )?.status,
    ).toBe('failed');
  });

  it('rejects evidence from another snapshot and any scope beyond the fixed three', () => {
    const fixture = springFixture();
    const selectedSource = fixture.document.sources[0];
    if (!selectedSource) throw new Error('Missing source');
    selectedSource.commit = 'another-commit';
    expect(checked('spring-equal-branch', fixture).status).toBe('failed');
    expect(() => evaluateBenchmarkDepth({ ...spring, id: 'wider-scan' }, fixture.document)).toThrow(
      'three frozen scopes',
    );
  });
  it('refuses a frozen scope id reused at an unreviewed revision', () => {
    expect(() =>
      evaluateBenchmarkDepth({ ...spring, commit: '0'.repeat(40) }, scanFixture()),
    ).toThrow('frozen commits');
  });

  it('does not treat calls nested under a second false guard as unconditional fallthrough', () => {
    const fixture = springFixture();
    fixture.summary.operations.push({
      kind: 'control',
      id: 'op:never',
      source,
      predicate: { expression: 'false', polarity: true, inputs: [] },
      consequent: ['op:save', 'op:post'],
      otherwise: [],
    });
    expect(checked('spring-equal-branch', fixture).status).toBe('unresolved');
  });

  it('does not infer branch reachability through opaque operations', () => {
    const fixture = springFixture();
    fixture.summary.operations.push({
      kind: 'opaque',
      id: 'op:opaque',
      source,
      frontier: 'frontier:unsupported',
    });
    expect(checked('spring-equal-branch', fixture).status).toBe('unresolved');
  });
});
