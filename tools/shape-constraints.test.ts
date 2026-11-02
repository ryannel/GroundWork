import { describe, expect, it, vi } from 'vitest';

import { interactionBindingProblems } from '@/domain/knowledge/check-interaction-bindings';
import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import type { KnowledgeRecord, Shape } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';

import { runtimeProofInput } from './runtime-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const parse = await knowledgeValidators();
const { bundle } = await runtimeProofInput('soft-offer');
// The independent forward scan found this declared body schema in the notification fixture.
const REQUEST_SHAPE: Shape = {
  id: 'notification/request-shape',
  kind: 'shape',
  representation: 'source',
  label: 'Declared notification request body',
  container: 'object',
  additionalProperties: false,
  fields: [
    { name: 'recipient', type: 'string', status: 'declared', optional: false, maxLength: 200 },
    { name: 'text', type: 'string', status: 'declared', optional: false },
  ],
  completeness: 'closed',
  gaps: [],
  evidence: ['notification/e/schema'],
};
const EVIDENCE = {
  id: 'notification/e/schema',
  kind: 'evidence',
  host: 'github.com',
  repo: 'example/notification-api',
  commit: '187bfb590586523a2786796e50bc9bc4505c5378',
  path: 'server.ts',
  lines: [4, 8],
  basis: 'source',
};

function jsonRoundTrip(input: unknown): unknown {
  const encoded = JSON.stringify(input);
  return JSON.parse(encoded);
}

function problems(shape: Shape): string[] {
  return checkKnowledge(
    parse.bundle({
      format: 'groundwork-knowledge/v3',
      workspace: 'scan-evaluation',
      records: [EVIDENCE, shape],
    }),
  );
}

function shapeWithField(field: Readonly<Record<string, unknown>>): unknown {
  return {
    ...REQUEST_SHAPE,
    fields: [{ name: 'status', type: 'string', status: 'declared', ...field }],
  };
}

function bindingProblems(change: Partial<Shape>): string[] {
  const records = bundle.records.map((record): KnowledgeRecord => {
    if (record.id === 's2/shape/p-wire' && record.kind === 'shape') return { ...record, ...change };
    if (record.id !== 'u3/interaction/publish' || record.kind !== 'interaction') return record;
    return {
      ...record,
      gaps: [],
      requestBindings: [
        {
          part: 'message',
          path: ['futureField'],
          value: 's2/v/message',
          transform: 'Source projection',
        },
      ],
    };
  });
  const interaction = records.find((record) => record.id === 'u3/interaction/publish');
  if (interaction?.kind !== 'interaction') throw new Error('Missing publication fixture');
  return interactionBindingProblems(
    interaction,
    new Map(records.map((record) => [record.id, record])),
  );
}

describe('native declared JSON constraints', () => {
  it('round-trips the forward scan request policy without hiding it in a claim', () => {
    const parsed = parse.record(jsonRoundTrip(REQUEST_SHAPE));
    expect(parsed).toEqual(REQUEST_SHAPE);
    expect(problems(REQUEST_SHAPE)).toEqual([]);
    expect(parsed).toMatchObject({
      additionalProperties: false,
      fields: [
        { name: 'recipient', optional: false, maxLength: 200 },
        { name: 'text', optional: false },
      ],
    });
  });
  it.each(['Text is empty', 202, true, false, null])(
    'retains scalar constant %s and matching enumeration',
    (literal) => {
      const record = parse.record(shapeWithField({ const: literal, enum: [literal] }));
      expect(parse.record(jsonRoundTrip(record))).toEqual(record);
      expect(record).toMatchObject({ fields: [{ const: literal, enum: [literal] }] });
      if (record.kind !== 'shape') throw new Error('Expected shape');
      expect(problems(record)).toEqual([]);
    },
  );
  it('retains heterogeneous scalar enumerations', () => {
    expect(parse.record(shapeWithField({ enum: ['pending', 202, true, null] }))).toMatchObject({
      fields: [{ enum: ['pending', 202, true, null] }],
    });
  });
  it.each([{ literal: {} }, { literal: [] }])(
    'rejects non-scalar constant $literal',
    ({ literal }) => {
      expect(() => parse.record(shapeWithField({ const: literal }))).toThrow('KnowledgeRecord');
    },
  );
  it.each([{ values: [] }, { values: ['sent', 'sent'] }, { values: [{}] }, { values: [[]] }])(
    'rejects an invalid scalar enumeration $values',
    ({ values }) => {
      expect(() => parse.record(shapeWithField({ enum: values }))).toThrow('KnowledgeRecord');
    },
  );
  it('rejects an additional properties policy that is not boolean', () => {
    expect(() => parse.record({ ...REQUEST_SHAPE, additionalProperties: 'false' })).toThrow(
      'KnowledgeRecord',
    );
  });
  it.each([
    { const: 'sent', enum: ['pending'] },
    { const: null, enum: ['null'] },
    { const: true, enum: [1] },
  ])('rejects contradictory literal constraints %s', (field) => {
    const record = parse.record(shapeWithField(field));
    if (record.kind !== 'shape') throw new Error('Expected shape');
    expect(problems(record).join('\n')).toContain('constant must belong to its declared enum');
  });
  it.each([true, false])(
    'requires an explicit object container for policy %s',
    (additionalProperties) => {
      const { container, ...unspecified } = REQUEST_SHAPE;
      expect(container).toBe('object');
      expect(problems({ ...unspecified, additionalProperties }).join('\n')).toContain(
        'policy requires an object shape',
      );
      expect(
        problems({
          ...REQUEST_SHAPE,
          container: 'array',
          fields: [],
          items: REQUEST_SHAPE.id,
          additionalProperties,
        }).join('\n'),
      ).toContain('policy requires an object shape');
    },
  );
  it('does not derive constants or enums from a free-form type string', () => {
    const record = parse.record(shapeWithField({ type: '"pending" | "sent"' }));
    expect(record).toMatchObject({ fields: [{ type: '"pending" | "sent"' }] });
    if (record.kind !== 'shape') throw new Error('Expected shape');
    expect(record.fields[0]).not.toHaveProperty('const');
    expect(record.fields[0]).not.toHaveProperty('enum');
    expect(problems(record)).toEqual([]);
  });
});

describe('additional properties and transferred paths', () => {
  it('leaves an undeclared property unresolved when an object explicitly allows extras', () => {
    expect(
      bindingProblems({
        additionalProperties: true,
        container: 'object',
        completeness: 'closed',
        gaps: [],
      }).join('\n'),
    ).toContain('requires an explicit schema gap');
    expect(
      bindingProblems({
        additionalProperties: true,
        container: 'object',
        completeness: 'closed',
        gaps: ['s2/gap/sdk-policy'],
      }),
    ).toEqual([]);
  });
  it('rejects an undeclared property when extras are forbidden even for a partial shape', () => {
    expect(
      bindingProblems({
        additionalProperties: false,
        container: 'object',
        completeness: 'partial',
        gaps: ['s2/gap/sdk-policy'],
      }).join('\n'),
    ).toContain('binding path contradicts its contract schema');
  });
  it('preserves closed and partial behaviour when the policy is omitted', () => {
    expect(bindingProblems({ completeness: 'closed', gaps: [] }).join('\n')).toContain(
      'binding path contradicts its contract schema',
    );
    expect(bindingProblems({ completeness: 'partial', gaps: [] }).join('\n')).toContain(
      'requires an explicit schema gap',
    );
    expect(bindingProblems({ completeness: 'partial', gaps: ['s2/gap/sdk-policy'] })).toEqual([]);
  });
});
