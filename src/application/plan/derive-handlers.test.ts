import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { CallTree } from '@/application/plan/derive-handlers';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const prices = async (): Promise<Plan> => loadFixture('handlers.yaml');
const m = derive(await prices());

const stopMark = (stop: string | null): string => (stop === null ? '' : ` [${stop}]`);

/** A tree drawn as indented lines: handler, then each link with where it stops. */
function drawn(trees: CallTree[], indent = ''): string[] {
  return trees.flatMap((t) => [
    `${indent}${t.handler}`,
    ...t.links.flatMap((l) => [
      `${indent}  ${l.kind} ${l.target}${stopMark(l.stop)}`,
      ...drawn(l.next, `${indent}    `),
    ]),
  ]);
}

describe('handler edges', () => {
  const edges = m.handlerEdges();
  const of = (target: string) =>
    edges.find((e) => e.handler === 'h:pricing-get-price' && e.target === target);

  it('lists each call, publish, read and write in step order', () => {
    expect(edges.map((e) => `${e.handler} ${e.kind} ${e.from}->${e.to ?? '?'}`)).toEqual([
      'h:pricing-get-price read svc:pricing->st:pricing-db',
      'h:pricing-get-price call svc:pricing->svc:fx',
      'h:pricing-get-price write svc:pricing->st:pricing-db',
      'h:pricing-get-price publish svc:pricing->st:price-events',
      'h:search-reindex call svc:search->svc:pricing',
      'h:nightly call svc:search->svc:fx',
    ]);
  });

  it('says when a link happens, in words', () => {
    expect(of('api:fx-get-rate')).toMatchObject({
      path: ['steps', 1, 'else', 1],
      guard: 'unless the SKU has a manual price, when the country prices in another currency',
      conditional: true,
      looped: false,
      async: false,
    });
    expect(of('msg:price-changed')).toMatchObject({
      guard: 'when the price changed',
      conditional: true,
    });
    expect(of('sch:price-rule')).toMatchObject({ kind: 'read', guard: null, conditional: false });
  });

  it('marks async, retried and parallel links', () => {
    const write = edges.find((e) => e.kind === 'write');
    expect(write).toMatchObject({ async: true, conditional: false });
    const retried = edges.find((e) => e.handler === 'h:search-reindex');
    expect(retried?.guard).toBe('retrying on a timeout');
    const nightly = edges.find((e) => e.handler === 'h:nightly');
    expect(nightly?.guard).toBe('in parallel');
  });

  it('marks links inside a loop as looped', () => {
    const p = structuredClone(m.plan);
    const h = p.handlers?.[0];
    const fork = h?.steps[1];
    if (fork !== undefined && 'else' in fork) {
      const loop = fork.else[0];
      if (loop !== undefined && 'each' in loop) loop.do.push({ call: 'api:fx-get-rate' });
    }
    const looped = derive(p)
      .handlerEdges()
      .find((e) => e.path.join('.') === 'steps.1.else.0.do.1');
    expect(looped).toMatchObject({
      looped: true,
      guard: 'unless the SKU has a manual price, for each rule, in priority order',
    });
  });

  it('folds into the model edges without doubling those a flow already draws', () => {
    const talks = m
      .edges()
      .map((e) => `${e.kind} ${e.from}->${e.to} ${(e.handlers ?? []).join(',')}`);
    expect(talks.filter((e) => e.startsWith('api svc:pricing->svc:fx'))).toEqual([
      'api svc:pricing->svc:fx h:pricing-get-price',
    ]);
    expect(talks).toContain('api svc:search->svc:pricing h:search-reindex');
    expect(talks).toContain('api svc:search->svc:fx h:nightly');
  });
});

describe('call trees', () => {
  it('follows calls to the callee and publishes to each consumer, and stops at a loop', () => {
    expect(drawn(m.callTree('api:pricing-get-price'))).toEqual([
      'h:pricing-get-price',
      '  read sch:price-rule',
      '  call api:fx-get-rate',
      '    h:fx-get-rate',
      '  write sch:price-rule',
      '  publish msg:price-changed',
      '    h:search-reindex',
      '      call api:pricing-get-price [cycle]',
    ]);
  });

  it('stops at the depth limit', () => {
    expect(drawn(m.callTree('h:search-reindex', { depth: 1 }))).toEqual([
      'h:search-reindex',
      '  call api:pricing-get-price',
      '    h:pricing-get-price',
      '      read sch:price-rule',
      '      call api:fx-get-rate [depth]',
      '      write sch:price-rule',
      '      publish msg:price-changed [depth]',
    ]);
  });

  it('marks a link nothing handles', () => {
    const p = structuredClone(m.plan);
    p.handlers = (p.handlers ?? []).filter((h) => h.id !== 'h:fx-get-rate');
    expect(drawn(derive(p).callTree('h:nightly'))).toEqual([
      'h:nightly',
      '  call api:fx-get-rate [unhandled]',
    ]);
  });

  it('starts from a component with all its handlers', () => {
    expect(m.handlersOf('svc:search')).toEqual(['h:search-reindex', 'h:nightly']);
    expect(m.handlersOf('msg:price-changed')).toEqual(['h:search-reindex']);
    expect(m.callTree('svc:search', { depth: 0 }).map((t) => t.handler)).toEqual([
      'h:search-reindex',
      'h:nightly',
    ]);
  });
});
