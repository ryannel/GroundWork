import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { handlerStoryOf, type StepView } from './today-handler';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const model = derive(await loadFixture('handlers.yaml'));

/** Each step as one line, nested steps indented under their heading. */
function drawn(steps: readonly StepView[], indent = ''): string[] {
  return steps.flatMap((s) => {
    if (s.kind === 'block') {
      return s.branches.flatMap((b) => [`${indent}${b.label}`, ...drawn(b.steps, `${indent}  `)]);
    }
    if (s.kind === 'link') return [`${indent}${s.verb} ${s.chip.id}`];
    return [`${indent}${s.text}`];
  });
}

describe('handlerStoryOf', () => {
  it('reads what runs when an endpoint is called, fork by fork', () => {
    const story = handlerStoryOf(model, 'api:pricing-get-price');
    const [handler] = story?.handlers ?? [];
    expect(handler?.id).toBe('h:pricing-get-price');
    expect(drawn(handler?.steps ?? []).map((l) => l.trim())).toContain('Calls api:fx-get-rate');
    expect(
      handler?.steps.some(
        (s) => s.kind === 'block' && s.branches[0]?.label.startsWith('If ') === true,
      ),
    ).toBe(true);
    expect(handler?.fails).toEqual([{ when: 'the SKU is unknown', result: '404 not_found' }]);
  });

  it('opens what the callee does, and gathers the stores it touches', () => {
    const story = handlerStoryOf(model, 'api:pricing-get-price');
    const steps = story?.handlers[0]?.steps ?? [];
    const flat = (list: readonly StepView[]): StepView[] =>
      list.flatMap((s) => (s.kind === 'block' ? flat(s.branches.flatMap((b) => b.steps)) : [s]));
    const call = flat(steps).find((s) => s.kind === 'link' && s.chip.id === 'api:fx-get-rate');
    expect(call?.kind === 'link' && call.next.map(({ id }) => id)).toEqual(['h:fx-get-rate']);
    expect(story?.stores.map(({ id }) => id)).toContain('st:pricing-db');
  });

  it('gives nothing for what no handler answers', () => {
    expect(handlerStoryOf(model, 'api:nothing-here')).toBeNull();
  });
});
