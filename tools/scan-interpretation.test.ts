import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { interpretationFixture } from '@/../test/scan-interpretation-kit';
import { interpretationClaims, pendingInterpretation } from '@/domain/scan/interpretation-query';
import {
  interpretationDigest,
  interpretationValidator,
} from '@/infrastructure/scan/interpretation-format';

import { generateInterpretationTypes } from './scan-interpretation-types';

vi.mock(import('server-only'), () => ({}));

describe('separate model interpretation', () => {
  it('keeps generated types and the authoritative closed schema together', async () => {
    await expect(readFile('src/domain/scan/interpretation.generated.ts', 'utf8')).resolves.toBe(
      await generateInterpretationTypes(),
    );
  });
  it('validates five useful best-effort areas without changing observed records', async () => {
    const { document, inputs } = interpretationFixture();
    const original = structuredClone(inputs);
    const validate = await interpretationValidator(inputs);
    expect(validate(document).state).toBe('complete');
    expect(inputs).toEqual(original);
    expect(interpretationClaims(document).claims).toHaveLength(5);
  });
  it('keeps inferred labels for high confidence and human confirmation', async () => {
    const { document, inputs } = interpretationFixture();
    document.claims[0]!.confidence = 'high';
    document.claims[0]!.confirmation = {
      by: 'Fixture reviewer',
      at: '2026-10-25T12:02:00Z',
      notes: 'Synthetic confirmation',
    };
    const validate = await interpretationValidator(inputs);
    const view = interpretationClaims(validate(document), 'purpose');
    expect(view.label).toBe('inferred');
    expect(view.claims[0]?.label).toBe('inferred');
    expect(view.claims[0]?.confidence).toBe('high');
  });
  it('permits honest insufficient-context outcomes without inventing actors or journeys', async () => {
    const { document, inputs } = interpretationFixture();
    document.claims = [];
    document.attempts = document.attempts.map((attempt) => ({
      ...attempt,
      outcome: 'insufficient_context',
      claim_ids: [],
      reason: 'Examined source and available surroundings do not support a useful guess.',
    }));
    const validate = await interpretationValidator(inputs);
    expect(validate(document).state).toBe('complete');
  });
  it('reports pending until the model phase happens and rejects inherited zero-call usage', async () => {
    const { document, inputs } = interpretationFixture();
    const validate = await interpretationValidator(inputs);
    const pending = pendingInterpretation('interpretation:pending', document.contexts[0]);
    expect(validate(pending).state).toBe('pending');
    expect(() =>
      validate({
        ...document,
        runs: [
          {
            ...document.runs[0],
            usage: { state: 'measured', calls: 0, input_tokens: 0, output_tokens: 0 },
          },
        ],
      }),
    ).toThrow('ScanInterpretation');
  });
  it('binds a contextual note to exact bytes and line ranges without treating it as code', async () => {
    const { document, inputs } = interpretationFixture();
    const bytes = '# Product context\nThe team supports customer care.\n';
    document.contexts.push({
      kind: 'context_snapshot',
      id: 'context:note',
      sha256: interpretationDigest(bytes),
      role: 'surrounding',
      uri: 'workspace:team-note',
      title: 'Team note',
      revision: 'note-r1',
      authority: 'team_note',
      input_provenance: {
        provided_by: 'workspace',
        retrieved_at: '2026-10-25T12:00:00Z',
        description: 'Existing team note supplied as context',
      },
      pins: [],
    });
    document.runs[0]!.input_context_ids.push('context:note');
    document.claims[0]!.support.push({
      kind: 'context_snapshot',
      context_id: 'context:note',
      locator: 'Customer care paragraph',
      lines: [2, 2],
    });
    const validate = await interpretationValidator([
      ...inputs,
      {
        kind: 'context_snapshot',
        id: 'context:note',
        bytes,
        uri: 'workspace:team-note',
        revision: 'note-r1',
      },
    ]);
    expect(validate(document).claims[0]?.label).toBe('inferred');
    const changed = structuredClone(document);
    changed.contexts[1]!.sha256 = '0'.repeat(64);
    expect(() => validate(changed)).toThrow('digest');
  });
});
