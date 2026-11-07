import { describe, expect, it } from 'vitest';

import { flowCite as cite, flowFixture } from '@/../test/fixtures/model-current-flow';
import { queryModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';

import { modelFlowOf } from './model-flow';

describe('native authored flow view', () => {
  it('retains every authored field and source pin in exact order without deriving execution', () => {
    const model = flowFixture();
    const original = JSON.stringify(model);
    const index = indexOf(model);
    const execution = index.edges();
    const flow = modelFlowOf(index, 'flow:story');
    expect(flow?.source).toEqual(model.flows[0]);
    expect(flow?.steps.map((step) => step.source)).toEqual(model.flows[0]?.steps);
    expect(flow?.steps.map((step) => step.id)).toEqual(['flow:story#first', 'flow:story#second']);
    expect(flow?.actor).toBe('Reader');
    expect(flow?.steps[0]).toMatchObject({
      from: { id: 'svc:a' },
      to: { id: 'svc:b' },
      via: { id: 'api:a' },
      backing: { id: 'h:a#read' },
      screen: { id: 'scr:known', missing: true },
      entryHref: '/queries/entries/?id=api-a',
    });
    expect(flow?.steps[0]?.sources.cites).toEqual([cite]);
    expect(flow?.steps[0]?.sources.code[0]?.href).toBe(
      `https://github.com/fixture/a/blob/${cite.commit}/flow.ts#L2-L9`,
    );
    expect(flow?.steps[1]).toMatchObject({
      via: null,
      backing: null,
      entryHref: null,
      sources: { cites: [cite] },
    });
    expect(index.edges()).toEqual(execution);
    expect(execution.some((edge) => edge.from === 'svc:a' && edge.to === 'svc:b')).toBe(false);
    const serialised = JSON.stringify(flow);
    expect(JSON.parse(serialised)).toEqual(flow);
    expect(JSON.stringify(model)).toBe(original);
  });

  it('rejects a non-flow identity rather than making up a narrative', () => {
    expect(modelFlowOf(indexOf(queryModel()), 'svc:a')).toBeNull();
    expect(modelFlowOf(indexOf(queryModel()), 'flow:missing')).toBeNull();
  });
});
