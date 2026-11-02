import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import type { ScanInterpretation } from '@/domain/scan/interpretation.generated';
import {
  interpretationDigest,
  interpretationValidator,
  type InterpretationInput,
} from '@/infrastructure/scan/interpretation-format';

vi.mock(import('server-only'), () => ({}));
function fixture(): {
  readonly inputs: readonly InterpretationInput[];
  readonly document: ScanInterpretation;
} {
  const input: InterpretationInput = {
    kind: 'context_snapshot',
    id: 'context:product',
    bytes: 'Sales tools use the customer platform.',
    uri: 'urn:fixture:product',
    revision: 'r1',
  };
  const evidence = {
    kind: 'context_snapshot',
    context_id: input.id,
    locator: 'product note',
    lines: [1, 1],
  } as const;
  return {
    inputs: [input],
    document: {
      format: 'scan-interpretation/v1',
      id: 'interpretation:fixture',
      state: 'complete',
      contexts: [
        {
          kind: 'context_snapshot',
          id: input.id,
          sha256: interpretationDigest(input.bytes),
          role: 'target',
          uri: input.uri,
          title: 'Product context',
          revision: input.revision,
          authority: 'user_context',
          input_provenance: {
            provided_by: 'user',
            retrieved_at: '2026-10-25T10:00:00Z',
            description: 'Synthetic product note supplied for interpretation',
          },
          pins: [],
        },
      ],
      runs: [
        {
          id: 'run:one',
          provider: 'fixture',
          model: { name: null, provenance: 'unknown' },
          started_at: '2026-10-25T10:00:00Z',
          finished_at: '2026-10-25T10:01:00Z',
          method: 'Best-effort purpose interpretation of supplied context',
          input_context_ids: [input.id],
          usage: {
            state: 'unknown',
            calls_lower_bound: 1,
            reason: 'Agent model counters are unavailable in this fixture',
          },
        },
      ],
      claims: [
        {
          kind: 'purpose',
          id: 'purpose:customer',
          label: 'inferred',
          statement: 'The platform probably supports sales workflows with customer data.',
          reasoning: 'The supplied product context names sales tools as callers.',
          confidence: 'medium',
          alternatives: ['Other caller types may also exist.'],
          limitations: ['The note does not establish deployed behaviour.'],
          support: [{ ...evidence, lines: [1, 1] }],
          dependencies: [],
          run_id: 'run:one',
          subject: { ...evidence, lines: [1, 1] },
        },
      ],
      attempts: [
        {
          area: 'purpose',
          outcome: 'claims_proposed',
          claim_ids: ['purpose:customer'],
          reason: 'The supplied note supports a probable purpose.',
          run_id: 'run:one',
        },
        ...(['actor', 'action', 'journey', 'relationship'] as const).map((area) => ({
          area,
          outcome: 'insufficient_context' as const,
          claim_ids: [],
          reason:
            'This synthetic note omits the details required for a useful proposal in this area.',
          run_id: 'run:one',
        })),
      ],
    },
  };
}

describe('readiness interpretation boundary', () => {
  it('accepts useful labelled inference without promoting context into source facts', async () => {
    const { inputs, document } = fixture();
    const parse = await interpretationValidator(inputs);
    expect(parse(document).claims[0]?.label).toBe('inferred');
    expect(inputs[0]?.bytes).toBe('Sales tools use the customer platform.');
  });
  it('rejects an unseen entity context despite a valid support citation', async () => {
    const { inputs, document } = fixture();
    const extra: InterpretationInput = {
      kind: 'context_snapshot',
      id: 'context:unseen',
      bytes: 'Unseen target context.',
      uri: 'urn:fixture:unseen',
      revision: 'r2',
    };
    const context = document.contexts[0];
    if (context.kind !== 'context_snapshot') throw new Error('Missing fixture context');
    document.contexts.push({
      ...context,
      id: extra.id,
      sha256: interpretationDigest(extra.bytes),
      uri: extra.uri,
      revision: extra.revision,
    });
    const claim = document.claims[0];
    if (claim?.kind !== 'purpose') throw new Error('Missing fixture claim');
    claim.subject = {
      kind: 'context_snapshot',
      context_id: extra.id,
      locator: 'Unseen note',
      lines: [1, 1],
    };
    const parse = await interpretationValidator([...inputs, extra]);
    expect(() => parse(document)).toThrow('input');
  });
  it('rejects a scan context with a falsely claimed repository pin', async () => {
    const { inputs, document } = fixture();
    const scan = scanFixture();
    scan.sources = scan.sources.map((source) => ({ ...source, commit: 'a'.repeat(40) }));
    const bytes = JSON.stringify(scan);
    document.contexts.push({
      kind: 'scan_snapshot',
      id: 'context:scan',
      role: 'surrounding',
      sha256: interpretationDigest(bytes),
      scan_id: scan.id,
      repo: 'wrong/repo',
      commit: 'b'.repeat(40),
    });
    document.runs[0]?.input_context_ids.push('context:scan');
    const parse = await interpretationValidator([
      ...inputs,
      { kind: 'scan_snapshot', id: 'context:scan', bytes },
    ]);
    expect(() => parse(document)).toThrow('repository revision');
  });
  it('rejects observed labels, copied zero usage, missing attempts and cyclic dependencies', async () => {
    const { inputs, document } = fixture();
    const parse = await interpretationValidator(inputs);
    expect(() =>
      parse({
        ...document,
        claims: document.claims.map((claim) => ({ ...claim, label: 'observed' })),
      }),
    ).toThrow('ScanInterpretation');
    expect(() =>
      parse({
        ...document,
        runs: document.runs.map((run) => ({
          ...run,
          usage: { state: 'measured', calls: 0, input_tokens: 0, output_tokens: 0 },
        })),
      }),
    ).toThrow('ScanInterpretation');
    expect(() =>
      parse({
        ...document,
        attempts: document.attempts.filter((attempt) => attempt.area !== 'actor'),
      }),
    ).toThrow('actor');
    const cyclic = structuredClone(document);
    cyclic.claims[0]?.dependencies.push('purpose:customer');
    expect(() => parse(cyclic)).toThrow('cyclic');
    expect(() => parse({ ...document, state: 'pending' })).toThrow('Pending');
  });
});
