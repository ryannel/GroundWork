import { describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { quickCheckoutOnToday } from '@/../test/fixtures/acme/plans/core-checkout';
import { giftWrap } from '@/../test/fixtures/acme/plans/journeys-gift-wrap';
import { pauseOrders } from '@/../test/fixtures/acme/plans/pause-orders';
import { orderEventV2 } from '@/../test/fixtures/acme/plans/versions-order-event';
import { coreShop } from '@/../test/fixtures/core-shop';
import { modelOf } from '@/../test/plan-kit';
import { fieldRule, type Roles } from '@/application/plan/compat-rules';
import { derive } from '@/application/plan/derive';
import type { Plan } from '@/domain/plan/plan.generated';

/** Quick checkout on the richer Acme today, with the whole of today in it. */
const checkout = () => derive(quickCheckoutOnToday().whole);

const roles = (o: Partial<Roles>): Roles => ({
  record: false,
  request: [],
  response: [],
  payload: [],
  graph: false,
  ...o,
});
const REC = roles({ record: true });
const REQ = roles({ request: ['api:x'] });
const RES = roles({ response: ['api:x'] });
const MSG = roles({ payload: ['msg:x'] });
const GRAPH = roles({ graph: true });

type Shape = Parameters<typeof fieldRule>[1];
const f = (o: Record<string, unknown> = {}): Shape => ({
  name: 'a',
  type: 'string',
  required: false,
  ...o,
});
const verdict = (r: Roles, was: Shape, now?: Shape) => fieldRule(r, was, now).verdict;

describe('the field rule: who is broken by what', () => {
  it('a new required field breaks callers, informs readers, and needs a backfill in a store', () => {
    expect(verdict(REQ, undefined, f({ required: true }))).toBe('breaking');
    expect(verdict(RES, undefined, f({ required: true }))).toBe('safe');
    expect(verdict(MSG, undefined, f({ required: true }))).toBe('safe');
    expect(verdict(REC, undefined, f({ required: true }))).toBe('migration');
    expect(verdict(REC, undefined, f({ required: true, default: 0 }))).toBe('safe');
  });

  it('removals, type changes and narrowing break readers', () => {
    expect(verdict(RES, f())).toBe('breaking');
    expect(verdict(RES, f(), f({ type: 'int' }))).toBe('breaking');
    expect(verdict(RES, f({ required: true }), f({ required: false }))).toBe('breaking');
    expect(verdict(RES, f({ type: 'enum(a,b)' }), f({ type: 'enum(a)' }))).toBe('breaking');
  });

  it('gaining an enum value needs a migration; a note changes nobody', () => {
    expect(verdict(RES, f({ type: 'enum(a)' }), f({ type: 'enum(a,b)' }))).toBe('migration');
    expect(verdict(RES, f(), f({ note: 'just words' }))).toBe('safe');
  });

  it('a graph field changes no stored or sent shape by itself', () => {
    expect(fieldRule(GRAPH, f(), f({ note: 'words' })).rules.every((r) => r.role === 'graph')).toBe(
      true,
    );
  });
});

describe('compat on a plan', () => {
  it('breaking means a reader this plan does not move; otherwise needs migration', () => {
    const m = checkout();
    const price = m.compat('sch:product#price_cents')!;
    expect(price.verdict).toBe('breaking');
    expect(price.who.some((w) => w.movedBy === null)).toBe(true);
    expect(price.who.map((w) => w.svc)).toContain('svc:shop-bff');
    const words = m.compat('sch:search-doc#words')!;
    expect(words.verdict).toBe('migration');
    expect(words.who.length > 0 && words.who.every((w) => w.movedBy !== null)).toBe(true);
    const v1 = m.compat('msg:product-changed');
    expect(v1 !== null && v1.verdict !== 'safe').toBe(true);
    expect(v1?.who.find((w) => w.movedBy === null)?.svc).toBe('svc:shop-bff');
    expect(m.compat('sch:order-placed-v1')).toBeNull();
  });

  it('netDiff compares today with the plan, not the op log', () => {
    const m = checkout();
    const fields = (id: string) =>
      Object.fromEntries(
        m
          .netDiff(id)
          .flatMap((r) => ('field' in r ? [r] : []))
          .map((r) => [r.field, r]),
      );
    const product = fields('sch:product');
    expect(product.colour?.status).toBe('added');
    expect(['removed', 'deprecated']).toContain(product.price_cents?.status);
    expect(product.sku).toBeUndefined();
    const doc = fields('sch:search-doc');
    expect(doc.words?.status).toBe('modified');
    expect(doc.words?.props.some((p) => p.prop === 'required')).toBe(true);
    expect(m.netDiff('sch:order-placed-v1')).toHaveLength(0);
  });
});

describe('compat across every plan', () => {
  it('judges every thing a plan touches without throwing, and only unsafe verdicts name who', () => {
    const plans: readonly (readonly [string, Plan])[] = [
      ['quick-checkout', quickCheckoutOnToday().whole],
      ['gift-wrap', giftWrap()],
      ['pause-orders', pauseOrders()],
      ['order-event-v2', orderEventV2()],
      ['shop', coreShop()],
    ];
    for (const [slug, plan] of plans) {
      const m = modelOf(plan);
      for (const id of m.toBe.byId.keys()) {
        const c = m.compat(id);
        expect(c?.verdict === 'safe' ? c.who : [], `${slug} ${id}`).toEqual([]);
        m.netDiff(id);
      }
    }
  });

  it('the shop graph: a field moved between subgraphs changes no sent or stored shape', () => {
    const m = derive(shop());
    expect(m.compat('sch:gql-product#price')).toEqual({ verdict: 'safe', reasons: [], who: [] });
    expect(m.compat('sch:gql-product#leadTimeDays')).toBeNull();
  });
});
